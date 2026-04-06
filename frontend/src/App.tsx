import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';
import Navbar from './components/Navbar.tsx';
import Home from './components/Home.tsx';
import IPDetector from './components/IPDetector.tsx';
import BulkAnalysis from './components/BulkAnalysis.tsx';
import HistoryView from './components/HistoryView.tsx';
import Dashboard from './components/Dashboard.tsx';
import HelpDocumentation from './components/HelpDocumentation.tsx';
import ExamplesGallery from './components/ExamplesGallery.tsx';

function App() {
  return (
    <Router>
      <Box>
        <Navbar />
        <Box sx={{ mt: 8 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/detect" element={<IPDetector />} />
            <Route path="/bulk" element={<BulkAnalysis />} />
            <Route path="/history" element={<HistoryView />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/examples" element={<ExamplesGallery />} />
            <Route path="/help" element={<HelpDocumentation />} />
          </Routes>
        </Box>
      </Box>
    </Router>
  );
}

export default App;
