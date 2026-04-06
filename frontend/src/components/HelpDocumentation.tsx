import { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Chip,
  Card,
  CardContent,
  Stack,
 } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import CloudIcon from '@mui/icons-material/Cloud';

const HelpDocumentation = () => {
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
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
            ❓ Help & Documentation
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: 'rgba(255,255,255,0.95)',
              fontWeight: 300,
            }}
          >
            Everything you need to know about VPN detection
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Quick Start */}
      <Accordion
        expanded={expanded === 'panel1'}
        onChange={handleChange('panel1')}
        elevation={8}
        sx={{ borderRadius: '12px !important', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>🚀 Quick Start Guide</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            Welcome to the VPN Detection System! Here's how to get started:
          </Typography>
          <Box component="ol" sx={{ pl: 2 }}>
            <li><strong>Home Page:</strong> Enter an IPv4 address, IPv6 address, or domain name to analyze instantly</li>
            <li><strong>Bulk Analysis:</strong> Upload a CSV file or paste multiple IPs/domains for batch processing (max 100)</li>
            <li><strong>History:</strong> Review all your previous scans and their results</li>
            <li><strong>Dashboard:</strong> View analytics and statistics from your detection history</li>
            <li><strong>Examples:</strong> Try pre-configured examples including IPv6 and domains</li>
          </Box>
          
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 3, mb: 1 }}>
            ✨ Supported Input Formats:
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
            <Typography variant="body2" fontFamily="monospace">
              <strong>IPv4:</strong> 8.8.8.8<br/>
              <strong>IPv6:</strong> 2001:4860:4860::8888<br/>
              <strong>Domain:</strong> google.com
            </Typography>
          </Paper>
          
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 3, mb: 1 }}>
            💡 CSV Upload Format:
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Typography variant="body2" fontFamily="monospace">
              8.8.8.8<br/>
              2001:4860:4860::8888<br/>
              google.com<br/>
              104.18.0.1
            </Typography>
          </Paper>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Mix IPv4, IPv6, and domains. Place addresses in the first column. Additional columns are ignored. Header row is optional.
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* Understanding Results */}
      <Accordion
        expanded={expanded === 'panel2'}
        onChange={handleChange('panel2')}
        elevation={8}
        sx={{ borderRadius: '12px !important', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>📊 Understanding Detection Results</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Typography variant="subtitle1" fontWeight="bold">
              Verdict Types:
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Card variant="outlined" sx={{ flex: 1 }}>
                <CardContent>
                  <Chip label="CLEAN/ORIGINAL" color="success" sx={{ mb: 1 }} />
                  <Typography variant="body2">
                    The IP appears to be a genuine connection from a residential or business ISP. 
                    Low probability of VPN/proxy usage.
                  </Typography>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ flex: 1 }}>
                <CardContent>
                  <Chip label="PROXY/VPN" color="error" sx={{ mb: 1 }} />
                  <Typography variant="body2">
                    The IP has been identified as belonging to a VPN service, proxy server, 
                    or anonymization network.
                  </Typography>
                </CardContent>
              </Card>
            </Stack>

            <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2 }}>
              Threat Levels (0-100 Score):
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip label="CLEAN" color="success" size="small" />
                <Typography variant="body2">Score 0-30: Minimal threat, likely legitimate</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip label="LOW" color="info" size="small" />
                <Typography variant="body2">Score 30-50: Minor indicators detected</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip label="MEDIUM" color="warning" size="small" />
                <Typography variant="body2">Score 50-70: Suspicious activity detected</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip label="HIGH" color="error" size="small" />
                <Typography variant="body2">Score 70-90: Strong VPN/proxy indicators</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip label="CRITICAL" color="error" size="small" />
                <Typography variant="body2">Score 90-100: Definite VPN/proxy/Tor node</Typography>
              </Box>
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Detection Methods */}
      <Accordion
        expanded={expanded === 'panel3'}
        onChange={handleChange('panel3')}
        elevation={8}
        sx={{ borderRadius: '12px !important', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>🔍 Detection Methods Explained</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            Our system uses multiple detection techniques for accurate results:
          </Typography>
          <Stack spacing={2}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <SecurityIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Database Matching
                  </Typography>
                </Box>
                <Typography variant="body2">
                  Cross-references IPs against known VPN provider ranges and datacenter IPs
                </Typography>
              </CardContent>
            </Card>
            
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <CloudIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="subtitle1" fontWeight="bold">
                    WHOIS Analysis
                  </Typography>
                </Box>
                <Typography variant="body2">
                  Analyzes network ownership and hosting provider information
                </Typography>
              </CardContent>
            </Card>
            
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <SpeedIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Port Scanning & Behavioral Analysis
                  </Typography>
                </Box>
                <Typography variant="body2">
                  Detects common VPN ports and analyzes connection patterns
                </Typography>
              </CardContent>
            </Card>
            
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <HelpOutlineIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Machine Learning Models
                  </Typography>
                </Box>
                <Typography variant="body2">
                  Advanced ML algorithms analyze 7+ factors including reputation, anomalies, and behavioral patterns
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* FAQ */}
      <Accordion
        expanded={expanded === 'panel4'}
        onChange={handleChange('panel4')}
        elevation={8}
        sx={{ borderRadius: '12px !important', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>💡 Frequently Asked Questions</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Q: How accurate is the detection?
              </Typography>
              <Typography variant="body2">
                Our multi-layered approach achieves high accuracy by combining 7+ detection methods. 
                However, no system is 100% accurate. CDNs and corporate proxies may occasionally trigger false positives.
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Q: What is the Trust Score?
              </Typography>
              <Typography variant="body2">
                Trust Score (0-100) is the inverse of the Threat Score. Higher trust scores indicate safer, more legitimate IPs.
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Q: Can I integrate this into my application?
              </Typography>
              <Typography variant="body2">
                Yes! Check the Examples page for API integration code in JavaScript, Python, PHP, and cURL.
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Q: What about false positives (CDNs, corporate proxies)?
              </Typography>
              <Typography variant="body2">
                CDNs like Cloudflare may show elevated scores but are typically labeled accordingly. 
                Use threat level context: scores below 70 are generally safe for most applications.
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Q: How many IPs can I check at once?
              </Typography>
              <Typography variant="body2">
                The bulk analysis feature supports up to 100 IPs per request. You can upload a CSV file 
                or paste IPs manually. For larger batches, split them into multiple requests. 
                Results are automatically saved to your history and can be exported as CSV.
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Q: What CSV format is supported for bulk upload?
              </Typography>
              <Typography variant="body2">
                Upload a CSV file with IP addresses in the first column. Header rows are optional and 
                will be automatically filtered out. Additional columns (like labels or timestamps) are 
                ignored. After analysis, you can export results as a formatted CSV with all detection data.
              </Typography>
            </Paper>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Use Cases */}
      <Accordion
        expanded={expanded === 'panel5'}
        onChange={handleChange('panel5')}
        elevation={8}
        sx={{ borderRadius: '12px !important', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>🎯 Common Use Cases</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            VPN detection is valuable for many applications:
          </Typography>
          <Box component="ul" sx={{ pl: 2 }}>
            <li><strong>Fraud Prevention:</strong> Block suspicious transactions from anonymized connections</li>
            <li><strong>Content Licensing:</strong> Enforce geographic restrictions for licensed content</li>
            <li><strong>Account Security:</strong> Flag unusual login locations or proxy usage</li>
            <li><strong>Compliance:</strong> Meet regulatory requirements for user identity verification</li>
            <li><strong>Analytics:</strong> Filter bot traffic and improve data accuracy</li>
            <li><strong>Access Control:</strong> Restrict sensitive resources to verified locations</li>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Best Practices */}
      <Accordion
        expanded={expanded === 'panel6'}
        onChange={handleChange('panel6')}
        elevation={8}
        sx={{ borderRadius: '12px !important', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>✅ Best Practices</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            Get the most out of the VPN detection system:
          </Typography>
          <Stack spacing={1}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="body2">
                • <strong>Set appropriate thresholds:</strong> Don't block all detections—scores below 70 are often legitimate
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="body2">
                • <strong>Combine with other signals:</strong> Use VPN detection as one factor among many
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="body2">
                • <strong>Allow CDNs:</strong> Recognize legitimate services like Cloudflare, AWS CloudFront
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="body2">
                • <strong>Review history:</strong> Use the Dashboard to monitor trends and adjust policies
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="body2">
                • <strong>Cache results:</strong> The system caches recent checks for faster performance
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="body2">
                • <strong>Use bulk analysis:</strong> Process multiple IPs efficiently with CSV upload and export results
              </Typography>
            </Paper>
          </Stack>
        </AccordionDetails>
      </Accordion>
        </Box>
      </Container>
    </Box>
  );
};

export default HelpDocumentation;
