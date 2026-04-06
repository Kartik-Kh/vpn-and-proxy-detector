import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Chip,
  Tabs,
  Tab,
  Divider,
  Tooltip,
  IconButton,
  Badge,
  Collapse,
  Grid,
} from '@mui/material';
import {
  CloudUpload,
  Assessment,
  ListAlt,
  UploadFile,
  Download,
  Delete,
  Refresh,
  CheckCircle,
  Cancel,
  Warning,
  HourglassEmpty,
  ExpandMore,
  ExpandLess,
  PictureAsPdf,
  Shield,
  Language,
  Business,
  CalendarToday,
} from '@mui/icons-material';
import axios from 'axios';
import jsPDF from 'jspdf';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BulkResult {
  ip: string;
  verdict: string;
  score: number;
  threatLevel: string;
  checks?: { type: string; result: boolean; details: string }[];
  error?: string;
}

interface SingleResult {
  ip: string;
  verdict: string;
  score: number;
  threatLevel: string;
  checks?: { type: string; result: boolean; details: string }[];
  whois?: {
    parsed?: {
      org?: string; registrant?: string; registrar?: string; netname?: string;
      inetnum?: string; description?: string; country?: string; city?: string;
      asn?: string; email?: string; created?: string; updated?: string;
      domainAge?: string; source?: string;
    };
    raw?: string;
    source?: string;
  };
  analysis?: {
    isProxy?: boolean; isVPN?: boolean; isTor?: boolean; isHosting?: boolean;
    isPrivate?: boolean;
  };
  timestamp?: string;
  cached?: boolean;
}

interface BulkResponse {
  total: number;
  processed: number;
  results: BulkResult[];
  summary: { clean: number; suspicious: number; vpn: number };
}

interface CsvJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total: number;
  processed: number;
  results: BulkResult[];
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const verdictColor = (v: string): 'success' | 'error' | 'warning' | 'default' => {
  switch (v?.toUpperCase()) {
    case 'ORIGINAL':  return 'success';
    case 'PROXY/VPN': return 'error';
    case 'ERROR':     return 'default';
    default:          return 'warning';
  }
};

const threatColor = (t: string): 'success' | 'info' | 'warning' | 'error' | 'default' => {
  switch (t?.toUpperCase()) {
    case 'CLEAN':  return 'success';
    case 'LOW':    return 'info';
    case 'MEDIUM': return 'warning';
    case 'HIGH':   return 'error';
    default:       return 'default';
  }
};

const scoreBar = (score: number) => {
  const color = score > 65 ? '#f44336' : score > 40 ? '#ff9800' : score > 20 ? '#2196f3' : '#4caf50';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ flex: 1, height: 8, borderRadius: 4, background: '#e0e0e0', overflow: 'hidden' }}>
        <Box sx={{ width: `${score}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', minWidth: 36, color }}>{score}</Typography>
    </Box>
  );
};

const saveToHistory = (results: BulkResult[]) => {
  try {
    const entries = results.map(r => ({
      ip: r.ip, verdict: r.verdict, score: r.score,
      threatLevel: r.threatLevel || 'UNKNOWN', timestamp: new Date().toISOString(), cached: false,
    }));
    const stored = localStorage.getItem('vpn_detection_history');
    let history = stored ? JSON.parse(stored) : [];
    history.unshift(...entries);
    if (history.length > 100) history = history.slice(0, 100);
    localStorage.setItem('vpn_detection_history', JSON.stringify(history));
  } catch { /* ignore */ }
};

// ─── PDF Report ───────────────────────────────────────────────────────────────

const generatePDF = async (
  results: BulkResult[],
  source: string,
  expandedData: Record<string, SingleResult>,
  setGenerating: (v: boolean) => void,
) => {
  setGenerating(true);

  // Fetch full data for any IP not yet expanded
  const allData: Record<string, SingleResult> = { ...expandedData };
  const missing = results.filter(r => !allData[r.ip] && !r.error);
  await Promise.all(
    missing.map(async r => {
      try {
        const res = await axios.post<SingleResult>(`${API_BASE}/detect/single`, { ip: r.ip });
        allData[r.ip] = res.data;
      } catch { /* use basic data */ }
    })
  );

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const generated = new Date().toLocaleString('en-GB', { timeZoneName: 'short' });
  const dateSlug = new Date().toISOString().slice(0, 10);
  const W = 210; const margin = 15; const textW = W - margin * 2;
  let y = 0;

  const addPage = () => { doc.addPage(); y = 20; };
  const checkY = (needed = 12) => { if (y + needed > 278) addPage(); };

  // ── Header ──
  doc.setFillColor(30, 30, 60);
  doc.rect(0, 0, W, 38, 'F');
  doc.setTextColor(255, 215, 0);
  doc.setFontSize(15); doc.setFont('helvetica', 'bold');
  doc.text('IP Detection & Analysis Report', W / 2, 14, { align: 'center' });
  doc.setFontSize(9); doc.setTextColor(200, 210, 255);
  doc.text('Threat Intelligence Summary — VPN / Proxy / Anonymity Detection', W / 2, 22, { align: 'center' });
  doc.setFontSize(7.5); doc.setTextColor(170, 180, 210);
  doc.text(`Generated: ${generated}   |   Source: ${source}`, W / 2, 30, { align: 'center' });

  y = 46;

  // ── Report Details box ──
  doc.setDrawColor(102, 126, 234); doc.setLineWidth(0.4);
  doc.setFillColor(245, 247, 255);
  doc.roundedRect(margin, y, textW, 22, 2, 2, 'FD');
  doc.setTextColor(50, 50, 100); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
  doc.text('Report Details', margin + 4, y + 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(60, 60, 80);
  doc.text(`Analysis Time : ${generated}`, margin + 4, y + 13);
  doc.text(`Total IPs Analysed : ${results.length}   |   Data Source : ${source}`, margin + 4, y + 19);
  y += 28;

  // ── Summary stats ──
  const clean = results.filter(r => r.score < 20).length;
  const suspicious = results.filter(r => r.score >= 20 && r.score < 40).length;
  const vpn = results.filter(r => r.score >= 40).length;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 30, 60);
  doc.text('Scan Summary', margin, y + 5);
  y += 9;
  const cols: { label: string; value: string; color: [number, number, number] }[] = [
    { label: 'TOTAL',      value: results.length.toString(), color: [102, 126, 234] },
    { label: 'CLEAN',      value: clean.toString(),          color: [76, 175, 80] },
    { label: 'SUSPICIOUS', value: suspicious.toString(),     color: [255, 152, 0] },
    { label: 'VPN / PROXY',value: vpn.toString(),            color: [244, 67, 54] },
  ];
  const boxW = textW / 4;
  cols.forEach((c, i) => {
    const x = margin + i * boxW;
    doc.setFillColor(...c.color); doc.roundedRect(x, y, boxW - 2, 15, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.text(c.value, x + (boxW - 2) / 2, y + 9, { align: 'center' });
    doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.text(c.label, x + (boxW - 2) / 2, y + 13.5, { align: 'center' });
  });
  y += 22;

  // ── Per-IP findings ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(30, 30, 60);
  doc.text('IP Address Findings', margin, y + 5); y += 11;

  results.forEach((r, idx) => {
    checkY(55);

    // IP header bar
    const rowColor: [number, number, number] = r.score >= 40 ? [220, 50, 50] : r.score >= 20 ? [230, 120, 20] : [56, 142, 60];
    doc.setFillColor(...rowColor);
    doc.roundedRect(margin, y, textW, 7.5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.text(`${idx + 1}.  ${r.ip}`, margin + 3, y + 5.2);
    doc.text(`${r.verdict}   Score: ${r.score}/100   Risk: ${r.threatLevel || 'N/A'}`, W - margin - 3, y + 5.2, { align: 'right' });
    y += 9;

    const detail = allData[r.ip];

    // Detection Analysis flags
    if (detail?.analysis) {
      const flags = detail.analysis;
      const flagItems: string[] = [];
      if (flags.isVPN)     flagItems.push('VPN');
      if (flags.isProxy)   flagItems.push('Proxy');
      if (flags.isTor)     flagItems.push('Tor Exit Node');
      if (flags.isHosting) flagItems.push('Hosting / Datacenter');
      if (flags.isPrivate) flagItems.push('Private Range');
      if (flagItems.length > 0) {
        checkY(6);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(50, 50, 100);
        doc.text('Detected As:', margin + 3, y + 4);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 30, 30);
        doc.text(flagItems.join('   |   '), margin + 28, y + 4);
        y += 6;
      }
    }

    // Security Checks
    const checks = detail?.checks || r.checks || [];
    if (checks.length > 0) {
      checkY(6);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(50, 50, 100);
      doc.text('Security Checks:', margin + 3, y + 4); y += 6;
      checks.forEach(ch => {
        checkY(5.5);
        const dotColor: [number, number, number] = ch.result ? [200, 40, 40] : [56, 142, 60];
        doc.setFillColor(...dotColor);
        doc.circle(margin + 6, y + 2.5, 1.2, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(40, 40, 60);
        doc.text(ch.type + ':', margin + 9, y + 3.5);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 90);
        const detailText = (ch.details || '').substring(0, 95);
        doc.text(detailText, margin + 34, y + 3.5);
        y += 5.5;
      });
    }

    // WHOIS Intelligence
    const w = detail?.whois?.parsed;
    const whoisRaw: Array<[string, string | undefined]> = w ? [
      ['Organisation', w.org], ['Registrant', w.registrant], ['Net Name', w.netname],
      ['INETNUM',      w.inetnum], ['Description', w.description], ['Country', w.country],
      ['City',         w.city],   ['ASN', w.asn], ['Registrar', w.registrar],
      ['Abuse Email',  w.email],  ['Created', w.created], ['Updated', w.updated],
      ['Source',       w.source ?? detail?.whois?.source],
    ] : [];
    const whoisFields = whoisRaw.filter(([, v]) => !!v);

    if (whoisFields.length > 0) {
      checkY(7);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(50, 50, 100);
      doc.text('WHOIS Records:', margin + 3, y + 4); y += 6;
      whoisFields.forEach(([label, val]) => {
        checkY(5);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(70, 70, 90);
        doc.text(`${label}:`, margin + 9, y + 3.3);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 50);
        doc.text(String(val).substring(0, 88), margin + 35, y + 3.3);
        y += 5;
      });
    } else if (!detail) {
      checkY(5);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
      doc.text('WHOIS data unavailable', margin + 9, y + 3.3); y += 5;
    }

    // Metadata row
    if (detail?.timestamp) {
      checkY(5);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5); doc.setTextColor(140, 140, 160);
      doc.text(`Analysed: ${new Date(detail.timestamp).toLocaleString()}${detail.cached ? '  (cached)' : '  (live)'}`, margin + 3, y + 3.5);
      y += 5;
    }

    // Separator
    doc.setDrawColor(210, 215, 240); doc.setLineWidth(0.25);
    doc.line(margin, y + 2, margin + textW, y + 2); y += 7;
  });

  // ── Disclaimer ──
  checkY(38);
  doc.setFillColor(250, 250, 255);
  doc.setDrawColor(180, 185, 220); doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, textW, 36, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(70, 70, 110);
  doc.text('Important Notice', margin + 5, y + 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(90, 90, 110);
  const notice = [
    'This report was generated automatically using multiple IP intelligence sources (WHOIS, IPQualityScore,',
    'AbuseIPDB, IPInfo) and should be used for reference purposes only.',
    '',
    'Detection results are not guaranteed to be accurate. Some IPs may be incorrectly flagged due to',
    'shared hosting, carrier-grade NAT, dynamic addressing, or VPN service changes.',
    '',
    'Always verify results independently before taking action based on this report.',
  ];
  notice.forEach((line, i) => {
    doc.text(line, margin + 5, y + 14 + i * 4);
  });

  const filename = `ip-analysis-${source.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 30)}-${dateSlug}.pdf`;
  doc.save(filename);
  setGenerating(false);
};

// ─── Results Table ────────────────────────────────────────────────────────────

const ResultsTable = ({ results, title, source }: { results: BulkResult[]; title: string; source: string }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedData, setExpandedData] = useState<Record<string, SingleResult>>({});
  const [generating, setGenerating] = useState(false);

  const toggleRow = (ip: string) => setExpanded(prev => ({ ...prev, [ip]: !prev[ip] }));

  // Collect fetched data from ExpandedDetail (lifted via callback)
  const onDataFetched = useCallback((ip: string, data: SingleResult) => {
    setExpandedData(prev => ({ ...prev, [ip]: data }));
  }, []);

  const downloadCSV = () => {
    const header = 'IP Address,Verdict,Threat Score,Threat Level,Detection Signals';
    const rows = results.map(r =>
      `${r.ip},${r.verdict},${r.score},${r.threatLevel || 'N/A'},"${r.checks?.filter(c => c.result).map(c => c.type).join('; ') || ''}"`
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `detection-results-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const clean      = results.filter(r => r.score < 20).length;
  const suspicious = results.filter(r => r.score >= 20 && r.score < 40).length;
  const vpn        = results.filter(r => r.score >= 40).length;

  return (
    <>
      {/* Summary bar */}
      <Paper elevation={4} sx={{ p: 3, mb: 3, borderRadius: 3, background: '#fff' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>📊 {title}</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" size="small" startIcon={<Download />} onClick={downloadCSV}>Export CSV</Button>
            <Button
              variant="contained" size="small"
              startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdf />}
              onClick={() => generatePDF(results, source, expandedData, setGenerating)}
              disabled={generating}
              sx={{ background: 'linear-gradient(90deg,#b71c1c,#e53935)', '&:hover': { background: 'linear-gradient(90deg,#9a1010,#c62828)' } }}
            >
              {generating ? 'Preparing PDF…' : 'Export PDF Report'}
            </Button>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip label={`Total: ${results.length}`}      color="primary"  sx={{ fontWeight: 700, fontSize: '0.9rem', py: 2.5 }} />
          <Chip label={`✅ Clean: ${clean}`}            color="success"  sx={{ fontWeight: 700, fontSize: '0.9rem', py: 2.5 }} />
          <Chip label={`⚠️ Suspicious: ${suspicious}`}  color="warning"  sx={{ fontWeight: 700, fontSize: '0.9rem', py: 2.5 }} />
          <Chip label={`🚨 VPN/Proxy: ${vpn}`}         color="error"    sx={{ fontWeight: 700, fontSize: '0.9rem', py: 2.5 }} />
        </Box>
      </Paper>

      {/* Results list */}
      <Paper elevation={4} sx={{ borderRadius: 3, overflow: 'hidden', background: '#fff' }}>
        {/* Table header */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '42px 160px 130px 180px 110px 1fr 50px',
            background: 'linear-gradient(90deg,#667eea,#764ba2)',
            px: 2, py: 1.3,
          }}
        >
          {['#', 'IP Address', 'Verdict', 'Threat Score', 'Risk Level', 'Detection Signals', ''].map(h => (
            <Typography key={h} sx={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem' }}>{h}</Typography>
          ))}
        </Box>

        {results.map((r, i) => (
          <Box key={r.ip + i} sx={{ borderBottom: '1px solid #f0f0f6' }}>
            {/* Main row */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '42px 160px 130px 180px 110px 1fr 50px',
                alignItems: 'center',
                px: 2, py: 1.2,
                background: expanded[r.ip] ? 'rgba(102,126,234,0.06)' : 'transparent',
                '&:hover': { background: 'rgba(102,126,234,0.04)' },
                cursor: 'default',
              }}
            >
              <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{i + 1}</Typography>
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.88rem' }}>{r.ip}</Typography>
              <Box>
                <Chip
                  label={r.verdict}
                  color={verdictColor(r.verdict)}
                  size="small"
                  icon={r.verdict === 'ORIGINAL' ? <CheckCircle /> : r.verdict === 'ERROR' ? <Cancel /> : <Warning />}
                  sx={{ fontWeight: 700 }}
                />
              </Box>
              <Box sx={{ pr: 2 }}>{scoreBar(r.score)}</Box>
              <Box>
                <Chip label={r.threatLevel || 'N/A'} color={threatColor(r.threatLevel)} size="small" sx={{ fontWeight: 600 }} />
              </Box>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                {r.error
                  ? <span style={{ color: '#f44336' }}>{r.error}</span>
                  : r.checks?.filter(c => c.result).map(c => c.type).join(', ') || '—'}
              </Typography>
              <Tooltip title={expanded[r.ip] ? 'Collapse' : 'Expand full intelligence'}>
                <IconButton size="small" onClick={() => toggleRow(r.ip)} sx={{ color: '#667eea' }}>
                  {expanded[r.ip] ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Tooltip>
            </Box>

            {/* Expanded detail */}
            <Collapse in={!!expanded[r.ip]} unmountOnExit>
              <ExpandedDetailWired ip={r.ip} onDataFetched={onDataFetched} />
            </Collapse>
          </Box>
        ))}
      </Paper>
    </>
  );
};

// ExpandedDetail wired with callback to lift data up for PDF
const ExpandedDetailWired = ({ ip, onDataFetched }: { ip: string; onDataFetched: (ip: string, data: SingleResult) => void }) => {
  const [data, setData] = useState<SingleResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    axios.post<SingleResult>(`${API_BASE}/detect/single`, { ip })
      .then(r => { if (!cancelled) { setData(r.data); onDataFetched(ip, r.data); } })
      .catch(() => { if (!cancelled) setError('Failed to fetch detailed intelligence for this IP.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ip, onDataFetched]);

  if (loading) return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3 }}>
      <CircularProgress size={20} /> <Typography variant="body2" color="text.secondary">Fetching full intelligence data for {ip}…</Typography>
    </Box>
  );
  if (error) return <Alert severity="warning" sx={{ m: 2 }}>{error}</Alert>;
  if (!data) return null;

  const w = data.whois?.parsed;
  const flags = data.analysis;
  const checks = data.checks || [];

  return (
    <Box sx={{ p: 3, background: 'linear-gradient(135deg,#f8f9ff 0%,#f0f4ff 100%)', borderTop: '2px solid #dee2f8' }}>
      <Grid container spacing={3}>

        {/* Detection Flags */}
        {flags && (
          <Grid size={12}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#3f51b5', display: 'flex', alignItems: 'center', gap: 0.7 }}>
              <Shield sx={{ fontSize: 16 }} /> Detection Analysis
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {[
                { key: 'isVPN',     label: 'VPN',            color: '#e53935' },
                { key: 'isProxy',   label: 'PROXY',          color: '#e65100' },
                { key: 'isTor',     label: 'TOR EXIT NODE',  color: '#6a1b9a' },
                { key: 'isHosting', label: 'HOSTING / DC',   color: '#0277bd' },
                { key: 'isPrivate', label: 'PRIVATE RANGE',  color: '#2e7d32' },
              ].map(({ key, label, color }) => (
                (flags as any)[key] !== undefined && (
                  <Chip
                    key={key}
                    label={label}
                    size="small"
                    icon={(flags as any)[key] ? <CheckCircle sx={{ fontSize: 14 }} /> : <Cancel sx={{ fontSize: 14 }} />}
                    sx={{
                      fontWeight: 700, fontSize: '0.7rem',
                      background: (flags as any)[key] ? color : '#e0e0e0',
                      color: (flags as any)[key] ? '#fff' : '#888',
                    }}
                  />
                )
              ))}
            </Box>
          </Grid>
        )}

        {/* WHOIS Records */}
        {w && Object.values(w).some(Boolean) && (
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#3f51b5', display: 'flex', alignItems: 'center', gap: 0.7 }}>
              <Language sx={{ fontSize: 16 }} /> WHOIS Intelligence Records
            </Typography>
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Table size="small">
                <TableBody>
                  {[
                    ['Organisation', w.org], ['Registrant', w.registrant], ['Net Name', w.netname],
                    ['INETNUM', w.inetnum], ['Description', w.description], ['Country', w.country],
                    ['City', w.city], ['ASN', w.asn], ['Registrar', w.registrar],
                    ['Abuse Email', w.email], ['Created', w.created], ['Updated', w.updated],
                    ['Domain Age', w.domainAge], ['Source', w.source],
                  ].filter(([, v]) => !!v).map(([label, val]) => (
                    <TableRow key={String(label)} sx={{ '&:nth-of-type(odd)': { background: 'rgba(102,126,234,0.04)' } }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#555', width: 120, py: 0.8 }}>{label}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', fontFamily: 'monospace', py: 0.8 }}>{String(val)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Grid>
        )}

        {/* Security Checks */}
        {checks.length > 0 && (
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#3f51b5', display: 'flex', alignItems: 'center', gap: 0.7 }}>
              <Business sx={{ fontSize: 16 }} /> Security Checks
            </Typography>
            <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5 }}>
              {checks.map((ch, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1, pb: 1, borderBottom: i < checks.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <Box sx={{ mt: 0.3 }}>
                    {ch.result
                      ? <CheckCircle sx={{ fontSize: 15, color: '#f44336' }} />
                      : <CheckCircle sx={{ fontSize: 15, color: '#4caf50' }} />}
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', color: ch.result ? '#c62828' : '#2e7d32' }}>{ch.type}</Typography>
                    <Typography variant="caption" color="text.secondary">{ch.details}</Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
          </Grid>
        )}

        {/* Metadata */}
        {(data.timestamp || data.cached !== undefined) && (
          <Grid size={12}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              {data.timestamp && (
                <Chip icon={<CalendarToday sx={{ fontSize: 13 }} />}
                  label={`Analysed: ${new Date(data.timestamp).toLocaleString()}`}
                  size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
              )}
              {data.cached !== undefined && (
                <Chip label={data.cached ? 'Cached result' : 'Live result'} size="small"
                  color={data.cached ? 'default' : 'success'} variant="outlined" sx={{ fontSize: '0.7rem' }} />
              )}
              {data.whois?.source && (
                <Chip label={`WHOIS: ${data.whois.source}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
              )}
            </Box>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const BulkAnalysis = () => {
  const [tab, setTab]           = useState(0);

  // IP List tab state
  const [ipList, setIpList]     = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError]     = useState('');
  const [listResults, setListResults] = useState<BulkResponse | null>(null);

  // CSV Upload tab state
  const [csvFile, setCsvFile]       = useState<File | null>(null);
  const [csvJob, setCsvJob]         = useState<CsvJob | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvError, setCsvError]     = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // IP List tab
  const handleListAnalyze = async () => {
    setListError('');
    setListResults(null);
    const ips = ipList.split(/[\n,\s]+/).map(ip => ip.trim()).filter(Boolean);
    if (!ips.length)      { setListError('Please enter at least one IP address.'); return; }
    if (ips.length > 100) { setListError('Maximum 100 IPs allowed per request.'); return; }
    setListLoading(true);
    try {
      const { data } = await axios.post<BulkResponse>(`${API_BASE}/detect/bulk`, { ips });
      setListResults(data);
      saveToHistory(data.results);
    } catch (err: any) {
      setListError(err.response?.data?.error || 'Bulk analysis failed. Please try again.');
    } finally {
      setListLoading(false);
    }
  };

  // CSV Upload tab
  const pollJob = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await axios.get<CsvJob>(`${API_BASE}/bulk/job/${jobId}`);
        setCsvJob(data);
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          if (data.results?.length) saveToHistory(data.results);
        }
      } catch {
        clearInterval(pollRef.current!);
        pollRef.current = null;
      }
    }, 1500);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setCsvError('Please select a valid CSV file.');
      return;
    }
    setCsvFile(file);
    setCsvError('');
    setCsvJob(null);
  };

  const handleCsvUpload = async () => {
    if (!csvFile) { setCsvError('Please choose a CSV file first.'); return; }
    setCsvError('');
    setCsvUploading(true);
    setCsvJob(null);
    try {
      const form = new FormData();
      form.append('file', csvFile);
      const { data } = await axios.post<{ jobId: string; total: number }>(`${API_BASE}/bulk/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCsvJob({ id: data.jobId, status: 'pending', total: data.total, processed: 0, results: [] });
      pollJob(data.jobId);
    } catch (err: any) {
      setCsvError(err.response?.data?.error || 'Upload failed. Ensure the CSV has an "ip" column.');
    } finally {
      setCsvUploading(false);
    }
  };

  const handleCsvReset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setCsvFile(null);
    setCsvJob(null);
    setCsvError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const progress = csvJob && csvJob.total > 0
    ? Math.round((csvJob.processed / csvJob.total) * 100)
    : 0;

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', py: 6 }}>
      <Container maxWidth="xl">

        {/* Page Header */}
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography variant="h2" sx={{ fontWeight: 800, fontSize: { xs: '2rem', md: '3rem' }, color: '#fff', textShadow: '0 4px 12px rgba(0,0,0,0.2)', mb: 1.5 }}>
            <Assessment sx={{ fontSize: 'inherit', verticalAlign: 'middle', mr: 1.5 }} />
            Bulk IP Analysis
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 300, maxWidth: 700, mx: 'auto' }}>
            Analyse multiple IP addresses simultaneously — paste a list or upload a CSV file for large-scale threat detection.
          </Typography>
        </Box>

        {/* Tab Switcher */}
        <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', mb: 3, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': { color: 'rgba(255,255,255,0.75)', fontWeight: 600, fontSize: '1rem', py: 2 },
              '& .Mui-selected': { color: '#fff !important' },
              '& .MuiTabs-indicator': { height: 3, background: '#ffd700' },
            }}
          >
            <Tab icon={<ListAlt />} iconPosition="start" label="IP List" />
            <Tab
              icon={
                <Badge badgeContent={csvJob?.status === 'processing' ? '●' : undefined} color="warning">
                  <UploadFile />
                </Badge>
              }
              iconPosition="start"
              label="CSV Upload"
            />
          </Tabs>
        </Paper>

        {/* Tab 0: IP List */}
        {tab === 0 && (
          <>
            <Paper elevation={8} sx={{ p: 4, mb: 4, borderRadius: 3, background: '#fff' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>📋 IP Address List</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Enter one IP per line or comma-separated (max 100). Supports IPv4 and IPv6.
              </Typography>
              <TextField
                fullWidth multiline rows={8}
                label="IP Addresses"
                value={ipList}
                onChange={e => setIpList(e.target.value)}
                placeholder={'8.8.8.8\n1.1.1.1\n185.220.101.1\n2001:4860:4860::8888'}
                sx={{ mb: 2, fontFamily: 'monospace' }}
                disabled={listLoading}
              />
              {listError && <Alert severity="error" sx={{ mb: 2 }}>{listError}</Alert>}
              <Button
                variant="contained" size="large" fullWidth
                startIcon={listLoading ? <CircularProgress size={20} color="inherit" /> : <Assessment />}
                onClick={handleListAnalyze}
                disabled={listLoading || !ipList.trim()}
                sx={{
                  py: 2, fontSize: '1rem', fontWeight: 700,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': { background: 'linear-gradient(135deg, #5a6fd6 0%, #6a3f91 100%)' },
                }}
              >
                {listLoading ? 'Analysing…' : '🔍 Run Bulk Analysis'}
              </Button>
            </Paper>

            {listLoading && (
              <Box sx={{ textAlign: 'center', color: '#fff', mb: 3 }}>
                <CircularProgress sx={{ color: '#fff' }} />
                <Typography sx={{ mt: 1 }}>Processing IPs against multiple threat intelligence sources…</Typography>
              </Box>
            )}

            {listResults && (
              <ResultsTable results={listResults.results} title="Bulk Analysis Results" source="IP List Input" />
            )}

            {!listResults && !listLoading && (
              <Paper elevation={4} sx={{ p: 6, textAlign: 'center', borderRadius: 3, background: 'rgba(255,255,255,0.95)' }}>
                <Assessment sx={{ fontSize: 64, color: '#c5cae9', mb: 1 }} />
                <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>Ready for bulk analysis</Typography>
                <Typography variant="body2" color="text.secondary">Paste IP addresses above and click Run Bulk Analysis.</Typography>
              </Paper>
            )}
          </>
        )}

        {/* Tab 1: CSV Upload */}
        {tab === 1 && (
          <>
            <Paper elevation={8} sx={{ p: 4, mb: 4, borderRadius: 3, background: '#fff' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>📁 CSV File Upload</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Upload a CSV file with an <code>ip</code> column. Maximum <strong>100 IPs</strong> per file. IPs are processed asynchronously with live progress tracking.
              </Typography>

              {/* Format hint */}
              <Box sx={{ mb: 3, p: 2, background: '#f5f7ff', borderRadius: 2, border: '1px dashed #9fa8da' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#3f51b5', display: 'block', mb: 0.5 }}>Expected CSV format</Typography>
                <code style={{ fontSize: '0.8rem', color: '#555', whiteSpace: 'pre' }}>{'ip\n8.8.8.8\n185.220.101.1\n1.1.1.1'}</code>
              </Box>

              {/* File picker */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <Box
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  border: '2px dashed',
                  borderColor: csvFile ? '#667eea' : '#bdbdbd',
                  borderRadius: 2, p: 4, textAlign: 'center', cursor: 'pointer', mb: 2,
                  transition: 'all 0.2s',
                  background: csvFile ? 'rgba(102,126,234,0.05)' : '#fafafa',
                  '&:hover': { borderColor: '#667eea', background: 'rgba(102,126,234,0.04)' },
                }}
              >
                <UploadFile sx={{ fontSize: 48, color: csvFile ? '#667eea' : '#9e9e9e', mb: 1 }} />
                {csvFile ? (
                  <>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: '#667eea' }}>{csvFile.name}</Typography>
                    <Typography variant="caption" color="text.secondary">({(csvFile.size / 1024).toFixed(1)} KB) — click to change</Typography>
                  </>
                ) : (
                  <>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#555' }}>Click to select a CSV file</Typography>
                    <Typography variant="caption" color="text.secondary">Max file size: 10 MB</Typography>
                  </>
                )}
              </Box>

              {csvError && <Alert severity="error" sx={{ mb: 2 }}>{csvError}</Alert>}

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained" size="large" fullWidth
                  startIcon={csvUploading ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
                  onClick={handleCsvUpload}
                  disabled={csvUploading || !csvFile || csvJob?.status === 'processing'}
                  sx={{
                    py: 2, fontWeight: 700,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': { background: 'linear-gradient(135deg, #5a6fd6 0%, #6a3f91 100%)' },
                  }}
                >
                  {csvUploading ? 'Uploading…' : csvJob?.status === 'processing' ? 'Processing…' : '🚀 Upload & Analyse'}
                </Button>
                {(csvFile || csvJob) && (
                  <Tooltip title="Reset">
                    <IconButton onClick={handleCsvReset} sx={{ border: '1px solid #e0e0e0', borderRadius: 2 }}>
                      <Delete />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Paper>

            {/* Progress bar */}
            {csvJob && (csvJob.status === 'pending' || csvJob.status === 'processing') && (
              <Paper elevation={8} sx={{ p: 4, mb: 4, borderRadius: 3, background: '#fff' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    <HourglassEmpty sx={{ verticalAlign: 'middle', mr: 1, color: '#f57c00' }} />
                    Processing {csvJob.processed} / {csvJob.total} IPs
                  </Typography>
                  <Chip label={csvJob.status.toUpperCase()} color="warning" size="small" sx={{ fontWeight: 700 }} />
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{ height: 10, borderRadius: 5, mb: 1, '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg,#667eea,#764ba2)' } }}
                />
                <Typography variant="caption" color="text.secondary">{progress}% complete</Typography>
              </Paper>
            )}

            {/* Job failure */}
            {csvJob?.status === 'failed' && (
              <Alert severity="error" sx={{ mb: 3 }} action={
                <IconButton size="small" onClick={handleCsvReset}><Refresh /></IconButton>
              }>
                Job failed: {csvJob.error || 'Unknown error'}. Click reset and try again.
              </Alert>
            )}

            {/* Completed results */}
            {csvJob?.status === 'completed' && csvJob.results.length > 0 && (
              <>
                <Alert severity="success" sx={{ mb: 3 }}>
                  ✅ CSV analysis complete — {csvJob.results.length} IP{csvJob.results.length !== 1 ? 's' : ''} processed.
                </Alert>
                <ResultsTable results={csvJob.results} title="CSV Upload Results" source={`CSV Upload: ${csvFile?.name || 'unknown'}`} />
              </>
            )}

            {!csvJob && !csvUploading && (
              <Paper elevation={4} sx={{ p: 6, textAlign: 'center', borderRadius: 3, background: 'rgba(255,255,255,0.95)' }}>
                <UploadFile sx={{ fontSize: 64, color: '#c5cae9', mb: 1 }} />
                <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>No file uploaded yet</Typography>
                <Typography variant="body2" color="text.secondary">
                  Select a CSV file above and click "Upload & Analyse" to start.
                </Typography>
              </Paper>
            )}

            {/* How-to */}
            <Paper elevation={4} sx={{ p: 4, mt: 4, borderRadius: 3, background: '#fff' }}>
              <Divider sx={{ mb: 3 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>📌 How CSV Upload Works</Typography>
              {[
                'Prepare a CSV with an ip column (one IP address per row).',
                'Upload the file — the server queues all IPs for asynchronous processing.',
                'A live progress bar tracks processing across multiple threat intelligence sources.',
                'Once complete, a full results table appears with verdict, risk score, and detection signals.',
                'Use Export CSV to download results for reporting or further analysis.',
              ].map((step, i) => (
                <Typography key={i} variant="body2" sx={{ display: 'flex', gap: 1.5, mb: 1 }}>
                  <span style={{ fontWeight: 700, color: '#667eea', minWidth: 20 }}>{i + 1}.</span>
                  <span>{step}</span>
                </Typography>
              ))}
            </Paper>
          </>
        )}

      </Container>
    </Box>
  );
};

export default BulkAnalysis;
