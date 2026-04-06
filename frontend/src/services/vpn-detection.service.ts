import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface DetectionResult {
  ip: string;
  verdict: 'PROXY/VPN' | 'ORIGINAL';
  score: number;
  threatLevel: string;
  checks: Array<{
    type: string;
    result: boolean;
    details?: string;
    score?: number;
    provider?: string;
  }>;
  whois?: {
    raw?: string;
    parsed?: Record<string, unknown>;
  };
  timestamp: string;
  cached?: boolean;
  analysis: {
    isProxy: boolean;
    isVPN: boolean;
    isTor: boolean;
    isHosting: boolean;
  };
  // Domain resolution fields
  inputType?: 'ip' | 'domain';
  originalInput?: string;
  resolvedIP?: string;
}

export interface BulkUploadResponse {
  jobId: string;
  message: string;
  totalIPs: number;
}

export interface BulkJobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalIPs: number;
  processedIPs: number;
  results?: DetectionResult[];
}

class VPNDetectionService {
  private getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async detectIP(ip: string): Promise<DetectionResult> {
    try {
      const response = await axios.post(
        `${API_URL}/detect`,
        { ip },
        { headers: this.getAuthHeader() }
      );
      return response.data;
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Detection failed');
    }
  }

  async uploadBulkFile(file: File): Promise<BulkUploadResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API_URL}/bulk/upload`, formData, {
        headers: {
          ...this.getAuthHeader(),
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Upload failed');
    }
  }

  async getBulkJobStatus(jobId: string): Promise<BulkJobStatus> {
    try {
      const response = await axios.get(`${API_URL}/bulk/job/${jobId}`, {
        headers: this.getAuthHeader(),
      });
      return response.data;
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Failed to get job status');
    }
  }

  async getHistory(page: number = 1, limit: number = 20, verdict?: string) {
    try {
      const params: Record<string, string | number> = { page, limit };
      if (verdict) params.verdict = verdict;

      const response = await axios.get(`${API_URL}/history`, {
        headers: this.getAuthHeader(),
        params,
      });
      return response.data;
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Failed to fetch history');
    }
  }

  async exportHistory(format: 'csv' | 'json' = 'csv') {
    try {
      const response = await axios.get(`${API_URL}/history/export/${format}`, {
        headers: this.getAuthHeader(),
        responseType: 'blob',
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `vpn-detection-history.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Export failed');
    }
  }
}

export default new VPNDetectionService();
