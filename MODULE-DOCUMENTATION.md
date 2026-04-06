# VPN Detection System - Module Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Module 1: Detection Engine](#module-1-detection-engine)
3. [Module 2: Caching System](#module-2-caching-system)
4. [Module 3: WHOIS Service](#module-3-whois-service)
5. [Module 4: Bulk Processing](#module-4-bulk-processing)
6. [Module 5: History & Analytics](#module-5-history--analytics)
7. [Module 6: Frontend Components](#module-6-frontend-components)
8. [Usage Examples](#usage-examples)
9. [API Reference](#api-reference)

---

## System Overview

### Architecture Diagram
```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                            │
│                     http://localhost:3000                         │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTP Requests
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                             │
│  ┌─────────────┬──────────────┬──────────────┬─────────────┐    │
│  │ IPDetector  │ BulkAnalysis │ HistoryView  │   Navbar    │    │
│  └─────────────┴──────────────┴──────────────┴─────────────┘    │
│              │                                                    │
│              │ Axios HTTP Client                                 │
│              ▼                                                    │
│      ┌──────────────────┐                                       │
│      │ VPN API Service  │                                       │
│      └──────────────────┘                                       │
└────────────────────────┬─────────────────────────────────────────┘
                         │ POST /api/detect
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js/Express)                     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    ROUTING LAYER                            │ │
│  │  /api/detect    /api/bulk    /api/history                  │ │
│  └────────────────────┬───────────────────────────────────────┘ │
│                       │                                          │
│  ┌────────────────────▼───────────────────────────────────────┐ │
│  │                 DETECTION ENGINE                            │ │
│  │  ┌──────────┬──────────┬──────────┬──────────┬──────────┐ │ │
│  │  │  Cache   │   API    │  VPN     │  WHOIS   │  Scoring │ │ │
│  │  │  Check   │  Calls   │  Range   │  Lookup  │  Logic   │ │ │
│  │  └──────────┴──────────┴──────────┴──────────┴──────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    SERVICE LAYER                            │ │
│  │  ┌─────────────┬─────────────┬─────────────┬────────────┐ │ │
│  │  │   Cache     │    WHOIS    │  IP Intel   │  Network   │ │ │
│  │  │  Service    │   Service   │  Service    │  Metrics   │ │ │
│  │  └─────────────┴─────────────┴─────────────┴────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                       │                │                         │
└───────────────────────┼────────────────┼─────────────────────────┘
                        │                │
                        ▼                ▼
        ┌───────────────────┐  ┌──────────────────┐
        │      Redis        │  │    MongoDB       │
        │    (Cache)        │  │   (Storage)      │
        │  Port: 6379       │  │  Port: 27017     │
        └───────────────────┘  └──────────────────┘
                        │
                        ▼
        ┌────────────────────────────────────┐
        │      External APIs                 │
        │  • IPQualityScore                  │
        │  • AbuseIPDB                       │
        │  • IPInfo                          │
        └────────────────────────────────────┘
```

---

## Module 1: Detection Engine

### Overview
**Purpose:** Core VPN/Proxy detection logic using multi-source intelligence  
**Location:** `backend/src/routes/detect-simple.ts`  
**Owner:** Kartik Khatri  
**Dependencies:** axios, cache service, WHOIS service

### How It Works

```typescript
/**
 * VPN Detection Flow
 * 
 * Input: IP Address (string)
 * Output: Detection Result Object
 * 
 * Process:
 * 1. Validate IP format
 * 2. Check Redis cache
 * 3. If not cached, run 5 detection checks
 * 4. Aggregate scores (0-100)
 * 5. Determine verdict
 * 6. Save to cache & database
 * 7. Return result
 */

async function detectVPN(ip: string): Promise<DetectionResult> {
  const checks = [];
  let score = 0;

  // CHECK 1: IPQualityScore API
  // Purpose: Professional fraud detection
  // Weight: High (25 points if VPN detected + fraud score/3)
  
  // CHECK 2: AbuseIPDB API  
  // Purpose: Community abuse reports
  // Weight: Medium (10 points if high abuse score)
  
  // CHECK 3: IPInfo API
  // Purpose: Organization & hosting detection
  // Weight: Medium (8 points if hosting provider)
  
  // CHECK 4: VPN Range Database
  // Purpose: Known VPN provider IP ranges
  // Weight: High (20 points if matched)
  
  // CHECK 5: WHOIS Lookup
  // Purpose: Network registration info
  // Weight: Informational (provides context)

  return {
    ip,
    verdict: score > 40 ? 'PROXY/VPN' : 'ORIGINAL',
    score,
    threatLevel: getThreatLevel(score),
    checks,
    timestamp: new Date().toISOString()
  };
}
```

### Detection Checks in Detail

#### Check 1: IPQualityScore API
```typescript
// API Call
const response = await axios.get(
  `https://ipqualityscore.com/api/json/ip/${API_KEY}/${ip}`,
  { timeout: 5000 }
);

// Response Structure
{
  success: true,
  fraud_score: 85,        // 0-100 (higher = more suspicious)
  vpn: true,              // Boolean: VPN detected
  proxy: false,           // Boolean: Proxy detected
  tor: false,             // Boolean: TOR detected
  recent_abuse: true,     // Boolean: Recent malicious activity
  bot_status: false       // Boolean: Automated bot
}

// Scoring Logic
if (response.vpn || response.proxy) {
  score += 25;  // Strong VPN indicator
}
score += Math.min(response.fraud_score / 3, 15); // Add fraud score (capped at 15)
```

**Usage Example:**
```bash
curl -X POST http://localhost:5000/api/detect \
  -H "Content-Type: application/json" \
  -d '{"ip": "8.8.8.8"}'

# Response shows IPQualityScore check
{
  "checks": [{
    "type": "IPQualityScore",
    "result": false,
    "details": "Fraud Score: 5, VPN: false, Proxy: false",
    "score": 5
  }]
}
```

#### Check 2: AbuseIPDB API
```typescript
// API Call
const response = await axios.get(
  `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`,
  {
    headers: { 'Key': process.env.ABUSEIPDB_API_KEY },
    timeout: 5000
  }
);

// Response Structure
{
  data: {
    ipAddress: "185.201.10.50",
    abuseConfidenceScore: 85,  // 0-100 (percentage)
    usageType: "Data Center",
    isp: "NordVPN",
    isWhitelisted: false,
    totalReports: 45           // Number of abuse reports
  }
}

// Scoring Logic
if (abuseScore > 75) score += 10;  // High abuse
else if (abuseScore > 50) score += 5;  // Medium abuse
```

**Usage Example:**
```javascript
// Frontend: Check specific IP for abuse
const result = await vpnService.detect("185.201.10.50");
console.log(result.checks.find(c => c.type === 'AbuseIPDB'));
// Output: { type: 'AbuseIPDB', result: true, score: 85 }
```

#### Check 3: IPInfo API
```typescript
// API Call
const response = await axios.get(
  `https://ipinfo.io/${ip}/json?token=${process.env.IPINFO_TOKEN}`,
  { timeout: 5000 }
);

// Response Structure
{
  ip: "185.201.10.50",
  hostname: "185-201-10-50.nordvpn.com",
  city: "Panama City",
  region: "Panama",
  country: "PA",
  org: "NordVPN",           // Organization name
  postal: "0801",
  timezone: "America/Panama"
}

// Detection Logic
const isHosting = org.toLowerCase().includes('hosting') ||
                  org.toLowerCase().includes('server') ||
                  org.toLowerCase().includes('cloud') ||
                  org.toLowerCase().includes('datacenter');

if (isHosting) score += 8;
```

**Usage Example:**
```typescript
// Get location info from detection result
const result = await detectVPN("8.8.8.8");
const ipInfoCheck = result.checks.find(c => c.type === 'IPInfo');
console.log(ipInfoCheck.location); // "Mountain View, US"
console.log(ipInfoCheck.details);  // "Org: Google LLC, Country: US"
```

#### Check 4: VPN Range Database
```typescript
// Database: backend/data/vpn_ranges.json
const vpnRanges = [
  {
    provider: "NordVPN",
    pattern: /^(185\.201\.|193\.29\.|212\.102\.)/,
    ranges: ["185.201.0.0/16", "193.29.0.0/16"]
  },
  {
    provider: "ExpressVPN",
    pattern: /^(149\.248\.|103\.253\.|169\.50\.)/,
    ranges: ["149.248.0.0/16", "103.253.0.0/16"]
  },
  // ... 50+ more providers
];

// Matching Logic
const vpnMatch = vpnRanges.find(range => range.pattern.test(ip));
if (vpnMatch) {
  checks.push({
    type: 'VPN Range Match',
    result: true,
    provider: vpnMatch.provider,
    details: `Matched ${vpnMatch.provider} IP range`
  });
  score += 20;  // Strong indicator
}
```

**Usage Example:**
```bash
# Check if IP belongs to known VPN provider
curl -X POST http://localhost:5000/api/detect \
  -H "Content-Type: application/json" \
  -d '{"ip": "185.201.10.50"}'

# Response shows VPN range match
{
  "checks": [{
    "type": "VPN Range Match",
    "result": true,
    "provider": "NordVPN",
    "details": "Matched NordVPN IP range"
  }],
  "score": 73,
  "verdict": "PROXY/VPN"
}
```

#### Check 5: WHOIS Lookup
```typescript
// Execution
const whoisData = await getWhoisInfo(ip);

// Example Output
{
  organization: "NordVPN",
  netname: "NORDVPN-NET",
  country: "PA",
  address: "Panama City, Panama",
  created: "2019-05-15",
  email: "abuse@nordvpn.com",
  description: "VPN Service Provider"
}

// VPN Indicators
const vpnKeywords = ['vpn', 'proxy', 'privacy', 'anonymous', 'tunnel'];
const isVpnOrg = vpnKeywords.some(keyword => 
  organization.toLowerCase().includes(keyword)
);
```

**Usage Example:**
```typescript
// Access WHOIS data from result
const result = await detectVPN("185.201.10.50");
console.log(result.whois);
// {
//   organization: "NordVPN",
//   country: "PA",
//   netname: "NORDVPN-NET"
// }
```

### Scoring Algorithm

```typescript
/**
 * Score Calculation Matrix
 * 
 * Total Score: 0-100 points
 * 
 * Source                    | Max Points | Condition
 * --------------------------|------------|---------------------------
 * IPQualityScore VPN        |     25     | vpn === true
 * IPQualityScore Fraud      |     15     | fraud_score / 3
 * AbuseIPDB High            |     10     | score > 75
 * AbuseIPDB Medium          |      5     | score > 50
 * IPInfo Hosting            |      8     | org contains hosting keywords
 * VPN Range Match           |     20     | IP matches known VPN range
 * Private IP                |     10     | 10.x, 192.168.x, 172.x
 * 
 * Total Possible:           |    100+    | (capped at 100)
 */

function calculateScore(checks: Check[]): number {
  let total = 0;
  
  // Aggregate all check scores
  checks.forEach(check => {
    if (check.score) total += check.score;
  });
  
  // Ensure 0-100 range
  return Math.min(Math.max(total, 0), 100);
}
```

### Verdict Logic

```typescript
/**
 * Verdict Determination
 * 
 * Score Range  | Verdict      | Threat Level | Meaning
 * -------------|--------------|--------------|---------------------------
 * 0-20         | ORIGINAL     | CLEAN        | Genuine user IP
 * 21-40        | ORIGINAL     | LOW          | Slightly suspicious
 * 41-60        | PROXY/VPN    | MEDIUM       | Likely VPN/Proxy
 * 61-100       | PROXY/VPN    | HIGH         | Definite VPN/Proxy
 */

function getVerdict(score: number): {
  verdict: string;
  threatLevel: string;
} {
  if (score > 60) {
    return { verdict: 'PROXY/VPN', threatLevel: 'HIGH' };
  } else if (score > 40) {
    return { verdict: 'PROXY/VPN', threatLevel: 'MEDIUM' };
  } else if (score > 20) {
    return { verdict: 'ORIGINAL', threatLevel: 'LOW' };
  } else {
    return { verdict: 'ORIGINAL', threatLevel: 'CLEAN' };
  }
}
```

### Complete Detection Example

```typescript
// Example: Detecting "185.201.10.50" (NordVPN IP)

// Step-by-step breakdown:
const ip = "185.201.10.50";

// Check 1: IPQualityScore
// → VPN: true, Fraud Score: 85
// → Score: +25 (VPN) + 28.3 (fraud/3) = 53.3

// Check 2: AbuseIPDB  
// → Abuse Score: 12%
// → Score: +0 (below threshold)

// Check 3: IPInfo
// → Org: "NordVPN"
// → Score: +0 (not hosting keyword, but noted)

// Check 4: VPN Range Match
// → Pattern: /^185\.201\./
// → Match: NordVPN
// → Score: +20

// Check 5: WHOIS
// → Organization: "NordVPN"
// → Country: "PA"
// → Score: +0 (informational)

// Total Score: 53.3 + 20 = 73.3 → rounded to 73
// Verdict: 73 > 60 → "PROXY/VPN"
// Threat Level: 73 > 60 → "HIGH"

const result = {
  ip: "185.201.10.50",
  verdict: "PROXY/VPN",
  score: 73,
  threatLevel: "HIGH",
  checks: [
    { type: "IPQualityScore", result: true, details: "Fraud Score: 85, VPN: true" },
    { type: "AbuseIPDB", result: false, details: "Abuse Score: 12%" },
    { type: "IPInfo", result: false, details: "Org: NordVPN, Country: PA" },
    { type: "VPN Range Match", result: true, provider: "NordVPN" },
    { type: "WHOIS", result: true, data: { organization: "NordVPN" } }
  ],
  whois: { organization: "NordVPN", country: "PA" },
  timestamp: "2026-03-06T06:30:00.000Z"
};
```

---

## Module 2: Caching System

### Overview
**Purpose:** Performance optimization using Redis in-memory cache  
**Location:** `backend/src/services/cache.service.ts`  
**Owner:** Kartik Khatri  
**Impact:** 70% reduction in API calls, 200x speed improvement

### Architecture

```typescript
/**
 * Cache Architecture
 * 
 * Key Format: "detect:{ip_address}"
 * Example: "detect:8.8.8.8"
 * 
 * Value: JSON stringified detection result
 * TTL: 3600 seconds (1 hour)
 * 
 * Flow:
 * Request → Check Cache → [HIT] Return immediately
 *                      → [MISS] Run detection → Save to cache → Return
 */

class CacheService {
  private redis: RedisClient;
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = createClient({ url: redisUrl });
    
    await this.redis.connect();
    this.isConnected = true;
    console.log('✓ Redis connected');
  }

  async get(key: string): Promise<any | null> {
    if (!this.isConnected) return null;
    
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Cache GET error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    if (!this.isConnected) return;
    
    try {
      await this.redis.setEx(
        key,
        ttl,
        JSON.stringify(value)
      );
    } catch (error) {
      console.error('Cache SET error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.isConnected) return;
    await this.redis.del(key);
  }

  async clear(): Promise<void> {
    if (!this.isConnected) return;
    await this.redis.flushDb();
  }
}

export default new CacheService();
```

### Usage in Detection Flow

```typescript
// Detection with caching
router.post('/api/detect', async (req, res) => {
  const { ip } = req.body;
  const cacheKey = `detect:${ip}`;

  // 1. Check cache first
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    console.log(`✓ Cache HIT for ${ip}`);
    return res.json({ ...cached, cached: true });
  }

  // 2. Cache miss - run detection
  console.log(`⚬ Cache MISS for ${ip}`);
  const result = await detectVPN(ip);

  // 3. Save to cache (1 hour TTL)
  await cacheService.set(cacheKey, result, 3600);

  // 4. Return result
  res.json({ ...result, cached: false });
});
```

### Performance Comparison

```bash
# First Request (Cache Miss)
curl -X POST http://localhost:5000/api/detect \
  -H "Content-Type: application/json" \
  -d '{"ip": "8.8.8.8"}'
  
# Response Time: 2.5 seconds
# Response:
{
  "ip": "8.8.8.8",
  "verdict": "ORIGINAL",
  "score": 5,
  "cached": false,  ← Not from cache
  "timestamp": "2026-03-06T06:30:00.000Z"
}

# Second Request (Same IP within 1 hour)
curl -X POST http://localhost:5000/api/detect \
  -H "Content-Type: application/json" \
  -d '{"ip": "8.8.8.8"}'

# Response Time: 0.012 seconds (208x faster!)
# Response:
{
  "ip": "8.8.8.8",
  "verdict": "ORIGINAL",
  "score": 5,
  "cached": true,   ← From cache
  "timestamp": "2026-03-06T06:30:00.000Z"
}
```

### Cache Statistics

```typescript
// Get cache statistics
router.get('/api/cache/stats', async (req, res) => {
  const info = await redis.info('stats');
  
  res.json({
    totalKeys: await redis.dbSize(),
    hits: info.keyspace_hits,
    misses: info.keyspace_misses,
    hitRate: (info.keyspace_hits / (info.keyspace_hits + info.keyspace_misses) * 100).toFixed(2) + '%'
  });
});
```

### Usage Examples

```typescript
// Example 1: Direct cache usage
import cacheService from './services/cache.service';

// Save data
await cacheService.set('user:123', { name: 'John', role: 'admin' }, 3600);

// Retrieve data
const user = await cacheService.get('user:123');
console.log(user); // { name: 'John', role: 'admin' }

// Delete data
await cacheService.delete('user:123');

// Clear all cache
await cacheService.clear();
```

```bash
# Example 2: Testing cache behavior
# Request 1 (miss)
time curl -X POST http://localhost:5000/api/detect -d '{"ip":"1.1.1.1"}'
# → 2.5 seconds

# Request 2 (hit)
time curl -X POST http://localhost:5000/api/detect -d '{"ip":"1.1.1.1"}'
# → 0.01 seconds

# Wait 1 hour...
# Request 3 (expired, miss again)
time curl -X POST http://localhost:5000/api/detect -d '{"ip":"1.1.1.1"}'
# → 2.5 seconds
```

---

## Module 3: WHOIS Service

### Overview
**Purpose:** Retrieve network registration information for IPs  
**Location:** `backend/src/services/whois.service.ts`  
**Owner:** Khushang  
**Use Case:** Identifies IP ownership, organization, location

### Implementation

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

/**
 * WHOIS Lookup Service
 * 
 * Methods:
 * 1. System whois command (preferred)
 * 2. API fallback (if command unavailable)
 */

interface WhoisData {
  organization?: string;
  netname?: string;
  country?: string;
  address?: string;
  created?: string;
  email?: string;
  description?: string;
  raw?: string;
}

async function getWhoisInfo(ip: string): Promise<WhoisData> {
  try {
    // Method 1: Use system whois command
    const { stdout } = await execAsync(`whois ${ip}`);
    return {
      raw: stdout,
      ...parseWhoisData(stdout)
    };
  } catch (cmdError) {
    // Method 2: Fallback to WHOIS API
    try {
      const response = await axios.get(
        `https://www.whoisxmlapi.com/whoisserver/WhoisService`,
        {
          params: {
            apiKey: process.env.WHOIS_API_KEY || 'at_free',
            domainName: ip,
            outputFormat: 'JSON'
          },
          timeout: 10000
        }
      );
      return parseApiResponse(response.data);
    } catch (apiError) {
      return {
        error: 'WHOIS lookup failed',
        message: apiError.message
      };
    }
  }
}

function parseWhoisData(raw: string): WhoisData {
  const data: WhoisData = {};
  const lines = raw.split('\n');
  
  for (const line of lines) {
    if (!line.includes(':')) continue;
    
    const [key, ...valueParts] = line.split(':');
    const value = valueParts.join(':').trim();
    const cleanKey = key.trim().toLowerCase();
    
    // Extract relevant fields
    if (cleanKey.includes('org') || cleanKey.includes('orgname')) {
      data.organization = value;
    }
    if (cleanKey.includes('netname')) {
      data.netname = value;
    }
    if (cleanKey.includes('country')) {
      data.country = value;
    }
    if (cleanKey.includes('address')) {
      data.address = (data.address || '') + value + ', ';
    }
    if (cleanKey.includes('created') || cleanKey.includes('registration')) {
      data.created = value;
    }
    if (cleanKey.includes('email') || cleanKey.includes('e-mail')) {
      data.email = value;
    }
    if (cleanKey.includes('descr') || cleanKey.includes('description')) {
      data.description = value;
    }
  }
  
  return data;
}

export { getWhoisInfo, WhoisData };
```

### Usage Examples

```typescript
// Example 1: Get WHOIS for Google DNS
const whois = await getWhoisInfo('8.8.8.8');
console.log(whois);
// Output:
{
  organization: "Google LLC",
  netname: "LVLT-GOGL-8-8-8",
  country: "US",
  address: "1600 Amphitheatre Parkway, Mountain View, CA",
  created: "2014-03-14",
  email: "network-abuse@google.com",
  description: "Google Public DNS"
}

// Example 2: Get WHOIS for NordVPN
const whois = await getWhoisInfo('185.201.10.50');
console.log(whois);
// Output:
{
  organization: "NordVPN",
  netname: "NORDVPN-NET",
  country: "PA",
  address: "Panama City, Panama",
  created: "2019-05-15",
  description: "VPN Service Provider"
}

// Example 3: Detect VPN from WHOIS
function isVpnFromWhois(whois: WhoisData): boolean {
  const vpnKeywords = ['vpn', 'proxy', 'privacy', 'anonymous', 'tunnel'];
  const orgLower = (whois.organization || '').toLowerCase();
  const descLower = (whois.description || '').toLowerCase();
  
  return vpnKeywords.some(keyword => 
    orgLower.includes(keyword) || descLower.includes(keyword)
  );
}

console.log(isVpnFromWhois(whois)); // true
```

### WHOIS Data Interpretation

```typescript
/**
 * WHOIS Field Meanings
 * 
 * Field          | Description                    | VPN Indicators
 * ---------------|--------------------------------|---------------------------
 * organization   | Company/entity owning IP       | Contains "VPN", "Proxy"
 * netname        | Network name identifier        | Generic names, "HOSTING"
 * country        | Registration country           | Tax havens (PA, BZ, KY)
 * created        | Registration date              | Recent dates
 * description    | Network purpose                | "VPN", "Privacy"
 * email          | Abuse contact                  | Generic abuse emails
 */

interface VpnIndicators {
  organizationMatch: boolean;
  nameMatch: boolean;
  recentRegistration: boolean;
  suspiciousCountry: boolean;
}

function analyzeWhois(whois: WhoisData): VpnIndicators {
  const vpnKeywords = ['vpn', 'proxy', 'privacy', 'anonymous'];
  const suspiciousCountries = ['PA', 'BZ', 'KY', 'SC', 'VG'];
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  return {
    organizationMatch: vpnKeywords.some(k => 
      (whois.organization || '').toLowerCase().includes(k)
    ),
    nameMatch: vpnKeywords.some(k => 
      (whois.netname || '').toLowerCase().includes(k)
    ),
    recentRegistration: whois.created 
      ? new Date(whois.created) > oneYearAgo
      : false,
    suspiciousCountry: suspiciousCountries.includes(whois.country || '')
  };
}
```

---

## Module 4: Bulk Processing

### Overview
**Purpose:** Analyze multiple IPs efficiently in a single request  
**Location:** `backend/src/routes/detect-simple.ts` (bulk endpoint)  
**Owner:** Jitender  
**Capacity:** Up to 100 IPs per request

### Implementation

```typescript
/**
 * Bulk Detection Endpoint
 * 
 * POST /api/detect/bulk
 * Body: { "ips": ["8.8.8.8", "1.1.1.1", ...] }
 * 
 * Features:
 * - Validates all IPs
 * - Processes with caching
 * - Parallel processing
 * - Summary statistics
 */

router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { ips } = req.body;

    // Validation
    if (!ips || !Array.isArray(ips) || ips.length === 0) {
      return res.status(400).json({ error: 'IPs array is required' });
    }

    if (ips.length > 100) {
      return res.status(400).json({ 
        error: 'Maximum 100 IPs allowed per request',
        received: ips.length 
      });
    }

    // Filter valid IPs
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    const validIps = ips.filter((ip: string) => ipRegex.test(ip.trim()));

    if (validIps.length === 0) {
      return res.status(400).json({ error: 'No valid IP addresses found' });
    }

    console.log(`Processing bulk request for ${validIps.length} IPs...`);

    // Process all IPs
    const results = [];
    const startTime = Date.now();

    for (const ip of validIps) {
      try {
        const trimmedIp = ip.trim();
        const cacheKey = `detect:${trimmedIp}`;
        
        // Check cache first
        let result = await cacheService.get(cacheKey);
        
        if (!result) {
          // Not cached - run detection
          result = await detectVPN(trimmedIp);
          await cacheService.set(cacheKey, result, 3600);
          
          // Save to MongoDB
          try {
            await Lookup.create({
              ip: result.ip,
              verdict: result.verdict,
              score: result.score,
              whois: result.whois,
              checks: result.checks,
              timestamp: new Date()
            });
          } catch (dbError) {
            console.log('MongoDB save skipped for', trimmedIp);
          }
        } else {
          result.cached = true;
        }
        
        results.push(result);
      } catch (error) {
        // Handle individual IP errors
        results.push({
          ip: ip.trim(),
          error: 'Detection failed',
          verdict: 'ERROR',
          score: 0,
          threatLevel: 'UNKNOWN'
        });
      }
    }

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // Calculate summary statistics
    const summary = {
      clean: results.filter((r: any) => r.score < 20).length,
      suspicious: results.filter((r: any) => r.score >= 20 && r.score < 40).length,
      vpn: results.filter((r: any) => r.score >= 40).length,
      errors: results.filter((r: any) => r.verdict === 'ERROR').length
    };

    res.json({
      total: ips.length,
      valid: validIps.length,
      invalid: ips.length - validIps.length,
      processed: results.length,
      processingTime: `${processingTime}s`,
      results,
      summary
    });
  } catch (error: any) {
    console.error('Bulk detection error:', error);
    res.status(500).json({
      error: 'Bulk detection failed',
      message: error.message
    });
  }
});
```

### Usage Examples

```bash
# Example 1: Bulk detect 3 IPs
curl -X POST http://localhost:5000/api/detect/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "ips": [
      "8.8.8.8",
      "185.201.10.50",
      "1.1.1.1"
    ]
  }'

# Response:
{
  "total": 3,
  "valid": 3,
  "invalid": 0,
  "processed": 3,
  "processingTime": "2.5s",
  "summary": {
    "clean": 2,
    "suspicious": 0,
    "vpn": 1,
    "errors": 0
  },
  "results": [
    {
      "ip": "8.8.8.8",
      "verdict": "ORIGINAL",
      "score": 5,
      "threatLevel": "CLEAN",
      "cached": false
    },
    {
      "ip": "185.201.10.50",
      "verdict": "PROXY/VPN",
      "score": 73,
      "threatLevel": "HIGH",
      "cached": false
    },
    {
      "ip": "1.1.1.1",
      "verdict": "ORIGINAL",
      "score": 8,
      "threatLevel": "CLEAN",
      "cached": false
    }
  ]
}
```

```typescript
// Example 2: Frontend bulk analysis
async function analyzeBulkIPs(ipList: string[]) {
  const response = await axios.post('/api/detect/bulk', {
    ips: ipList
  });

  const { summary, results } = response.data;

  console.log(`Found ${summary.vpn} VPNs out of ${results.length} IPs`);
  
  // Show VPN IPs
  const vpnIPs = results.filter(r => r.verdict === 'PROXY/VPN');
  vpnIPs.forEach(ip => {
    console.log(`${ip.ip}: Score ${ip.score}`);
  });
}

// Usage
const ips = ['8.8.8.8', '185.201.10.50', '1.1.1.1'];
analyzeBulkIPs(ips);
```

```javascript
// Example 3: CSV file upload
// Frontend component
function BulkUploadFromCSV() {
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    const text = await file.text();
    
    // Parse CSV (simple: one IP per line)
    const ips = text.split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    // Send to bulk endpoint
    const response = await axios.post('/api/detect/bulk', { ips });
    
    // Display results
    setResults(response.data.results);
    setSummary(response.data.summary);
  };

  return (
    <input 
      type="file" 
      accept=".csv,.txt"
      onChange={handleFileUpload}
    />
  );
}
```

### Performance Metrics

```
Bulk Processing Performance
===========================

Scenario: 100 IPs

First Run (All Cache Miss):
- API Calls: 300 (3 APIs × 100 IPs)
- Processing Time: 35-40 seconds
- Cache Stored: 100 entries

Second Run (All Cache Hit):
- API Calls: 0
- Processing Time: 1-2 seconds
- Speed Improvement: 20-40x faster

Mixed Run (50% cached):
- API Calls: 150
- Processing Time: 18-20 seconds
- Speed Improvement: 2x faster
```

---

## Module 5: History & Analytics

### Overview
**Purpose:** Track and analyze all IP lookups  
**Location:** `backend/src/routes/history.routes.ts`, `frontend/src/components/HistoryView.tsx`  
**Owners:** Jitender (backend), Hitesh (frontend)  
**Storage:** MongoDB + localStorage

### Backend: Database Schema

```typescript
// Lookup Model: backend/src/models/Lookup.ts
import mongoose from 'mongoose';

const LookupSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    index: true
  },
  verdict: {
    type: String,
    enum: ['ORIGINAL', 'PROXY/VPN', 'ERROR'],
    required: true
  },
  score: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  threatLevel: {
    type: String,
    enum: ['CLEAN', 'LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']
  },
  checks: [{
    type: {
      type: String
    },
    result: Boolean,
    details: String,
    score: Number,
    provider: String
  }],
  whois: {
    organization: String,
    country: String,
    netname: String,
    created: String
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Indexes for faster queries
LookupSchema.index({ ip: 1, timestamp: -1 });
LookupSchema.index({ verdict: 1, timestamp: -1 });
LookupSchema.index({ userId: 1, timestamp: -1 });

export default mongoose.model('Lookup', LookupSchema);
```

### Backend: History API Endpoints

```typescript
/**
 * History Routes
 * 
 * GET    /api/history                  - List all lookups (paginated)
 * GET    /api/history/:id              - Get specific lookup
 * DELETE /api/history/:id              - Delete lookup
 * GET    /api/history/export/csv       - Export to CSV
 * GET    /api/history/stats/overview   - Dashboard statistics
 */

// 1. List Lookups with Filtering & Pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      verdict,
      startDate,
      endDate,
      search
    } = req.query;

    // Build query
    const query: any = {};

    // Filter by verdict
    if (verdict && (verdict === 'PROXY/VPN' || verdict === 'ORIGINAL')) {
      query.verdict = verdict;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }

    // Search by IP
    if (search) {
      query.ip = { $regex: search as string, $options: 'i' };
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Execute query
    const [lookups, total] = await Promise.all([
      Lookup.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Lookup.countDocuments(query)
    ]);

    res.json({
      lookups,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// 2. Export to CSV
router.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const lookups = await Lookup.find()
      .sort({ timestamp: -1 })
      .limit(1000);

    // Generate CSV
    const csv = [
      'IP,Verdict,Score,Threat Level,Timestamp',
      ...lookups.map(lookup =>
        `${lookup.ip},${lookup.verdict},${lookup.score},${lookup.threatLevel},${lookup.timestamp}`
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=vpn-detection-history.csv');
    res.send(csv);
  } catch (error) {
    logger.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export history' });
  }
});

// 3. Statistics Overview
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const [total, vpnCount, originalCount] = await Promise.all([
      Lookup.countDocuments(),
      Lookup.countDocuments({ verdict: 'PROXY/VPN' }),
      Lookup.countDocuments({ verdict: 'ORIGINAL' })
    ]);

    res.json({
      total,
      vpn: vpnCount,
      original: originalCount,
      vpnPercentage: total > 0 ? Math.round((vpnCount / total) * 100) : 0
    });
  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});
```

### Frontend: History Component

```tsx
// HistoryView.tsx - Complete implementation
import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Box,
  Button,
  TextField
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import axios from 'axios';

interface HistoryItem {
  ip: string;
  verdict: string;
  score: number;
  threatLevel: string;
  timestamp: string;
  cached?: boolean;
}

function HistoryView() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('vpn-detection-history');
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, []);

  // Filter logic
  const filteredHistory = history.filter(item => {
    // Apply verdict filter
    let matchesFilter = true;
    if (filter === 'Clean') matchesFilter = item.score < 20;
    else if (filter === 'Suspicious') matchesFilter = item.score >= 20 && item.score < 40;
    else if (filter === 'VPN') matchesFilter = item.score >= 40;

    // Apply search filter
    const matchesSearch = searchTerm === '' || item.ip.includes(searchTerm);

    return matchesFilter && matchesSearch;
  });

  // Export to CSV
  const exportToCSV = () => {
    const csv = [
      'IP Address,Verdict,Score,Threat Level,Timestamp',
      ...filteredHistory.map(item =>
        `${item.ip},${item.verdict},${item.score},${item.threatLevel},${item.timestamp}`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vpn-detection-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Clear history
  const clearHistory = () => {
    if (confirm('Are you sure you want to clear all history?')) {
      localStorage.removeItem('vpn-detection-history');
      setHistory([]);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Lookup History
      </Typography>

      {/* Search and Filters */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          label="Search by IP"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="e.g., 8.8.8.8"
        />

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip 
            label="All" 
            onClick={() => setFilter('All')}
            color={filter === 'All' ? 'primary' : 'default'}
          />
          <Chip 
            label="Clean" 
            onClick={() => setFilter('Clean')}
            color={filter === 'Clean' ? 'success' : 'default'}
          />
          <Chip 
            label="Suspicious" 
            onClick={() => setFilter('Suspicious')}
            color={filter === 'Suspicious' ? 'warning' : 'default'}
          />
          <Chip 
            label="VPN" 
            onClick={() => setFilter('VPN')}
            color={filter === 'VPN' ? 'error' : 'default'}
          />
        </Box>

        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportToCSV}
            disabled={filteredHistory.length === 0}
          >
            Export CSV
          </Button>
          <Button 
            variant="outlined"
            color="error"
            onClick={clearHistory}
            disabled={history.length === 0}
          >
            Clear All
          </Button>
        </Box>
      </Box>

      {/* Statistics */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Statistics</Typography>
        <Box sx={{ display: 'flex', gap: 3 }}>
          <Typography>
            Total: <strong>{history.length}</strong>
          </Typography>
          <Typography>
            Clean: <strong>{history.filter(h => h.score < 20).length}</strong>
          </Typography>
          <Typography>
            Suspicious: <strong>{history.filter(h => h.score >= 20 && h.score < 40).length}</strong>
          </Typography>
          <Typography>
            VPN/Proxy: <strong>{history.filter(h => h.score >= 40).length}</strong>
          </Typography>
        </Box>
      </Paper>

      {/* History Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>IP Address</strong></TableCell>
              <TableCell><strong>Verdict</strong></TableCell>
              <TableCell><strong>Score</strong></TableCell>
              <TableCell><strong>Threat Level</strong></TableCell>
              <TableCell><strong>Timestamp</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredHistory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="text.secondary">
                    No lookups found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredHistory.map((item, index) => (
                <TableRow key={index} hover>
                  <TableCell>
                    {item.ip}
                    {item.cached && (
                      <Chip 
                        label="Cached" 
                        size="small" 
                        sx={{ ml: 1 }} 
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.verdict}
                      color={item.verdict === 'PROXY/VPN' ? 'error' : 'success'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{item.score}/100</TableCell>
                  <TableCell>
                    <Chip
                      label={item.threatLevel}
                      color={
                        item.threatLevel === 'HIGH' ? 'error' :
                        item.threatLevel === 'MEDIUM' ? 'warning' :
                        item.threatLevel === 'LOW' ? 'info' : 'success'
                      }
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(item.timestamp).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}

export default HistoryView;
```

### Usage Examples

```typescript
// Example 1: Auto-save to history
// In IPDetector component
const handleDetect = async () => {
  const result = await vpnService.detect(ip);
  
  // Save to localStorage
  const history = JSON.parse(localStorage.getItem('vpn-detection-history') || '[]');
  history.unshift(result); // Add to beginning
  localStorage.setItem('vpn-detection-history', JSON.stringify(history.slice(0, 100)));
};

// Example 2: Query history from backend
const response = await axios.get('/api/history', {
  params: {
    page: 1,
    limit: 20,
    verdict: 'PROXY/VPN',
    startDate: '2026-03-01',
    endDate: '2026-03-06'
  }
});

console.log(response.data.lookups);
console.log(response.data.pagination);

// Example 3: Get statistics
const stats = await axios.get('/api/history/stats/overview');
console.log(stats.data);
// {
//   total: 1523,
//   vpn: 342,
//   original: 1181,
//   vpnPercentage: 22
// }
```

---

## Module 6: Frontend Components

### Overview
**Purpose:** User interface for IP detection and analysis  
**Location:** `frontend/src/components/`  
**Owner:** Hitesh  
**Tech:** React + TypeScript + Material-UI

### Component Architecture

```
App.tsx
├── Navbar.tsx (Navigation)
├── Home.tsx (Landing + Quick Detect)
├── IPDetector.tsx (Single IP Analysis)
├── BulkAnalysis.tsx (Multiple IPs)
└── HistoryView.tsx (Lookup History)
```

### Component 1: IPDetector

```tsx
// IPDetector.tsx - Main detection interface
import React, { useState } from 'react';
import {
  Container,
  TextField,
  Button,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Box,
  Chip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import axios from 'axios';

interface DetectionResult {
  ip: string;
  verdict: string;
  score: number;
  threatLevel: string;
  checks: Array<{
    type: string;
    result: boolean;
    details: string;
    provider?: string;
  }>;
  whois?: any;
  cached?: boolean;
  timestamp: string;
}

function IPDetector() {
  const [ip, setIp] = useState<string>('');
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleDetect = async () => {
    setError('');
    setResult(null);

    // Validation
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipRegex.test(ip)) {
      setError('Invalid IP address format');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('http://localhost:5000/api/detect', {
        ip: ip
      });

      setResult(response.data);

      // Save to history (localStorage)
      const history = JSON.parse(localStorage.getItem('vpn-detection-history') || '[]');
      history.unshift(response.data);
      localStorage.setItem('vpn-detection-history', JSON.stringify(history.slice(0, 100)));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Detection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        IP Detection
      </Typography>

      {/* Input Section */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          label="Enter IP Address"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="e.g., 8.8.8.8"
          fullWidth
          error={!!error}
          helperText={error}
          onKeyPress={(e) => {
            if (e.key === 'Enter') handleDetect();
          }}
        />
        <Button
          variant="contained"
          onClick={handleDetect}
          disabled={loading || !ip}
          sx={{ minWidth: 120 }}
        >
          {loading ? <CircularProgress size={24} /> : 'Detect'}
        </Button>
      </Box>

      {/* Result Card */}
      {result && (
        <Card>
          <CardContent>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h5">
                {result.ip}
              </Typography>
              {result.cached && (
                <Chip label="Cached Result" color="info" size="small" />
              )}
            </Box>

            {/* Verdict */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Verdict: 
                <Chip
                  label={result.verdict}
                  color={result.verdict === 'PROXY/VPN' ? 'error' : 'success'}
                  sx={{ ml: 1 }}
                />
              </Typography>

              {/* Threat Score Progress */}
              <Typography variant="body2" gutterBottom>
                Threat Score: {result.score}/100
              </Typography>
              <LinearProgress
                variant="determinate"
                value={result.score}
                color={result.score > 60 ? 'error' : result.score > 40 ? 'warning' : 'success'}
                sx={{ height: 10, borderRadius: 5 }}
              />

              {/* Threat Level */}
              <Typography variant="body2" sx={{ mt: 1 }}>
                Threat Level: 
                <Chip
                  label={result.threatLevel}
                  color={
                    result.threatLevel === 'HIGH' ? 'error' :
                    result.threatLevel === 'MEDIUM' ? 'warning' :
                    result.threatLevel === 'LOW' ? 'info' : 'success'
                  }
                  size="small"
                  sx={{ ml: 1 }}
                />
              </Typography>
            </Box>

            {/* Detection Checks */}
            <Typography variant="h6" gutterBottom>
              Detection Checks
            </Typography>
            <List>
              {result.checks.map((check, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    {check.result ? (
                      <CheckCircleIcon color="error" />
                    ) : (
                      <CancelIcon color="disabled" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={check.type}
                    secondary={check.details}
                  />
                </ListItem>
              ))}
            </List>

            {/* WHOIS Information */}
            {result.whois && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>WHOIS Information</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {result.whois.organization && (
                    <Typography variant="body2">
                      <strong>Organization:</strong> {result.whois.organization}
                    </Typography>
                  )}
                  {result.whois.country && (
                    <Typography variant="body2">
                      <strong>Country:</strong> {result.whois.country}
                    </Typography>
                  )}
                  {result.whois.netname && (
                    <Typography variant="body2">
                      <strong>Network Name:</strong> {result.whois.netname}
                    </Typography>
                  )}
                  {result.whois.created && (
                    <Typography variant="body2">
                      <strong>Created:</strong> {result.whois.created}
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            )}

            {/* Timestamp */}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Analyzed: {new Date(result.timestamp).toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}

export default IPDetector;
```

### Component 2: BulkAnalysis

```tsx
// BulkAnalysis.tsx - Multiple IP analysis
import React, { useState } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Box,
  LinearProgress,
  CircularProgress
} from '@mui/material';
import axios from 'axios';

function BulkAnalysis() {
  const [ipList, setIpList] = useState<string>('');
  const [results, setResults] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleAnalyze = async () => {
    const ips = ipList.split('\n')
      .map(ip => ip.trim())
      .filter(Boolean);

    if (ips.length === 0) {
      alert('Please enter at least one IP address');
      return;
    }

    if (ips.length > 100) {
      alert('Maximum 100 IPs allowed');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('http://localhost:5000/api/detect/bulk', {
        ips: ips
      });

      setResults(response.data.results);
      setSummary(response.data.summary);
    } catch (error) {
      alert('Bulk analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Bulk IP Analysis
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          label="Enter IP Addresses (one per line)"
          value={ipList}
          onChange={(e) => setIpList(e.target.value)}
          multiline
          rows={10}
          fullWidth
          placeholder="8.8.8.8&#10;1.1.1.1&#10;185.201.10.50"
        />
      </Box>

      <Button
        variant="contained"
        onClick={handleAnalyze}
        disabled={loading || !ipList}
        fullWidth
      >
        {loading ? <CircularProgress size={24} /> : `Analyze ${ipList.split('\n').filter(Boolean).length} IPs`}
      </Button>

      {/* Summary Statistics */}
      {summary && (
        <Paper sx={{ p: 2, mt: 3 }}>
          <Typography variant="h6" gutterBottom>Summary</Typography>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Chip label={`Clean: ${summary.clean}`} color="success" />
            <Chip label={`Suspicious: ${summary.suspicious}`} color="warning" />
            <Chip label={`VPN/Proxy: ${summary.vpn}`} color="error" />
          </Box>
        </Paper>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <TableContainer component={Paper} sx={{ mt: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>IP Address</TableCell>
                <TableCell>Verdict</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Threat Level</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((result, index) => (
                <TableRow key={index} hover>
                  <TableCell>{result.ip}</TableCell>
                  <TableCell>
                    <Chip
                      label={result.verdict}
                      color={result.verdict === 'PROXY/VPN' ? 'error' : 'success'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 100 }}>
                        <LinearProgress
                          variant="determinate"
                          value={result.score}
                          color={result.score > 60 ? 'error' : result.score > 40 ? 'warning' : 'success'}
                        />
                      </Box>
                      <Typography variant="body2">{result.score}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={result.threatLevel}
                      color={
                        result.threatLevel === 'HIGH' ? 'error' :
                        result.threatLevel === 'MEDIUM' ? 'warning' :
                        result.threatLevel === 'LOW' ? 'info' : 'success'
                      }
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
}

export default BulkAnalysis;
```

---

## Usage Examples

### Example 1: Single IP Detection

```bash
# Using curl
curl -X POST http://localhost:5000/api/detect \
  -H "Content-Type: application/json" \
  -d '{"ip": "8.8.8.8"}'
```

```javascript
// Using JavaScript/Frontend
const vpnService = {
  detect: async (ip) => {
    const response = await axios.post('/api/detect', { ip });
    return response.data;
  }
};

// Usage
const result = await vpnService.detect('8.8.8.8');
console.log(result.verdict); // "ORIGINAL"
console.log(result.score);   // 5
```

### Example 2: Bulk Detection

```bash
# Using curl
curl -X POST http://localhost:5000/api/detect/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "ips": ["8.8.8.8", "1.1.1.1", "185.201.10.50"]
  }'
```

### Example 3: History Query

```bash
# Get recent lookups
curl 'http://localhost:5000/api/history?page=1&limit=20'

# Get VPN lookups only
curl 'http://localhost:5000/api/history?verdict=PROXY/VPN'

# Search by IP
curl 'http://localhost:5000/api/history?search=8.8.8'

# Get statistics
curl 'http://localhost:5000/api/history/stats/overview'
```

### Example 4: Export Data

```bash
# Export to CSV
curl 'http://localhost:5000/api/history/export/csv' -o history.csv
```

---

## API Reference

### Endpoints Summary

| Method | Endpoint                        | Description                |
|--------|---------------------------------|----------------------------|
| POST   | /api/detect                     | Single IP detection        |
| POST   | /api/detect/bulk                | Bulk IP detection          |
| GET    | /api/history                    | List lookups (paginated)   |
| GET    | /api/history/:id                | Get specific lookup        |
| DELETE | /api/history/:id                | Delete lookup              |
| GET    | /api/history/export/csv         | Export to CSV              |
| GET    | /api/history/stats/overview     | Dashboard statistics       |
| GET    | /health                         | Health check               |

### Request/Response Schemas

#### POST /api/detect

**Request:**
```json
{
  "ip": "8.8.8.8"
}
```

**Response:**
```json
{
  "ip": "8.8.8.8",
  "verdict": "ORIGINAL",
  "score": 5,
  "threatLevel": "CLEAN",
  "checks": [
    {
      "type": "IPQualityScore",
      "result": false,
      "details": "Fraud Score: 5, VPN: false"
    }
  ],
  "whois": {
    "organization": "Google LLC",
    "country": "US"
  },
  "cached": false,
  "timestamp": "2026-03-06T06:30:00.000Z"
}
```

---

**End of Module Documentation**

For implementation details, see individual module files in the codebase.
