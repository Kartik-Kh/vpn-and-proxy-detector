import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';
import { optionalAuthMiddleware } from '../middleware/auth.middleware';
import cacheService from '../services/cache.service';
import { logger } from '../config/logger';
import axios from 'axios';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '10')) * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// In-memory job storage (replace with Redis in production)
const jobs = new Map<string, any>();

// Known VPN/datacenter IP range patterns
const VPN_RANGES = [
  { provider: 'NordVPN',    pattern: /^(185\.201\.|193\.29\.|212\.102\.|91\.203\.|185\.220\.)/ },
  { provider: 'ExpressVPN', pattern: /^(149\.248\.|103\.253\.|169\.50\.)/ },
  { provider: 'ProtonVPN',  pattern: /^(138\.199\.|149\.90\.|185\.159\.)/ },
  { provider: 'Surfshark',  pattern: /^(217\.138\.|37\.120\.|185\.225\.)/ },
  { provider: 'Mullvad',    pattern: /^(193\.138\.|194\.165\.|185\.213\.)/ },
  { provider: 'PIA',        pattern: /^(209\.222\.|178\.162\.|84\.17\.)/ },
  { provider: 'HideMyAss',  pattern: /^(46\.246\.|31\.171\.|194\.116\.)/ },
  { provider: 'Datacenter', pattern: /^(104\.238\.|104\.16\.|198\.199\.|159\.203\.)/ },
];

// Known datacenter/hosting ASN keywords
const HOSTING_KEYWORDS = [
  'hosting', 'datacenter', 'data center', 'cloud', 'server', 'dedicated',
  'virtual private', 'vps', 'infrastructure', 'digitalocean', 'linode',
  'vultr', 'amazon', 'google', 'microsoft azure', 'ovh', 'hetzner',
  'cloudflare', 'fastly', 'akamai', 'leaseweb', 'choopa',
];

// Tor exit-node hostname keywords
const TOR_KEYWORDS = ['tor', 'exit', 'relay', 'onion', 'darknet'];

// Full IP detection used by bulk CSV jobs
async function detectIPFull(ip: string): Promise<any> {
  const cacheKey = `bulk:${ip}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) return { ...cached, cached: true };

  const checks: any[] = [];
  let score = 0;

  // 1. Known VPN range match
  const rangeMatch = VPN_RANGES.find(r => r.pattern.test(ip));
  if (rangeMatch) {
    checks.push({ type: 'VPN Range Match', result: true, details: `Matched ${rangeMatch.provider} IP range` });
    score += 60;
  }

  // 2. Private IP
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) {
    checks.push({ type: 'Private IP', result: true, details: 'Private/reserved address space' });
    score += 15;
  }

  // 3. IPQualityScore
  if (process.env.IPQUALITYSCORE_API_KEY) {
    try {
      const r = await axios.get(
        `https://ipqualityscore.com/api/json/ip/${process.env.IPQUALITYSCORE_API_KEY}/${ip}`,
        { timeout: 5000 }
      );
      if (r.data.success) {
        const vpn = r.data.vpn || r.data.proxy || r.data.tor;
        const fraud = r.data.fraud_score || 0;
        checks.push({ type: 'IPQualityScore', result: vpn, details: `Fraud:${fraud} VPN:${r.data.vpn} Proxy:${r.data.proxy} Tor:${r.data.tor}` });
        if (vpn) score += 25;
        score += Math.min(fraud / 4, 15);
        if (r.data.tor) score += 20;
      }
    } catch { /* skip on timeout */ }
  }

  // 4. AbuseIPDB
  if (process.env.ABUSEIPDB_API_KEY) {
    try {
      const r = await axios.get(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`,
        { headers: { Key: process.env.ABUSEIPDB_API_KEY }, timeout: 5000 }
      );
      if (r.data.data) {
        const abuse = r.data.data.abuseConfidenceScore || 0;
        checks.push({ type: 'AbuseIPDB', result: abuse > 50, details: `Abuse score: ${abuse}%` });
        if (abuse > 75) score += 15;
        else if (abuse > 50) score += 8;
      }
    } catch { /* skip */ }
  }

  // 5. IPInfo — org/ASN hosting detection
  if (process.env.IPINFO_TOKEN) {
    try {
      const r = await axios.get(`https://ipinfo.io/${ip}/json?token=${process.env.IPINFO_TOKEN}`, { timeout: 5000 });
      if (r.data) {
        const org = (r.data.org || '').toLowerCase();
        const isHosting = HOSTING_KEYWORDS.some(k => org.includes(k));
        checks.push({
          type: 'IPInfo ASN',
          result: isHosting,
          details: `Org: ${r.data.org || 'Unknown'}, ${r.data.city || ''}, ${r.data.country || ''}`,
          location: `${r.data.city || ''}, ${r.data.country || ''}`,
        });
        if (isHosting) score += 12;
      }
    } catch { /* skip */ }
  }

  // 6. Reverse DNS — VPN/Tor/proxy keywords
  try {
    const { promises: dns } = await import('dns');
    const hostnames = await dns.reverse(ip).catch(() => [] as string[]);
    const suspicious = hostnames.some(h =>
      [...TOR_KEYWORDS, 'vpn', 'proxy'].some(k => h.toLowerCase().includes(k))
    );
    if (suspicious) {
      checks.push({ type: 'Reverse DNS', result: true, details: `Suspicious hostname: ${hostnames[0]}` });
      score += 18;
    }
  } catch { /* skip */ }

  score = Math.min(Math.max(Math.round(score), 0), 100);
  const verdict = score >= 40 ? 'PROXY/VPN' : 'ORIGINAL';
  const threatLevel = score > 65 ? 'HIGH' : score > 40 ? 'MEDIUM' : score > 20 ? 'LOW' : 'CLEAN';

  const result = { ip, verdict, score, threatLevel, checks, timestamp: new Date().toISOString(), cached: false };
  await cacheService.set(cacheKey, result, 1800);
  return result;
}

// POST /api/bulk/upload - Upload CSV for bulk analysis
const uploadMiddleware = (req: Request, res: Response, next: any) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      logger.error('Multer upload error:', err);
      return res.status(400).json({ error: err.message || 'File upload error' });
    }
    next();
  });
};

router.post(
  '/upload',
  optionalAuthMiddleware,
  uploadMiddleware,
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Parse CSV
      const csvData = req.file.buffer.toString('utf-8');
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      // Extract IPs (assuming column named 'ip' or first column)
      const ips = records
        .map((record: any) => record.ip || record[Object.keys(record)[0]])
        .filter((ip: string) => ip && /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip));

      if (ips.length === 0) {
        return res.status(400).json({
          error: 'No valid IP addresses found in CSV file',
        });
      }

      if (ips.length > 100) {
        return res.status(400).json({
          error: `CSV contains ${ips.length} IPs. Maximum allowed is 100 IPs per upload.`,
        });
      }

      // Create job
      const jobId = uuidv4();
      const job = {
        id: jobId,
        status: 'pending',
        total: ips.length,
        processed: 0,
        results: [],
        createdAt: new Date(),
        userId: req.user?.id,
      };

      jobs.set(jobId, job);

      // Start processing in background
      processBulkJob(jobId, ips, req.app.get('io'));

      logger.info(`Bulk job created: ${jobId} with ${ips.length} IPs`);

      res.json({
        jobId,
        message: 'Bulk analysis started',
        total: ips.length,
      });
    } catch (error: any) {
      logger.error('Bulk upload error:', error);
      res.status(500).json({ error: error.message || 'Upload failed' });
    }
  }
);

// GET /api/bulk/job/:jobId - Get job status
router.get('/job/:jobId', async (req: Request, res: Response) => {
  try {
    const job = jobs.get(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    logger.error('Job status error:', error);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

// GET /api/bulk/job/:jobId/results - Get job results
router.get('/job/:jobId/results', async (req: Request, res: Response) => {
  try {
    const job = jobs.get(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      jobId: job.id,
      status: job.status,
      results: job.results,
      total: job.total,
      processed: job.processed,
    });
  } catch (error) {
    logger.error('Job results error:', error);
    res.status(500).json({ error: 'Failed to get job results' });
  }
});

// GET /api/bulk/job/:jobId/download - Download results as CSV
router.get('/job/:jobId/download', async (req: Request, res: Response) => {
  try {
    const job = jobs.get(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Job not completed yet' });
    }

    // Generate CSV
    const csv = [
      'IP,Verdict,Score,Confidence',
      ...job.results.map(
        (result: any) =>
          `${result.ip},${result.verdict},${result.score},${result.confidence || 'N/A'}`
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=bulk-results-${job.id}.csv`
    );
    res.send(csv);
  } catch (error) {
    logger.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download results' });
  }
});

// DELETE /api/bulk/job/:jobId - Cancel/delete job
router.delete('/job/:jobId', async (req: Request, res: Response) => {
  try {
    const job = jobs.get(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    jobs.delete(req.params.jobId);
    logger.info(`Job deleted: ${req.params.jobId}`);

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    logger.error('Job delete error:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// Background job processor
async function processBulkJob(jobId: string, ips: string[], io: any) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = 'processing';
  const batchSize = parseInt(process.env.BULK_BATCH_SIZE || '10');

  try {
    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize);

      const promises = batch.map((ip) =>
        detectIPFull(ip)
          .then((result) => {
            job.results.push(result);
            job.processed++;
            io?.emit?.(`bulk-progress-${jobId}`, {
              jobId,
              processed: job.processed,
              total: job.total,
              percentage: Math.round((job.processed / job.total) * 100),
            });
          })
          .catch((error) => {
            logger.error(`Error processing IP ${ip}:`, error);
            job.results.push({
              ip,
              verdict: 'ERROR',
              score: 0,
              threatLevel: 'UNKNOWN',
              error: error.message,
            });
            job.processed++;
          })
      );

      await Promise.all(promises);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    job.status = 'completed';
    job.completedAt = new Date();
    io?.emit?.(`bulk-complete-${jobId}`, {
      jobId,
      status: 'completed',
      total: job.total,
      processed: job.processed,
    });
    logger.info(`Bulk job completed: ${jobId}`);
  } catch (error) {
    logger.error(`Bulk job ${jobId} failed:`, error);
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    io?.emit?.(`bulk-error-${jobId}`, { jobId, error: job.error });
  }
}

export default router;
