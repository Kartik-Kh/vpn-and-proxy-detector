import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HomeIcon from '@mui/icons-material/Home';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import HistoryIcon from '@mui/icons-material/History';
import ScienceIcon from '@mui/icons-material/Science';

const Navbar = () => {
  const navButtons = [
    { path: '/', label: 'Home', icon: <HomeIcon sx={{ fontSize: 18, mr: 0.5 }} /> },
    { path: '/bulk', label: 'Bulk', icon: <CloudUploadIcon sx={{ fontSize: 18, mr: 0.5 }} /> },
    { path: '/history', label: 'History', icon: <HistoryIcon sx={{ fontSize: 18, mr: 0.5 }} /> },
    { path: '/dashboard', label: 'Dashboard', icon: <DashboardIcon sx={{ fontSize: 18, mr: 0.5 }} /> },
    { path: '/examples', label: 'Examples', icon: <ScienceIcon sx={{ fontSize: 18, mr: 0.5 }} /> },
    { path: '/help', label: 'Help', icon: <HelpOutlineIcon sx={{ fontSize: 18, mr: 0.5 }} /> },
  ];

  return (
    <AppBar position="fixed" sx={{ 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      boxShadow: '0 2px 20px rgba(102, 126, 234, 0.4)',
    }}>
      <Toolbar>
        <Typography
          variant="h6"
          component="div"
          sx={{
            flexGrow: 1,
            fontWeight: 700,
            color: 'white',
            fontSize: '1.2rem',
            letterSpacing: '-0.3px',
          }}
        >
          🔍 VPN Detector
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {navButtons.map((btn) => (
            <Button
              key={btn.path}
              component={RouterLink}
              to={btn.path}
              startIcon={btn.icon}
              sx={{
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 500,
                fontSize: '0.9rem',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  color: 'white',
                },
              }}
            >
              {btn.label}
            </Button>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;