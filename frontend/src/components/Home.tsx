import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Container,
  Alert,
  CircularProgress,
  Paper,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Divider,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HistoryIcon from '@mui/icons-material/History';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend
} from 'chart.js';

ChartJS.register(ArcElement, ChartTooltip, Legend);

const Home = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [ipAddress, setIpAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [recentSearches, setRecentSearches] = useState<any[]>([]);

  // Load IP from navigation state (from ExamplesGallery)
  useEffect(() => {
    if (location.state?.testIP) {
      setIpAddress(location.state.testIP);
      // Clear the state to prevent re-running
      window.history.replaceState({}, document.title);
      // Automatically trigger analysis
      setTimeout(() => {
        handleAnalyze(location.state.testIP);
      }, 100);
    }
  }, [location.state]);

  // Load recent searches
  useEffect(() => {
    loadRecentSearches();
  }, [result]);

  const loadRecentSearches = () => {
    try {
      const stored = localStorage.getItem('vpn_detection_history');
      if (stored) {
        const history = JSON.parse(stored);
        setRecentSearches(history.slice(0, 4));
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const handleAnalyze = async (ip?: string) => {
    const targetIP = ip || ipAddress;
    if (!targetIP) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/detect/single`, { 
        ip: targetIP 
      });

      setResult(response.data);
      
      // Save to history
      saveToHistory(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to analyze IP address');
    } finally {
      setLoading(false);
    }
  };

  const quickTest = (ip: string) => {
    setIpAddress(ip);
    setError(null);
    setResult(null);
    handleAnalyze(ip);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const saveToHistory = (data: any) => {
    try {
      const historyEntry = {
        ip: data.ip || ipAddress,
        inputDomain: data.inputDomain || null,
        verdict: data.verdict,
        score: data.score,
        threatLevel: data.threatLevel || 'UNKNOWN',
        timestamp: data.timestamp || new Date().toISOString(),
        cached: data.cached || false
      };

      const stored = localStorage.getItem('vpn_detection_history');
      let history = stored ? JSON.parse(stored) : [];
      
      history.unshift(historyEntry);
      
      if (history.length > 100) {
        history = history.slice(0, 100);
      }
      
      localStorage.setItem('vpn_detection_history', JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save to history:', error);
    }
  };

  const getChartData = () => {
    const score = result?.score || 0;
    const trustScore = 100 - score; // Inverted: higher trust = lower threat
    
    return {
      labels: ['Trust Score', 'Threat Score'],
      datasets: [
        {
          data: [trustScore, score],
          backgroundColor: [
            score < 30 ? '#4caf50' : score < 70 ? '#ff9800' : '#f44336',
            '#e0e0e0',
          ],
          borderWidth: 0,
        },
      ],
    };
  };

  const chartOptions = {
    cutout: '75%',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
      },
    },
  };

  return (
    <Box
      sx={{
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
          background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
          pointerEvents: 'none'
        }
      }}
    >
      <Container maxWidth="xl" sx={{ position: 'relative', pt: 12, pb: 8, px: { xs: 2, md: 4 } }}>
        {/* Header */}
        <Box textAlign="center" mb={6}>
          <Typography
            variant="h2"
            gutterBottom
            sx={{
              color: '#ffffff',
              fontWeight: 700,
              letterSpacing: '-1px',
              fontSize: { xs: '2rem', md: '3.5rem' },
              textShadow: '0 2px 20px rgba(0,0,0,0.2)',
              mb: 2
            }}
          >
            🔍 Proxy & VPN Detection Bureau
          </Typography>

          <Typography
            variant="h6"
            sx={{
              color: 'rgba(255,255,255,0.95)',
              fontSize: { xs: '1rem', md: '1.15rem' },
              maxWidth: 750,
              margin: '0 auto 24px',
              fontWeight: 400,
              lineHeight: 1.7,
              textShadow: '0 1px 10px rgba(0,0,0,0.15)'
            }}
          >
            Advanced Cyber Surveillance Platform — Determine whether an IPv4 / IPv6 address is an
            authentic endpoint or a <strong style={{color:'#ffd700'}}>Proxy / VPN-masked</strong> connection,
            and retrieve comprehensive <strong style={{color:'#ffd700'}}>WHOIS intelligence records</strong> for
            any IP address or domain.
          </Typography>

        </Box>

        <Grid container spacing={4} justifyContent="center">
          {/* Main Analysis Panel */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <Paper
              elevation={8}
              sx={{
                p: { xs: 3, md: 5 },
                borderRadius: 4,
                background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                border: '1px solid rgba(255,255,255,0.8)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 4, gap: 1 }}>
                <Typography 
                  variant="h5" 
                  sx={{
                    color: '#1a1a2e',
                    fontWeight: 700,
                    fontSize: { xs: '1.3rem', md: '1.5rem' },
                    textAlign: 'center'
                  }}
                >
                  🔍 Scan IP Address or Domain
                </Typography>
                <Tooltip title="Enter IPv4/IPv6 address or domain name to scan for VPN/Proxy and fetch WHOIS records">
                  <IconButton size="small">
                    <InfoOutlinedIcon sx={{ fontSize: 20, color: '#667eea' }} />
                  </IconButton>
                </Tooltip>
              </Box>

              <Box
                component="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAnalyze();
                }}
              >
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="Enter IPv4, IPv6 or domain (e.g. 91.203.5.165 / google.com)"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      fontFamily: 'monospace',
                      fontSize: '1.1rem',
                      backgroundColor: '#f8f9fa',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        backgroundColor: '#ffffff',
                        boxShadow: '0 4px 12px rgba(102,126,234,0.1)'
                      },
                      '&.Mui-focused': {
                        backgroundColor: '#ffffff',
                        boxShadow: '0 4px 20px rgba(102,126,234,0.2)'
                      }
                    },
                  }}
                  InputProps={{
                    endAdornment: ipAddress && (
                      <Tooltip title="Copy IP">
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(ipAddress)}
                        >
                          <ContentCopyIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    ),
                  }}
                />
                
                <Button
                  variant="contained"
                  size="large"
                  type="submit"
                  fullWidth
                  disabled={loading || !ipAddress}
                  sx={{
                    mt: 3,
                    py: 2,
                    textTransform: 'none',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    boxShadow: '0 8px 24px rgba(102,126,234,0.4)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                      boxShadow: '0 12px 32px rgba(102,126,234,0.5)',
                      transform: 'translateY(-2px)'
                    },
                    '&:active': {
                      transform: 'translateY(0)'
                    }
                  }}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    '� Detect & Fetch WHOIS Records'
                  )}
                </Button>
              </Box>

              {/* Quick Test Examples */}
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <TipsAndUpdatesIcon sx={{ fontSize: 18, color: '#f39c12' }} />
                  <Typography variant="caption" sx={{ color: '#7f8c8d', fontWeight: 600 }}>
                    QUICK TEST EXAMPLES
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {['8.8.8.8', '91.203.5.165', '185.220.101.1', '1.1.1.1'].map((ip) => (
                    <Chip
                      key={ip}
                      label={ip}
                      onClick={() => quickTest(ip)}
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          backgroundColor: '#3498db',
                          color: '#fff',
                          transform: 'translateY(-2px)',
                        },
                      }}
                    />
                  ))}
                </Stack>
              </Box>

              {error && (
                <Alert 
                  severity="error" 
                  sx={{ 
                    mt: 3,
                    borderRadius: 2,
                  }}
                >
                  {error}
                </Alert>
              )}

              {result && (
                <Box sx={{ mt: 4 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      border: '2px solid',
                      borderColor: result.verdict === 'PROXY/VPN' ? '#e74c3c' : '#2ecc71',
                      borderRadius: 3,
                      background: result.verdict === 'PROXY/VPN' 
                        ? 'linear-gradient(135deg, #fff5f5 0%, #ffffff 100%)'
                        : 'linear-gradient(135deg, #f0fff4 0%, #ffffff 100%)',
                    }}
                  >
                    {/* Trust Score Gauge */}
                    <Box sx={{ position: 'relative', width: 220, height: 220, margin: 'auto', mb: 3 }}>
                      <Doughnut data={getChartData()} options={chartOptions} />
                      <Box
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          textAlign: 'center',
                        }}
                      >
                        <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#2c3e50' }}>
                          {100 - result.score}%
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#7f8c8d', fontWeight: 600 }}>
                          TRUST SCORE
                        </Typography>
                      </Box>
                    </Box>

                    {/* Verdict Badge */}
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                      <Chip
                        label={result.verdict === 'PROXY/VPN' ? '⚠️ VPN/Proxy Detected' : '✅ Clean IP Address'}
                        color={result.verdict === 'PROXY/VPN' ? 'error' : 'success'}
                        sx={{ 
                          fontSize: '1rem', 
                          px: 3, 
                          py: 3,
                          fontWeight: 600,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}
                      />
                    </Box>

                    {/* Threat Score */}
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                      <Typography variant="body1" sx={{ color: '#34495e', mb: 1 }}>
                        Threat Score: <strong style={{ fontSize: '1.2rem' }}>{result.score}/100</strong>
                      </Typography>
                      {result.threatLevel && (
                        <Chip
                          label={`${result.threatLevel} RISK LEVEL`}
                          size="medium"
                          color={
                            result.threatLevel === 'HIGH' ? 'error' :
                            result.threatLevel === 'MEDIUM' ? 'warning' :
                            result.threatLevel === 'LOW' ? 'info' : 'success'
                          }
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {/* IP Details */}
                    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: 2, mb: 2 }}>
                      {result.inputDomain && (
                        <Typography variant="body2" sx={{ display: 'block', color: '#34495e', mb: 0.5, fontWeight: 700 }}>
                          🌐 Domain: <span style={{ fontFamily: 'monospace', color: '#8e44ad' }}>{result.inputDomain}</span>
                        </Typography>
                      )}
                      <Typography variant="body2" sx={{ display: 'block', color: '#34495e', mb: 1, fontWeight: 700 }}>
                        📍 {result.inputDomain ? 'Resolved IP' : 'IP Address'}: <span style={{ fontFamily: 'monospace', color: '#3498db' }}>{result.ip || ipAddress}</span>
                      </Typography>
                      {result.timestamp && (
                        <Typography variant="caption" sx={{ color: '#95a5a6' }}>
                          🕐 Analyzed: {new Date(result.timestamp).toLocaleString()}
                        </Typography>
                      )}
                      {result.cached && (
                        <Box sx={{ mt: 1 }}>
                          <Chip label="⚡ Cached Result (Instant)" size="small" variant="outlined" color="info" sx={{ fontWeight: 600 }} />
                        </Box>
                      )}
                    </Box>

                    {/* WHOIS Intelligence */}
                    {result.whois?.parsed && Object.keys(result.whois.parsed).length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#2c3e50', mb: 1 }}>
                          🌐 WHOIS Intelligence Records
                        </Typography>
                        <Box sx={{ bgcolor: '#eaf4fb', p: 2, borderRadius: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
                          {result.whois.parsed.organization && (
                            <Typography variant="caption" sx={{ color: '#2c3e50', gridColumn: '1 / -1' }}>
                              🏢 <strong>Organization / ISP:</strong> {result.whois.parsed.organization}
                            </Typography>
                          )}
                          {result.whois.parsed.registrant && (
                            <Typography variant="caption" sx={{ color: '#2c3e50' }}>
                              👤 <strong>Registrant:</strong> {result.whois.parsed.registrant}
                            </Typography>
                          )}
                          {result.whois.parsed.registrar && (
                            <Typography variant="caption" sx={{ color: '#2c3e50' }}>
                              🏛️ <strong>Registrar:</strong> {result.whois.parsed.registrar}
                            </Typography>
                          )}
                          {result.whois.parsed.netname && (
                            <Typography variant="caption" sx={{ color: '#2c3e50' }}>
                              🔗 <strong>Network Name:</strong> {result.whois.parsed.netname}
                            </Typography>
                          )}
                          {result.whois.parsed.inetnum && (
                            <Typography variant="caption" sx={{ color: '#2c3e50' }}>
                              🌐 <strong>IP Range:</strong> {result.whois.parsed.inetnum}
                            </Typography>
                          )}
                          {result.whois.parsed.description && (
                            <Typography variant="caption" sx={{ color: '#2c3e50' }}>
                              📝 <strong>Description:</strong> {result.whois.parsed.description}
                            </Typography>
                          )}
                          {result.whois.parsed.country && (
                            <Typography variant="caption" sx={{ color: '#2c3e50' }}>
                              🌍 <strong>Country:</strong> {result.whois.parsed.country}
                            </Typography>
                          )}
                          {result.whois.parsed.city && (
                            <Typography variant="caption" sx={{ color: '#2c3e50' }}>
                              📍 <strong>City:</strong> {result.whois.parsed.city}{result.whois.parsed.state ? `, ${result.whois.parsed.state}` : ''}
                            </Typography>
                          )}
                          {result.whois.parsed.asn && (
                            <Typography variant="caption" sx={{ color: '#2c3e50' }}>
                              🔢 <strong>AS Number:</strong> {result.whois.parsed.asn}
                            </Typography>
                          )}
                          {result.whois.parsed.asnName && (
                            <Typography variant="caption" sx={{ color: '#2c3e50' }}>
                              🏷️ <strong>AS Name:</strong> {result.whois.parsed.asnName}
                            </Typography>
                          )}
                          {result.whois.parsed.email && (
                            <Typography variant="caption" sx={{ color: '#2c3e50' }}>
                              ✉️ <strong>Abuse Contact:</strong> {result.whois.parsed.email}
                            </Typography>
                          )}
                          {result.whois.parsed.created && (
                            <Typography variant="caption" sx={{ color: '#2c3e50' }}>
                              📅 <strong>Registered:</strong> {new Date(result.whois.parsed.created).toLocaleDateString()}
                            </Typography>
                          )}
                          {result.whois.parsed.updated && (
                            <Typography variant="caption" sx={{ color: '#2c3e50' }}>
                              🔄 <strong>Updated:</strong> {new Date(result.whois.parsed.updated).toLocaleDateString()}
                            </Typography>
                          )}
                          {result.whois.parsed.domainAge && (
                            <Typography variant="caption" sx={{ color: '#2c3e50' }}>
                              ⏳ <strong>Domain Age:</strong> {result.whois.parsed.domainAge}
                            </Typography>
                          )}
                          {result.whois.source && (
                            <Typography variant="caption" sx={{ color: '#95a5a6', gridColumn: '1 / -1', fontStyle: 'italic', mt: 0.5 }}>
                              📡 Source: {result.whois.source}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    )}

                    {/* Analysis Flags */}
                    {result.analysis && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#2c3e50', mb: 1 }}>
                          🔬 Detection Analysis
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip size="small" label={`Proxy: ${result.analysis.isProxy ? 'Yes' : 'No'}`} color={result.analysis.isProxy ? 'error' : 'success'} variant="outlined" sx={{ fontWeight: 600 }} />
                          <Chip size="small" label={`VPN: ${result.analysis.isVPN ? 'Yes' : 'No'}`} color={result.analysis.isVPN ? 'error' : 'success'} variant="outlined" sx={{ fontWeight: 600 }} />
                          <Chip size="small" label={`Tor: ${result.analysis.isTor ? 'Yes' : 'No'}`} color={result.analysis.isTor ? 'error' : 'success'} variant="outlined" sx={{ fontWeight: 600 }} />
                          <Chip size="small" label={`Hosting: ${result.analysis.isHosting ? 'Yes' : 'No'}`} color={result.analysis.isHosting ? 'warning' : 'success'} variant="outlined" sx={{ fontWeight: 600 }} />
                        </Stack>
                      </Box>
                    )}

                    {/* Detection Checks */}
                    {result.checks && result.checks.length > 0 && (
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#2c3e50', mb: 1 }}>
                          🔒 Security Checks ({result.checks.length} methods)
                        </Typography>
                        <Stack spacing={0.75}>
                          {result.checks.map((check: any, i: number) => (
                            <Box
                              key={i}
                              sx={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 1,
                                p: 1,
                                borderRadius: 1,
                                bgcolor: check.result ? 'rgba(231,76,60,0.06)' : 'rgba(46,204,113,0.06)',
                                border: '1px solid',
                                borderColor: check.result ? 'rgba(231,76,60,0.2)' : 'rgba(46,204,113,0.2)',
                              }}
                            >
                              <Typography variant="caption" sx={{ minWidth: 16 }}>
                                {check.result ? '🔴' : '🟢'}
                              </Typography>
                              <Box>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#2c3e50', display: 'block' }}>
                                  {check.type}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#7f8c8d' }}>
                                  {check.details}
                                </Typography>
                              </Box>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Paper>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Sidebar: Recent Searches & Tips */}
          <Grid size={{ xs: 12, lg: 4 }}>
            {/* Recent Searches */}
            <Paper
              elevation={4}
              sx={{
                p: 3,
                borderRadius: 3,
                mb: 3,
                background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                border: '1px solid rgba(102,126,234,0.1)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <HistoryIcon sx={{ fontSize: 22, color: '#667eea' }} />
                <Typography variant="h6" sx={{ color: '#1a1a2e', fontWeight: 700, fontSize: '1.1rem' }}>
                  Recent Searches
                </Typography>
              </Box>
              
              {recentSearches.length > 0 ? (
                <Stack spacing={2}>
                  {recentSearches.map((search, index) => (
                    <Card
                      key={index}
                      elevation={0}
                      sx={{
                        border: '1px solid #e8eaf6',
                        cursor: 'pointer',
                        borderRadius: 2,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          borderColor: '#667eea',
                          transform: 'translateX(6px)',
                          boxShadow: '0 4px 16px rgba(102,126,234,0.2)',
                          backgroundColor: '#f8f9ff'
                        },
                      }}
                      onClick={() => quickTest(search.ip)}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'monospace',
                            color: '#1a1a2e',
                            fontWeight: 700,
                            mb: 1,
                            fontSize: '0.95rem'
                          }}
                        >
                          {search.ip}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={search.verdict}
                            size="small"
                            color={search.verdict === 'PROXY/VPN' ? 'error' : 'success'}
                            sx={{ fontSize: '0.7rem', height: 20, fontWeight: 600 }}
                          />
                          <Typography variant="caption" sx={{ color: '#95a5a6', fontSize: '0.75rem', fontWeight: 500 }}>
                            Score: {search.score}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                  <Button
                    size="medium"
                    onClick={() => navigate('/history')}
                    sx={{ 
                      textTransform: 'none', 
                      color: '#667eea', 
                      fontWeight: 700,
                      '&:hover': {
                        backgroundColor: 'rgba(102,126,234,0.08)'
                      }
                    }}
                  >
                    View All History →
                  </Button>
                </Stack>
              ) : (
                <Typography variant="body2" sx={{ color: '#95a5a6', fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                  No recent searches yet
                </Typography>
              )}
            </Paper>

            {/* Quick Tips */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                border: '1px solid #e8f5e9',
                borderRadius: 3,
                background: 'linear-gradient(135deg, #f0fff4 0%, #ffffff 100%)',
              }}
            >
              <Typography variant="h6" sx={{ color: '#27ae60', fontWeight: 600, fontSize: '1rem', mb: 2 }}>
                💡 Quick Tips
              </Typography>
              <Stack spacing={1.5}>
                <Typography variant="caption" sx={{ color: '#34495e', display: 'block' }}>
                  • Supports both <strong>IPv4</strong> and <strong>IPv6</strong> addresses
                </Typography>
                <Typography variant="caption" sx={{ color: '#34495e', display: 'block' }}>
                  • Higher threat scores indicate <strong>VPN/Proxy</strong> usage
                </Typography>
                <Typography variant="caption" sx={{ color: '#34495e', display: 'block' }}>
                  • Results are <strong>cached</strong> for faster repeated queries
                </Typography>
                <Typography variant="caption" sx={{ color: '#34495e', display: 'block' }}>
                  • Visit <strong>Examples</strong> page for more test cases
                </Typography>
              </Stack>
              <Button
                size="small"
                fullWidth
                onClick={() => navigate('/examples')}
                sx={{
                  mt: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  color: '#27ae60',
                  borderColor: '#27ae60',
                }}
                variant="outlined"
              >
                View Examples Gallery
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Home;