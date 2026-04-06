import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  TextField,
  MenuItem,
  Stack,
  Tooltip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import HistoryIcon from '@mui/icons-material/History';

interface HistoryEntry {
  ip: string;
  inputDomain?: string | null;
  verdict: string;
  score: number;
  threatLevel: string;
  timestamp: string;
  cached?: boolean;
}

const HistoryView = () => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryEntry[]>([]);
  const [verdictFilter, setVerdictFilter] = useState<string>('ALL');

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, verdictFilter]);

  const loadHistory = () => {
    try {
      const stored = localStorage.getItem('vpn_detection_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        setHistory(parsed);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...history];
    
    if (verdictFilter !== 'ALL') {
      filtered = filtered.filter(entry => entry.verdict === verdictFilter);
    }
    
    // Sort by timestamp descending (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    setFilteredHistory(filtered);
  };

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all history?')) {
      localStorage.removeItem('vpn_detection_history');
      setHistory([]);
      // Trigger storage event for Dashboard to update
      window.dispatchEvent(new Event('storage'));
    }
  };

  const exportToCSV = () => {
    if (filteredHistory.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = ['IP Address', 'Verdict', 'Score', 'Threat Level', 'Timestamp'];
    const rows = filteredHistory.map(entry => [
      entry.ip,
      entry.verdict,
      entry.score,
      entry.threatLevel,
      entry.timestamp
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vpn-detection-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'CLEAN': return 'success';
      case 'SUSPICIOUS': return 'warning';
      case 'VPN_DETECTED': return 'error';
      default: return 'default';
    }
  };

  const getThreatColor = (threat: string) => {
    switch (threat) {
      case 'CLEAN': return 'success';
      case 'LOW': return 'info';
      case 'MEDIUM': return 'warning';
      case 'HIGH': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        pt: 6,
        pb: 6,
      }}
    >
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography
            variant="h2"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '2rem', md: '3rem' },
              color: 'white',
              textShadow: '0 4px 12px rgba(0,0,0,0.2)',
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <HistoryIcon sx={{ fontSize: { xs: '2rem', md: '3rem' } }} /> Lookup History
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: 'rgba(255,255,255,0.95)',
              fontWeight: 300,
            }}
          >
            Review all your previous IP scans and detection results
          </Typography>
        </Box>

        <Paper
          elevation={8}
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }} flexWrap="wrap" gap={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <HistoryIcon sx={{ fontSize: 32, color: '#667eea' }} />
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Detection History
              </Typography>
            </Stack>
            
            <Stack direction="row" spacing={2}>
              <TextField
                select
                size="small"
                value={verdictFilter}
                onChange={(e) => setVerdictFilter(e.target.value)}
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="ALL">All Results</MenuItem>
                <MenuItem value="ORIGINAL">Clean / Original</MenuItem>
                <MenuItem value="PROXY/VPN">VPN / Proxy</MenuItem>
              </TextField>
              
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={exportToCSV}
                disabled={filteredHistory.length === 0}
                sx={{
                  borderColor: '#667eea',
                  color: '#667eea',
                  '&:hover': { borderColor: '#764ba2', color: '#764ba2', bgcolor: 'rgba(102,126,234,0.04)' },
                }}
              >
                Export CSV
              </Button>
              
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={clearHistory}
                disabled={history.length === 0}
              >
                Clear All
              </Button>
            </Stack>
          </Stack>

          {filteredHistory.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <HistoryIcon sx={{ fontSize: 60, color: '#ddd', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                {history.length === 0 ? 'No history yet' : 'No results match the filter'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {history.length === 0 ? 'IP lookups will appear here automatically' : 'Try changing the filter'}
              </Typography>
            </Box>
          ) : (
            <>
            <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'rgba(102, 126, 234, 0.08)' }}>
                      <TableCell sx={{ fontWeight: 700 }}>📍 IP Address</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>🎯 Verdict</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>💯 Score</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>⚡ Threat Level</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>🕐 Timestamp</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Cache</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredHistory.map((entry, index) => (
                      <TableRow
                        key={index}
                        hover
                        sx={{
                          '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.04)' },
                          transition: 'background-color 0.2s',
                        }}
                      >
                        <TableCell>
                          {entry.inputDomain && (
                            <Typography variant="caption" sx={{ color: '#8e44ad', fontFamily: 'monospace', display: 'block', lineHeight: 1.2 }}>
                              🌐 {entry.inputDomain}
                            </Typography>
                          )}
                          <Typography variant="body2" fontFamily="monospace">
                            {entry.ip}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={entry.verdict.replace('_', ' ')}
                            color={getVerdictColor(entry.verdict)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" fontWeight="bold">
                            {entry.score}%
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={entry.threatLevel}
                            color={getThreatColor(entry.threatLevel)}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {new Date(entry.timestamp).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {entry.cached && (
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
              
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                Showing {filteredHistory.length} of {history.length} total entries
              </Typography>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default HistoryView;
