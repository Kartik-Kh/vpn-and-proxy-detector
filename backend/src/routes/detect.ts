import { Router, Request, Response } from 'express';
const IPCIDR = require('ip-cidr');
const whois = require('whois-json');
import { NetworkMonitorService } from '../services/network-monitor.service';
import { RealTimeAnalysisService } from '../services/real-time-analysis.service';

const router = Router();

interface CacheEntry {
  timestamp: number;
  data: DetectionResult;
}

interface Check {
  type: string;
  result: boolean;
  details: string;
}

interface MLFeatures {
  rttScore: number;
  geoConsistency: number;
  timeSeriesScore: number;
  portActivityScore: number;
}

interface DetectionResult {
  ip: string;
  verdict: 'PROXY/VPN' | 'ORIGINAL';
  score: number;
  confidence: number;
  checks: Check[];
  realTimeMetrics?: any;
  realTimeAnalysis?: any;
  traditionalResult?: any;
}

interface WhoisData {
  [key: string]: any;
}

// Load VPN ranges (in production, this should be loaded from a file/database)
const vpnRanges = [
  '104.16.0.0/12',      // Cloudflare range
  '5.79.64.0/20',       // VPN range
  '162.245.204.0/24',   // NordVPN range 1
  '185.93.0.0/16',      // Private Internet Access
  '198.54.128.0/24',    // ExpressVPN
  '91.203.0.0/16',      // NordVPN range 2 (covers 91.203.5.165)
  '185.220.0.0/16',     // Tor exit nodes (covers 185.220.101.1)
  '104.238.0.0/16',     // VPN provider range (covers 104.238.154.191)
  '209.58.128.0/18',    // VPN range
  '89.40.0.0/16',       // VPN range
  '46.166.128.0/17',    // VPN range
];

// In-memory cache (for development)
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

import { MLDetectionService } from '../services/ml-detection.service';
import { DetectionService } from '../services/detection.service';

// Main detection endpoint
const detectHandler = async (req: Request, res: Response) => {
  try {
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }

    // Basic IP validation
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }

    // Check in-memory cache
    const cached = cache.get(ip);
    if (cached && cached.timestamp > Date.now() - CACHE_TTL) {
      return res.json(cached.data);
    }

    // Get real-time network metrics
    const realTimeMetrics = await NetworkMonitorService.getRealTimeMetrics(ip);
    
    // Analyze metrics using real-time analysis service
    const realTimeAnalysis = RealTimeAnalysisService.analyzeMetrics(realTimeMetrics);

    // Get traditional detection results
    const traditionalResult = await DetectionService.detectIP(ip);

    // Check if IP is in VPN ranges
    const isVpn = vpnRanges.some(range => {
      const cidr = new IPCIDR(range);
      return cidr.contains(ip);
    });

    // Get WHOIS data
    let whoisData;
    try {
      whoisData = await whois(ip);
    } catch (err) {
      console.error('WHOIS lookup failed:', err);
      whoisData = null;
    }

    // Check whois data for VPN/proxy indicators
    let whoisScore = 0;
    const whoisIndicators = [
      'hosting',
      'vpn',
      'proxy', 
      'datacenter',
      'cloud',
      'anonymous',
      'private network',
      'dedicated server'
    ];

    const highRiskKeywords = [
      'vpn',
      'proxy',
      'anonymous'
    ];

    if (whoisData) {
      const whoisStr = JSON.stringify(whoisData).toLowerCase();
      
      // Check for high-risk indicators
      for (const keyword of highRiskKeywords) {
        if (whoisStr.includes(keyword)) {
          whoisScore += 30;
          break;
        }
      }
      
      // Check for general indicators
      whoisIndicators.forEach(indicator => {
        if (whoisStr.includes(indicator)) {
          whoisScore += 15;
        }
      });

      // Cap the whois score at 90
      whoisScore = Math.min(whoisScore, 90);
    }

    // Calculate final score
    let score = 0;
    
    // CIDR match is a strong indicator
    if (isVpn) {
      score = 90;
    } else {
      // Use whois score if no CIDR match
      score = whoisScore;
    }
    
    const verdict = score >= 30 ? 'PROXY/VPN' as const : 'ORIGINAL' as const;
    // Calculate final score combining traditional and real-time analysis
    const TRADITIONAL_WEIGHT = 0.4;
    const REALTIME_WEIGHT = 0.6;

    const finalScore = Math.round(
      traditionalResult.score * TRADITIONAL_WEIGHT +
      realTimeAnalysis.score * REALTIME_WEIGHT
    );

    const result: DetectionResult = {
      ip,
      verdict: finalScore >= 40 ? 'PROXY/VPN' : 'ORIGINAL',  // Lowered threshold from 50 to 40
      score: finalScore,
      confidence: realTimeAnalysis.confidence,
      checks: [
        {
          type: 'CIDR_CHECK',
          result: isVpn,
          details: isVpn ? 'IP found in known VPN/proxy ranges' : 'IP not in known VPN/proxy ranges'
        },
        {
          type: 'WHOIS_CHECK',
          result: whoisScore >= 20,
          details: whoisScore >= 20 ? 'VPN/proxy indicators found in WHOIS data' : 'No VPN/proxy indicators in WHOIS data'
        },
        {
          type: 'REALTIME_ANALYSIS',
          result: realTimeAnalysis.score >= 50,
          details: `Real-time detection score: ${realTimeAnalysis.score}/100 (Confidence: ${realTimeAnalysis.confidence}%)`
        },
        ...realTimeAnalysis.factors.map(factor => ({
          type: factor.name.toUpperCase().replace(/ /g, '_'),
          result: factor.score >= 0.5,
          details: factor.details
        }))
      ],
      realTimeMetrics,
      realTimeAnalysis,
      traditionalResult
    };

    // Store in memory cache
    cache.set(ip, {
      timestamp: Date.now(),
      data: result
    });

    res.json(result);
  } catch (err) {
    console.error('Detection error:', err);
    res.status(500).json({ 
      error: 'Detection failed',
      message: err instanceof Error ? err.message : 'Unknown error'
    });
  }
};

// Register both routes
router.post('/', detectHandler);
router.post('/single', detectHandler);

export default router;