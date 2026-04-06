import { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  Paper,
  Divider,
  Stack,
  Alert,
} from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { useNavigate } from 'react-router-dom';

const ExamplesGallery = () => {
  const navigate = useNavigate();
  const [recentSearches, setRecentSearches] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('vpn_detection_history');
      return stored ? JSON.parse(stored).slice(0, 6) : [];
    } catch {
      return [];
    }
  });

  const exampleIPs = [
    {
      ip: '8.8.8.8',
      type: 'Clean IP',
      description: 'Google Public DNS - Legitimate',
      expected: 'CLEAN',
      icon: <CheckCircleIcon />,
      color: '#4caf50',
      category: 'Public DNS',
    },
    {
      ip: '1.1.1.1',
      type: 'Clean IP',
      description: 'Cloudflare DNS - Safe',
      expected: 'CLEAN',
      icon: <CheckCircleIcon />,
      color: '#4caf50',
      category: 'Public DNS',
    },
    {
      ip: '185.220.101.1',
      type: 'Proxy/VPN',
      description: 'Known Tor Exit Node',
      expected: 'PROXY/VPN',
      icon: <VpnLockIcon />,
      color: '#f44336',
      category: 'Tor Network',
    },
    {
      ip: '104.238.154.191',
      type: 'Suspicious',
      description: 'VPN Provider IP',
      expected: 'PROXY/VPN',
      icon: <WarningIcon />,
      color: '#ff9800',
      category: 'VPN Service',
    },
    {
      ip: '2001:4860:4860::8888',
      type: 'Clean IPv6',
      description: 'Google DNS (IPv6)',
      expected: 'CLEAN',
      icon: <PublicIcon />,
      color: '#2196f3',
      category: 'IPv6 DNS',
    },
    {
      ip: '91.203.5.165',
      type: 'Proxy/VPN',
      description: 'NordVPN Server',
      expected: 'PROXY/VPN',
      icon: <VpnLockIcon />,
      color: '#f44336',
      category: 'VPN Service',
    },
  ];

  const handleTestIP = (ip: string) => {
    navigate('/', { state: { testIP: ip } });
  };

  const clearHistory = () => {
    localStorage.removeItem('vpn_detection_history');
    setRecentSearches([]);
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)',
        pointerEvents: 'none'
      },
      pt: 12, 
      pb: 6 
    }}>
      <Container maxWidth="xl" sx={{ position: 'relative', px: { xs: 2, md: 4 } }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography
            variant="h2"
            sx={{
              color: '#ffffff',
              fontWeight: 700,
              mb: 2,
              fontSize: { xs: '2rem', md: '3rem' },
              textShadow: '0 2px 20px rgba(0,0,0,0.2)',
              letterSpacing: '-0.5px'
            }}
          >
            🧪 Test IP Examples Gallery
          </Typography>
          <Typography variant="h6" sx={{ 
            color: 'rgba(255,255,255,0.95)', 
            fontSize: { xs: '1rem', md: '1.1rem' },
            maxWidth: 700,
            margin: '0 auto',
            textShadow: '0 1px 10px rgba(0,0,0,0.15)'
          }}>
            Comprehensive test cases to understand VPN, Proxy, and Tor detection capabilities
          </Typography>
        </Box>

        {/* Recent Searches Section */}
        {recentSearches.length > 0 && (
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 4,
              border: '1px solid #e0e0e0',
              borderRadius: 2,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Typography
                variant="h6"
                sx={{ color: '#555', fontWeight: 500, fontSize: '1rem' }}
              >
                📋 Recent Searches
              </Typography>
              <Button
                size="small"
                onClick={clearHistory}
                sx={{ textTransform: 'none', color: '#999' }}
              >
                Clear All
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              {recentSearches.map((search, index) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                  <Card
                    elevation={0}
                    sx={{
                      border: '1px solid #f0f0f0',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: '#1976d2',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      },
                    }}
                    onClick={() => handleTestIP(search.ip)}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          color: '#333',
                          fontWeight: 500,
                          mb: 1,
                        }}
                      >
                        {search.ip}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={search.verdict}
                          size="small"
                          color={
                            search.verdict === 'PROXY/VPN' ? 'error' : 'success'
                          }
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                        <Typography
                          variant="caption"
                          sx={{ color: '#999', fontSize: '0.7rem' }}
                        >
                          Score: {search.score}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="caption"
                        sx={{ color: '#bbb', display: 'block', mt: 1 }}
                      >
                        {new Date(search.timestamp).toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        )}

        {/* Example IPs Grid */}
        <Paper
          elevation={0}
          sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}
        >
          <Typography
            variant="h6"
            sx={{ color: '#555', fontWeight: 500, mb: 3, fontSize: '1rem' }}
          >
            🧪 Test Cases
          </Typography>
          <Grid container spacing={2}>
            {exampleIPs.map((example, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                <Card
                  elevation={0}
                  sx={{
                    border: '1px solid #e0e0e0',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: example.color,
                      transform: 'translateY(-4px)',
                      boxShadow: `0 8px 16px ${example.color}15`,
                    },
                  }}
                  onClick={() => handleTestIP(example.ip)}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 2,
                      }}
                    >
                      <Box sx={{ color: example.color }}>{example.icon}</Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ color: '#333', fontWeight: 600 }}
                      >
                        {example.type}
                      </Typography>
                    </Box>

                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        color: '#1976d2',
                        mb: 1,
                        fontSize: '0.9rem',
                        fontWeight: 500,
                      }}
                    >
                      {example.ip}
                    </Typography>

                    <Typography
                      variant="caption"
                      sx={{ color: '#666', display: 'block', mb: 2 }}
                    >
                      {example.description}
                    </Typography>

                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Chip
                        label={example.category}
                        size="small"
                        sx={{
                          bgcolor: `${example.color}15`,
                          color: example.color,
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          border: 'none',
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{ color: '#999', fontSize: '0.65rem' }}
                      >
                        Expected: {example.expected}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>

        {/* Help Section */}
        <Alert
          severity="info"
          sx={{
            mt: 4,
            border: '1px solid #e3f2fd',
            bgcolor: '#f5f5f5',
            '& .MuiAlert-icon': {
              color: '#1976d2',
            },
          }}
        >
          <Typography variant="body2" sx={{ color: '#555' }}>
            <strong>Tip:</strong> Click any IP address to run an immediate
            analysis on the home page. Recent searches are saved automatically.
          </Typography>
        </Alert>
      </Container>
    </Box>
  );
};

export default ExamplesGallery;