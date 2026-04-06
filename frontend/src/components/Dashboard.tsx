import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Divider,
  Alert,
  Button,
} from '@mui/material';
import {
  Speed,
  CheckCircle,
  Error,
  Refresh,
} from '@mui/icons-material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HistoryIcon from '@mui/icons-material/History';
import Tooltip from '@mui/material/Tooltip';

interface HistoryEntry {
  ip: string;
  inputDomain?: string | null;
  verdict: string;
  score: number;
  threatLevel: string;
  timestamp: string;
}

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalChecks: 0,
    vpnDetected: 0,
    cleanIPs: 0,
    avgScore: 0,
    threatDistribution: { CLEAN: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    topRiskIPs: [] as Array<{ ip: string; inputDomain?: string | null; verdict: string; timestamp: string; score: number; threatLevel: string }>,
    recentHistory: [] as HistoryEntry[],
  });

  const loadStats = () => {
    const stored = localStorage.getItem('vpn_detection_history');
    console.log('📊 Dashboard loading data...', stored ? `Found ${JSON.parse(stored).length} entries` : 'No data');
    
    if (!stored) {
      setStats({
        totalChecks: 0,
        vpnDetected: 0,
        cleanIPs: 0,
        avgScore: 0,
        threatDistribution: { CLEAN: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
        topRiskIPs: [],
        recentHistory: [],
      });
      return;
    }

    const history: HistoryEntry[] = JSON.parse(stored);
    console.log('📊 Dashboard parsed history:', history.length, 'entries');
    
    const vpnCount = history.filter(h => h.verdict === 'PROXY/VPN').length;
    const totalScore = history.reduce((sum, h) => sum + h.score, 0);
    
    const threatDist = {
      CLEAN: history.filter(h => h.score < 30).length,
      LOW: history.filter(h => h.score >= 30 && h.score < 50).length,
      MEDIUM: history.filter(h => h.score >= 50 && h.score < 70).length,
      HIGH: history.filter(h => h.score >= 70 && h.score < 90).length,
      CRITICAL: history.filter(h => h.score >= 90).length,
    };

    const highRisk = history
      .filter(h => h.score >= 70)
      .slice(0, 10)
      .map(h => ({ ip: h.ip, inputDomain: h.inputDomain, verdict: h.verdict, timestamp: h.timestamp, score: h.score, threatLevel: h.threatLevel || 'HIGH' }));

    const newStats = {
      totalChecks: history.length,
      vpnDetected: vpnCount,
      cleanIPs: history.length - vpnCount,
      avgScore: history.length > 0 ? totalScore / history.length : 0,
      threatDistribution: threatDist,
      topRiskIPs: highRisk,
      recentHistory: history.slice(0, 15),
    };
    
    console.log('📊 Dashboard updated stats:', newStats);
    setStats(newStats);
  };

  useEffect(() => {
    // Load on mount
    loadStats();

    // Listen for localStorage changes from other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'vpn_detection_history') {
        loadStats();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Also poll for changes every 2 seconds (for same-tab updates)
    const interval = setInterval(loadStats, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative',
      overflow: 'hidden',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 70% 30%, rgba(255,255,255,0.1) 0%, transparent 50%)',
        pointerEvents: 'none'
      },
      pt: 12,
      pb: 6,
      px: { xs: 2, md: 4 }
    }}>
      <Container maxWidth="xl" sx={{ position: 'relative' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 5 }}>
        <Box sx={{ textAlign: 'center', flex: 1 }}>
          <Typography 
            variant="h2" 
            sx={{
              color: '#ffffff',
              fontWeight: 700,
              fontSize: { xs: '2rem', md: '3rem' },
              textShadow: '0 2px 20px rgba(0,0,0,0.2)',
              mb: 1
            }}
          >
            📊 Analytics Dashboard
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              color: 'rgba(255,255,255,0.95)',
              fontSize: { xs: '1rem', md: '1.1rem' },
              textShadow: '0 1px 10px rgba(0,0,0,0.15)'
            }}
          >
            Real-time statistics and comprehensive detection insights
          </Typography>
        </Box>
        <Button 
          variant="contained"
          startIcon={<Refresh />}
          onClick={loadStats}
          sx={{
            background: 'rgba(255,255,255,0.95)',
            color: '#667eea',
            fontWeight: 700,
            px: 3,
            py: 1,
            borderRadius: 2,
            textTransform: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            '&:hover': {
              background: '#ffffff',
              boxShadow: '0 6px 20px rgba(0,0,0,0.2)'
            }
          }}
        >
          Refresh
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        spacing={2} 
        sx={{ mb: 4, flexWrap: 'wrap' }}
      >
        <Card elevation={2} sx={{ flex: { sm: '1 1 45%', md: '1 1 22%' }, minWidth: 180 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h4" fontWeight="bold">
                  {stats.totalChecks}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Checks
                </Typography>
              </Box>
              <AssessmentIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            </Box>
          </CardContent>
        </Card>

        <Card elevation={2} sx={{ flex: { sm: '1 1 45%', md: '1 1 22%' }, minWidth: 180 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h4" fontWeight="bold" color="error.main">
                  {stats.vpnDetected}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  VPNs Detected
                </Typography>
              </Box>
              <Error sx={{ fontSize: 40, color: 'error.main' }} />
            </Box>
          </CardContent>
        </Card>

        <Card elevation={2} sx={{ flex: { sm: '1 1 45%', md: '1 1 22%' }, minWidth: 180 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h4" fontWeight="bold" color="success.main">
                  {stats.cleanIPs}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Clean IPs
                </Typography>
              </Box>
              <CheckCircle sx={{ fontSize: 40, color: 'success.main' }} />
            </Box>
          </CardContent>
        </Card>

        <Card elevation={2} sx={{ flex: { sm: '1 1 45%', md: '1 1 22%' }, minWidth: 180 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h4" fontWeight="bold" color="warning.main">
                  {stats.avgScore.toFixed(1)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg Threat Score
                </Typography>
              </Box>
              <Speed sx={{ fontSize: 40, color: 'warning.main' }} />
            </Box>
          </CardContent>
        </Card>
      </Stack>

      {/* Detection Insights */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mb: 4 }}>
        <Paper sx={{ p: 3, flex: 1 }}>
          <Typography variant="h6" gutterBottom>
            🎯 Detection Accuracy
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2">VPN Detection Rate</Typography>
              <Typography variant="body2" fontWeight="bold">
                {stats.totalChecks > 0 ? ((stats.vpnDetected / stats.totalChecks) * 100).toFixed(1) : 0}%
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2">Clean IP Rate</Typography>
              <Typography variant="body2" fontWeight="bold" color="success.main">
                {stats.totalChecks > 0 ? ((stats.cleanIPs / stats.totalChecks) * 100).toFixed(1) : 0}%
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2">High-Risk Detections</Typography>
              <Typography variant="body2" fontWeight="bold" color="error.main">
                {stats.topRiskIPs.length}
              </Typography>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="caption">
                Average threat score: <strong>{stats.avgScore.toFixed(1)}/100</strong>
                <br />
                {stats.avgScore < 30 && 'Most IPs are legitimate ✅'}
                {stats.avgScore >= 30 && stats.avgScore < 60 && 'Mixed traffic detected ⚠️'}
                {stats.avgScore >= 60 && 'High VPN/proxy activity 🚨'}
              </Typography>
            </Alert>
          </Box>
        </Paper>

        <Paper sx={{ p: 3, flex: 1 }}>
          <Typography variant="h6" gutterBottom>
            📈 Recent Activity
          </Typography>
          <Box sx={{ mt: 2 }}>
            {stats.topRiskIPs.length === 0 && stats.totalChecks === 0 ? (
              <Alert severity="info">
                No detections yet. Start by checking some IPs on the Home or Examples page!
              </Alert>
            ) : (
              <Stack spacing={1.5}>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: stats.vpnDetected > stats.cleanIPs ? 'error.50' : 'success.50' }}>
                  <Typography variant="body2" fontWeight="bold">
                    {stats.vpnDetected > stats.cleanIPs ? '⚠️ High VPN Activity' : '✅ Mostly Clean Traffic'}
                  </Typography>
                  <Typography variant="caption">
                    {stats.vpnDetected} VPNs detected out of {stats.totalChecks} total checks
                  </Typography>
                </Paper>
                
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" fontWeight="bold">
                    🔍 Detection Methods Used
                  </Typography>
                  <Typography variant="caption">
                    Database matching, WHOIS analysis, port scanning, ML algorithms, 
                    behavioral patterns, reputation checks, anomaly detection
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.50' }}>
                  <Typography variant="body2" fontWeight="bold">
                    💾 History Stored
                  </Typography>
                  <Typography variant="caption">
                    Up to 100 recent checks saved locally for analysis
                  </Typography>
                </Paper>
              </Stack>
            )}
          </Box>
        </Paper>
      </Stack>

      {/* Top Risk IPs */}
      {stats.topRiskIPs.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Error color="error" sx={{ verticalAlign: 'middle' }} />
            Recent High-Risk Detections
            <Chip label={`${stats.topRiskIPs.length} flagged`} size="small" color="error" sx={{ ml: 1, fontWeight: 700 }} />
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            IPs and domains with a threat score of 70 or higher from your recent scans. These addresses were identified as probable VPN, proxy, or anonymisation services.
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ background: 'linear-gradient(90deg,#c62828,#e53935)' }}>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>#</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>IP / Domain</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Verdict</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }} align="center">Threat Score</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }} align="center">Severity</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Detected At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.topRiskIPs.map((item, index) => (
                  <TableRow key={index} sx={{ '&:nth-of-type(odd)': { background: 'rgba(198,40,40,0.03)' }, '&:hover': { background: 'rgba(198,40,40,0.07)' } }}>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{index + 1}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.92rem', color: '#1a1a2e' }}>
                      {item.inputDomain && (
                        <Typography variant="caption" sx={{ color: '#8e44ad', fontFamily: 'monospace', display: 'block', fontSize: '0.75rem', lineHeight: 1.2 }}>
                          🌐 {item.inputDomain}
                        </Typography>
                      )}
                      {item.ip || '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.verdict || 'PROXY/VPN'}
                        color="error"
                        size="small"
                        sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                        <Box sx={{ width: 60, height: 7, borderRadius: 4, background: '#f5f5f5', overflow: 'hidden' }}>
                          <Box sx={{
                            width: `${item.score}%`, height: '100%', borderRadius: 4,
                            background: item.score >= 90 ? '#b71c1c' : '#e53935',
                          }} />
                        </Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: item.score >= 90 ? '#b71c1c' : '#e53935', minWidth: 40 }}>
                          {item.score}/100
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={item.score >= 90 ? 'CRITICAL' : 'HIGH'}
                        color={item.score >= 90 ? 'error' : 'warning'}
                        size="small"
                        sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                      {new Date(item.timestamp).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Detection History */}
      {stats.recentHistory.length > 0 && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon sx={{ color: '#667eea' }} />
            Detection History
            <Chip label={`${stats.totalChecks} total`} size="small" color="primary" variant="outlined" sx={{ ml: 1, fontWeight: 700 }} />
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your most recent IP and domain scans. Visit the History page for full records and CSV export.
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'rgba(102,126,234,0.08)' }}>
                  <TableCell sx={{ fontWeight: 700 }}>📍 IP / Domain</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>🎯 Verdict</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>💯 Score</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>⚡ Threat Level</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>🕐 Timestamp</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Cache</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.recentHistory.map((entry, index) => (
                  <TableRow key={index} hover sx={{ '&:hover': { bgcolor: 'rgba(102,126,234,0.04)' } }}>
                    <TableCell>
                      {entry.inputDomain && (
                        <Typography variant="caption" sx={{ color: '#8e44ad', fontFamily: 'monospace', display: 'block', fontSize: '0.75rem', lineHeight: 1.3 }}>
                          🌐 {entry.inputDomain}
                        </Typography>
                      )}
                      <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                        {entry.ip}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={entry.verdict}
                        color={entry.verdict === 'PROXY/VPN' ? 'error' : 'success'}
                        size="small"
                        sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" fontWeight="bold" color={entry.score >= 70 ? 'error.main' : entry.score >= 40 ? 'warning.main' : 'success.main'}>
                        {entry.score}%
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={entry.threatLevel}
                        color={entry.threatLevel === 'HIGH' || entry.threatLevel === 'CRITICAL' ? 'error' : entry.threatLevel === 'MEDIUM' ? 'warning' : entry.threatLevel === 'LOW' ? 'info' : 'success'}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(entry.timestamp).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {(entry as any).cached && (
                        <Tooltip title="Loaded from cache">
                          <Chip label="⚡" size="small" />
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
            Showing {stats.recentHistory.length} of {stats.totalChecks} total entries
          </Typography>
        </Paper>
      )}
      </Container>
    </Box>
  );
};

export default Dashboard;
