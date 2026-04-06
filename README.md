# Proxy & VPN Detector

Self-hosted VPN/Proxy detection with WHOIS enrichment for security teams and network administrators.

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

## Features

- **Detection**: CIDR checks, port probing, DNS analysis, network metrics
- **WHOIS/RDAP**: Socket queries, registrar info, VPN indicators
- **Interface**: Single/bulk IP lookup, history dashboard, real-time tracking
- **Security**: JWT auth, rate limiting, input validation
- **Logging**: Full audit trail with timestamps and exports

## Quick Start

### Prerequisites
- Node.js v18+
- MongoDB v7+ (optional)
- Redis v7+ (optional)

### Setup

```bash
# Clone
git clone https://github.com/Kartik-Kh/VPN-and-Proxy-50percent.git
cd VPN-and-Proxy-50percent

# Backend
cd backend
npm install
# Create .env with API keys
npm run dev:simple

# Frontend (new terminal)
cd frontend
npm install
echo "VITE_API_URL=http://localhost:5000/api" > .env
npm run dev
```

### Access
- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## API Endpoints

```http
POST /api/detect/single
{
  "ip": "8.8.8.8"
}

Response:
{
  "ip": "8.8.8.8",
  "verdict": "ORIGINAL",
  "score": 0,
  "threatLevel": "LOW"
}
```

## Docker (Optional)

```bash
docker-compose up -d
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Material-UI
- **Backend**: Node.js, Express, TypeScript
- **APIs**: IPQualityScore, AbuseIPDB, IPInfo, WHOIS

## Project Structure

```
 backend/
    src/
       routes/          # API endpoints
       services/        # Detection logic
       server-simple.ts # Entry point
    data/                # VPN ranges
 frontend/
    src/
        components/      # React components
        services/        # API clients
 docker-compose.yml
```

## License

ISC License

## Contact

**Author**: Kartik Khorwal (22ESKCS112)  
**Mentor**: Shweta Sharma  
**Institution**: Swami Keshwanand Institute of Technology

---
