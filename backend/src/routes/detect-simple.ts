import { Router, Request, Response } from 'express';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import cacheService from '../services/cache.service';
import Lookup from '../models/Lookup';

const execAsync = promisify(exec);
const router = Router();

// WHOIS Lookup Function — uses WhoisXML API (at_lWLHJxRdcd42CsxFainnkKQIHJ38n)
const getWhoisInfo = async (input: string): Promise<any> => {
  try {
    const apiKey = process.env.WHOIS_API_KEY;

    // Primary: WhoisXML API (works for both IPs and domains)
    if (apiKey) {
      try {
        const whoisResponse = await axios.get(
          'https://www.whoisxmlapi.com/whoisserver/WhoisService',
          {
            params: { apiKey, domainName: input, outputFormat: 'JSON' },
            timeout: 10000
          }
        );
        const record = whoisResponse.data?.WhoisRecord || whoisResponse.data;
        return {
          raw: JSON.stringify(record, null, 2),
          parsed: parseWhoisApiResponse(record),
          source: 'WhoisXML API'
        };
      } catch (apiErr: any) {
        console.log('WhoisXML API error:', apiErr.message);
      }
    }

    // Fallback: system whois command (Linux/Mac)
    try {
      const { stdout } = await execAsync(`whois ${input}`);
      return {
        raw: stdout,
        parsed: parseWhoisData(stdout),
        source: 'System WHOIS'
      };
    } catch {
      return { error: 'WHOIS lookup failed', parsed: {} };
    }
  } catch (error: any) {
    console.error('WHOIS lookup error:', error.message);
    return { error: 'WHOIS lookup failed', message: error.message };
  }
};

// Parse raw text block to extract IP-block fields (NetRange, NetName, OriginAS, etc.)
const parseRawTextBlock = (raw: string, parsed: any) => {
  if (!raw) return;
  const lines = raw.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();
    if (!value) continue;
    if ((key === 'netrange' || key === 'inetnum') && !parsed.inetnum) parsed.inetnum = value;
    if (key === 'cidr' && !parsed.cidr) parsed.cidr = value;
    if ((key === 'netname') && !parsed.netname) parsed.netname = value;
    if (key === 'originas' && !parsed.asn && value) parsed.asn = value;
    if (key === 'organization' && !parsed.organization) parsed.organization = value;
    if (key === 'descr' && !parsed.description) parsed.description = value;
    if (key === 'country' && !parsed.country) parsed.country = value;
    if (key === 'city' && !parsed.city) parsed.city = value;
    if (key === 'stateprov' && !parsed.state) parsed.state = value;
  }
};

// Parse WhoisXML API JSON response — extracts all relevant fields
const parseWhoisApiResponse = (data: any) => {
  if (!data) return {};
  const parsed: any = {};

  // For IP lookups, WhoisXML puts the actual block data inside subRecords[]
  const sub = Array.isArray(data.subRecords) && data.subRecords.length > 0 ? data.subRecords[0] : null;

  const reg = sub?.registrant || data.registrant || data.registrantContact || data.registryData?.registrant;
  const admin = sub?.administrativeContact || data.administrativeContact || data.adminContact;
  const tech = sub?.technicalContact || data.technicalContact || data.techContact;
  const registrar = data.registrar || data.registryData?.registrar;
  const netData = data.networkData;

  if (reg?.organization) parsed.organization = reg.organization;
  else if (data.registryData?.registrant?.organization) parsed.organization = data.registryData.registrant.organization;

  if (reg?.name) parsed.registrant = reg.name;
  else if (data.registryData?.registrant?.name) parsed.registrant = data.registryData.registrant.name;

  if (reg?.email) parsed.email = reg.email;
  if (reg?.country) parsed.country = reg.country;
  else if (data.registryData?.registrant?.country) parsed.country = data.registryData.registrant.country;

  if (reg?.city) parsed.city = reg.city;
  if (reg?.state || reg?.stateProv) parsed.state = reg.state || reg.stateProv;
  if (reg?.postalCode) parsed.postalCode = reg.postalCode;
  if (reg?.phone || reg?.telephone) parsed.phone = reg.phone || reg.telephone;

  if (admin?.organization) parsed.adminOrg = admin.organization;
  if (tech?.organization) parsed.techOrg = tech.organization;

  // Top-level registrar for IP responses (e.g. "ARIN")
  if (data.registrarName) parsed.registrar = data.registrarName;
  if (registrar?.registrarName) parsed.registrar = parsed.registrar || registrar.registrarName;
  if (registrar?.whoisServer) parsed.whoisServer = registrar.whoisServer;

  if (data.createdDate) parsed.created = data.createdDate;
  if (data.updatedDate) parsed.updated = data.updatedDate;
  if (data.expiresDate) parsed.expires = data.expiresDate;
  if (data.domainName) parsed.domain = data.domainName;

  // Sub-record dates (IP blocks have createdDate/updatedDate here)
  if (sub?.createdDate) parsed.created = parsed.created || sub.createdDate;
  if (sub?.updatedDate) parsed.updated = parsed.updated || sub.updatedDate;

  // Network / IP-specific
  if (netData?.ipAddress) parsed.ipAddress = netData.ipAddress;
  if (netData?.networkRange) parsed.networkRange = netData.networkRange;
  if (netData?.inetnum) parsed.inetnum = netData.inetnum;
  if (netData?.netname) parsed.netname = netData.netname;
  if (netData?.description) parsed.description = netData.description;

  // Fallback for raw fields
  if (data.netname) parsed.netname = data.netname;
  if (data.description) parsed.description = data.description;
  if (data.inetnum) parsed.inetnum = data.inetnum;
  if (data.asn) parsed.asn = data.asn;
  if (data.asnName) parsed.asnName = data.asnName;

  // WhoisXML custom fields in registryData (netRange, netName, ASN)
  const regData = data.registryData;
  if (regData) {
    if (regData.registrarName) parsed.registrar = parsed.registrar || regData.registrarName;
    if (regData.createdDate) parsed.created = parsed.created || regData.createdDate;
    if (regData.updatedDate) parsed.updated = parsed.updated || regData.updatedDate;
    // Dynamic custom fields (netRange, netName, ASN, etc.)
    for (let i = 1; i <= 5; i++) {
      const name: string = regData[`customField${i}Name`];
      const value: string = regData[`customField${i}Value`];
      if (name && value) {
        const n = name.toLowerCase();
        if (n.includes('netrange') || n.includes('inetnum')) parsed.inetnum = parsed.inetnum || value;
        if (n.includes('netname')) parsed.netname = parsed.netname || value;
        if (n.includes('asn')) parsed.asn = parsed.asn || value;
        if (n.includes('country')) parsed.country = parsed.country || value;
      }
    }
    // Parse rawText inside registryData for IP-block fields
    if (regData.rawText) parseRawTextBlock(regData.rawText, parsed);
  }

  // Parse rawText from subRecord (most complete IP block data)
  if (sub?.rawText) parseRawTextBlock(sub.rawText, parsed);

  // contactEmail top-level
  if (data.contactEmail) parsed.email = parsed.email || data.contactEmail;
  // estimatedDomainAge
  if (data.estimatedDomainAge) parsed.domainAge = `${data.estimatedDomainAge} days`;

  return parsed;
};

// Parse raw system whois output (fallback)
const parseWhoisData = (raw: string) => {
  const lines = raw.split('\n');
  const data: any = {};
  for (const line of lines) {
    if (line.includes(':')) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
      if (cleanKey && value) {
        if (cleanKey.includes('name')) data.registrant = value;
        if (cleanKey.includes('org')) data.organization = value;
        if (cleanKey.includes('country')) data.country = value;
        if (cleanKey.includes('created') || cleanKey.includes('registration')) data.created = value;
        if (cleanKey.includes('email')) data.email = value;
        if (cleanKey.includes('netname')) data.netname = value;
        if (cleanKey.includes('descr')) data.description = value;
      }
    }
  }
  return data;
};

// True CDNs, consumer ISPs and major branded services — almost never VPN endpoints
const LEGITIMATE_ORG_WHITELIST = [
  'cloudflare', 'akamai', 'fastly', 'cloudfront',
  'google', 'amazon', 'amazonaws', 'microsoft', 'azure',
  'apple', 'meta platforms', 'facebook', 'netflix', 'twitter', 'x corp',
  // Consumer ISPs — residential lines, never VPN endpoints
  'comcast', 'verizon', 'at&t', 'att ', 'cox communications', 'spectrum',
  'charter', 'centurylink', 'lumen', 'level 3', 'cogent', 'telia', 'ntt ',
  'he.net', 'hurricane electric', 'zayo', 'tata ', 'seaborn', 'telstra',
  'bt group', 'deutsche telekom', 'orange', 'vodafone', 'telefonica',
  'bsnl', 'airtel', 'reliance jio', 'jio ', 'idea cellular',
  // Academic / government
  'university', 'college', 'institute', 'school', 'government', 'ministry',
  'national informatics', 'nic.in',
];

// Known VPN/privacy provider names and generic VPN/proxy keywords
const VPN_PROVIDER_KEYWORDS = [
  'proton', 'nordvpn', 'nord vpn', 'expressvpn', 'express vpn',
  'surfshark', 'mullvad', 'ipvanish', 'torguard', 'vyprvpn',
  'hidemyass', 'cyberghost', 'windscribe', 'tunnelbear',
  'privateinternetaccess', 'privatevpn', 'fastestvpn', 'purevpn',
  'hide.me', 'ivpn', 'azirevpn', 'airvpn', 'perfect privacy',
  'strongvpn', 'hotspot shield', 'zenmate', 'hola vpn', 'adguard vpn',
  'astrill', 'liquidvpn', 'bolehvpn'
];
const VPN_GENERIC_KEYWORDS = [
  'vpn', 'proxy', 'anonymizing', 'anonymous network', 'privacy network',
  'exit node', 'tor exit', 'socks proxy', 'openvpn', 'wireguard provider'
];

// Companies that primarily provide VPN/proxy infrastructure or anonymous hosting
const VPN_HOSTING_COMPANIES = [
  'neto corp', 'combahton', 'm247', 'datacamp', 'serverius', 'packetHub',
  'pq hosting', 'host palace', 'flyservers', 'aeza group', 'aeza.net',
  'stark industries', 'serverastra', 'genc bv', 'hostbaltic', 'hostbaltic',
  'pptechnology', 'bg-hetzner', 'fg-hetzner', 'serverius datacenter',
  'privatelayer', 'fdcservers', 'quadranet', 'tzulo', 'psychz',
  'gstigroup', 'total server', 'dataclub', 'neterra', 'alsycon'
];

const isVPNOrg = (org: string): { matched: boolean; score: number } => {
  const lower = (org || '').toLowerCase();
  // Always return clean for known legitimate providers
  if (LEGITIMATE_ORG_WHITELIST.some(k => lower.includes(k))) return { matched: false, score: 0 };
  if (VPN_PROVIDER_KEYWORDS.some(k => lower.includes(k))) return { matched: true, score: 45 };
  if (VPN_GENERIC_KEYWORDS.some(k => lower.includes(k))) return { matched: true, score: 30 };
  if (VPN_HOSTING_COMPANIES.some(k => lower.includes(k))) return { matched: true, score: 35 };
  if (VPS_HOSTING_PROVIDERS.some(k => lower.includes(k))) return { matched: true, score: 20 };
  if (lower.includes('hosting') || lower.includes('datacenter') || lower.includes('data center')) return { matched: true, score: 10 };
  if (lower.includes('server') || lower.includes('cloud')) return { matched: true, score: 8 };
  return { matched: false, score: 0 };
};

// Org names used when RIPE/APNIC assignee wants anonymity — common for VPN/proxy providers
const SUSPICIOUS_ORG_PHRASES = [
  'private customer', 'private person', 'individual', 'broadband subscriber',
  'dsl customer', 'residential customer', 'end customer', 'direct customer',
  'hosting customer', 'internet customer', 'not disclosed', 'withheld for privacy'
];
const SUSPICIOUS_NETNAME_PATTERN = /^net-\d+[-.]\d+[-.]\d+/i;
const VPS_NETNAME_PATTERN = /^(vps|vserver|dedicated|dedi|kvm|xen|vm)-/i;

// VPS / dedicated server companies — legitimate but frequently used to host VPN servers
const VPS_HOSTING_PROVIDERS = [
  'ovh', 'hetzner', 'digitalocean', 'linode', 'vultr', 'contabo',
  'ionos', '1&1', 'hostinger', 'kamatera', 'upcloud', 'racknerd',
  'buyvm', 'frantech', 'leaseweb', 'internap', 'uk-2 ltd', 'uk-2.net',
  'dacentec', 'fdcservers', 'tzulo', 'quadranet',
];

// Detect suspicious WHOIS allocation patterns common in VPN/proxy providers
const analyzeWhoisSuspicion = (parsed: any): { score: number; flags: string[] } => {
  if (!parsed) return { score: 0, flags: [] };
  const flags: string[] = [];
  let score = 0;

  const org = (parsed.organization || '').toLowerCase();
  const netname = parsed.netname || '';

  // Skip entirely for true CDNs / consumer ISPs
  if (LEGITIMATE_ORG_WHITELIST.some(k => org.includes(k))) return { score: 0, flags: [] };

  // VPS hosting provider — legit company but anyone can rent a box and run VPN software
  if (VPS_HOSTING_PROVIDERS.some(k => org.includes(k))) {
    score += 25;
    flags.push(`VPS hosting provider: ${parsed.organization}`);
  }

  // Netname explicitly says VPS / dedicated (e.g. VPS-UK2, DEDICATED-1)
  if (VPS_NETNAME_PATTERN.test(netname)) {
    score += 30;
    flags.push(`VPS/dedicated netblock: ${netname}`);
  }

  // Private/anonymous allocation — RIPE uses this when assignee hides their identity
  if (SUSPICIOUS_ORG_PHRASES.some(p => org.includes(p))) {
    score += 45;
    flags.push(`Private allocation: "${parsed.organization}"`);
  }

  // Netname equals the raw CIDR (e.g. NET-37-230-53-0-24)
  if (SUSPICIOUS_NETNAME_PATTERN.test(netname)) {
    score += 15;
    flags.push(`CIDR-style netname: ${netname}`);
  }

  // Very recently registered IP block
  let ageDays: number | null = null;
  if (parsed.domainAge) {
    const m = (parsed.domainAge as string).match(/(\d+)/);
    if (m) ageDays = parseInt(m[1]);
  } else if (parsed.created) {
    const created = new Date(parsed.created);
    if (!isNaN(created.getTime())) {
      ageDays = Math.floor((Date.now() - created.getTime()) / 86400000);
    }
  }
  if (ageDays !== null) {
    if (ageDays < 30)       { score += 20; flags.push(`Very new block: ${ageDays}d`); }
    else if (ageDays < 90)  { score += 15; flags.push(`New block: ${ageDays}d`); }
    else if (ageDays < 180) { score += 8;  flags.push(`Recent block: ${ageDays}d`); }
  }

  return { score, flags };
};

// Enhanced VPN/Proxy detection using API keys from .env
const detectVPN = async (ip: string) => {
  const checks = [];
  let score = 0;
  let whoisData: any = null;

  try {
    // Fetch WHOIS information
    whoisData = await getWhoisInfo(ip);
    
    if (whoisData && whoisData.parsed) {
      const whoisOrg = whoisData.parsed.organization || '';
      const whoisCheck = isVPNOrg(whoisOrg);
      const whoisSuspicion = analyzeWhoisSuspicion(whoisData.parsed);

      // Score from org-name match
      if (whoisCheck.matched && whoisCheck.score >= 30) {
        score += Math.floor(whoisCheck.score * 0.5);
      }
      // Score from behavioural heuristics (private allocation, new block, etc.)
      score += whoisSuspicion.score;

      const isSuspicious = (whoisCheck.matched && whoisCheck.score >= 30) || whoisSuspicion.score >= 35;
      const suspicionNote = whoisSuspicion.flags.length > 0 ? ` ⚠️ ${whoisSuspicion.flags.join('; ')}` : '';
      checks.push({
        type: 'WHOIS Records',
        result: isSuspicious,
        details: `Org: ${whoisOrg || 'N/A'}, Country: ${whoisData.parsed.country || 'N/A'}${suspicionNote}`,
        data: whoisData.parsed
      });
    }
    // 1. ip-api.com Check (free, no key required — 45 req/min, returns proxy+hosting flags)
    try {
      const ipapiResponse = await axios.get(
        `http://ip-api.com/json/${ip}?fields=status,message,proxy,hosting,isp,org,as`,
        { timeout: 5000 }
      );

      if (ipapiResponse.data.status === 'success') {
        const isProxy = ipapiResponse.data.proxy || false;
        const isHosting = ipapiResponse.data.hosting || false;
        const flagged = isProxy || isHosting;

        const detailParts: string[] = [
          `Proxy/VPN: ${isProxy}`,
          `Hosting: ${isHosting}`,
        ];
        if (ipapiResponse.data.isp) detailParts.push(`ISP: ${ipapiResponse.data.isp}`);
        if (isHosting && !isProxy) detailParts.push('⚠️ Datacenter/Hosting IP');

        checks.push({
          type: 'IP-API (Proxy Check)',
          result: flagged,
          details: detailParts.join(', '),
        });

        if (isProxy) score += 40;   // Confirmed proxy/VPN/Tor
        if (isHosting) score += 20; // Datacenter — primary vehicle for VPN exit nodes
      } else {
        checks.push({
          type: 'IP-API (Proxy Check)',
          result: false,
          details: `API error: ${ipapiResponse.data.message || 'Unknown'}`,
        });
      }
    } catch (err: any) {
      console.log('ip-api.com error:', err.message);
      checks.push({
        type: 'IP-API (Proxy Check)',
        result: false,
        details: `API unavailable: ${err.message}`,
      });
    }

    // 1b. IPQualityScore (supplementary — used only if key configured and has credits)
    if (process.env.IPQUALITYSCORE_API_KEY) {
      try {
        const ipqsResponse = await axios.get(
          `https://ipqualityscore.com/api/json/ip/${process.env.IPQUALITYSCORE_API_KEY}/${ip}`,
          { timeout: 5000 }
        );

        if (ipqsResponse.data.success) {
          const vpnDetected = ipqsResponse.data.vpn || ipqsResponse.data.proxy || ipqsResponse.data.tor;
          const isHosting = ipqsResponse.data.hosting || false;
          const fraudScore = ipqsResponse.data.fraud_score || 0;
          const flagged = vpnDetected || isHosting;

          const detailParts = [
            `Fraud Score: ${fraudScore}`,
            `VPN: ${ipqsResponse.data.vpn}`,
            `Proxy: ${ipqsResponse.data.proxy}`,
          ];
          if (isHosting) detailParts.push('⚠️ Hosting/Datacenter IP');

          checks.push({
            type: 'IPQualityScore',
            result: flagged,
            details: detailParts.join(', '),
            score: fraudScore
          });

          if (vpnDetected) score += 35;
          if (isHosting) score += 20;
          score += Math.min(fraudScore / 3, 20);
        } else {
          checks.push({
            type: 'IPQualityScore',
            result: false,
            details: `API error: ${ipqsResponse.data.message || 'Request rejected'} (credits may be exhausted)`,
            score: 0
          });
        }
      } catch (err: any) {
        console.log('IPQualityScore API error:', err.message);
      }
    }

    // 2. AbuseIPDB API Check
    if (process.env.ABUSEIPDB_API_KEY) {
      try {
        const abuseResponse = await axios.get(
          `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`,
          {
            headers: { 'Key': process.env.ABUSEIPDB_API_KEY },
            timeout: 5000
          }
        );
        
        if (abuseResponse.data.data) {
          const abuseScore = abuseResponse.data.data.abuseConfidenceScore || 0;
          const isWhitelisted = abuseResponse.data.data.isWhitelisted;
          
          checks.push({
            type: 'AbuseIPDB',
            result: abuseScore > 25,
            details: `Abuse Score: ${abuseScore}%, Whitelisted: ${isWhitelisted}`,
            score: abuseScore
          });
          
          if (abuseScore > 75) score += 20;
          else if (abuseScore > 50) score += 15;
          else if (abuseScore > 25) score += 10;
          else if (abuseScore > 10) score += 5;
        }
      } catch (err: any) {
        console.log('AbuseIPDB API error:', err.message);
        checks.push({
          type: 'AbuseIPDB',
          result: false,
          details: `API unavailable: ${err.message}`,
          score: 0
        });
      }
    } else {
      checks.push({
        type: 'AbuseIPDB',
        result: false,
        details: 'API key not configured',
        score: 0
      });
    }

    // 3. IPInfo API Check
    if (process.env.IPINFO_TOKEN) {
      try {
        const ipinfoResponse = await axios.get(
          `https://ipinfo.io/${ip}/json?token=${process.env.IPINFO_TOKEN}`,
          { timeout: 5000 }
        );
        
        if (ipinfoResponse.data) {
          const orgStr = ipinfoResponse.data.org || '';
          const orgCheck = isVPNOrg(orgStr);
          
          checks.push({
            type: 'IPInfo',
            result: orgCheck.matched,
            details: `Org: ${orgStr || 'Unknown'}, Country: ${ipinfoResponse.data.country || 'Unknown'}`,
            location: `${ipinfoResponse.data.city || ''}, ${ipinfoResponse.data.country || ''}`
          });
          
          score += orgCheck.score;
        }
      } catch (err: any) {
        console.log('IPInfo API error:', err.message);
        checks.push({
          type: 'IPInfo',
          result: false,
          details: `API unavailable: ${err.message}`,
          location: 'Unknown'
        });
      }
    } else {
      checks.push({
        type: 'IPInfo',
        result: false,
        details: 'API token not configured',
        location: 'Unknown'
      });
    }

    // 4. Check against known VPN IP ranges (fallback)
    const vpnRanges = [
      { provider: 'NordVPN', pattern: /^(185\.201\.|193\.29\.|212\.102\.|91\.203\.|185\.220\.|5\.253\.|37\.120\.|94\.198\.|185\.234\.)/ },
      { provider: 'ExpressVPN', pattern: /^(149\.248\.|103\.253\.|169\.50\.|64\.235\.|185\.212\.)/ },
      { provider: 'ProtonVPN', pattern: /^(138\.199\.|149\.90\.|185\.159\.|185\.107\.|89\.147\.|185\.230\.|37\.19\.|194\.165\.|185\.177\.|193\.148\.|45\.83\.|91\.108\.|185\.82\.|194\.126\.|62\.102\.|185\.180\.|185\.117\.|188\.216\.|185\.156\.|205\.147\.)/ },
      { provider: 'Surfshark', pattern: /^(217\.138\.|37\.120\.|185\.225\.|156\.146\.|45\.87\.|194\.165\.)/ },
      { provider: 'Mullvad', pattern: /^(193\.138\.|185\.213\.|91\.90\.|45\.83\.|146\.70\.|185\.254\.)/ },
      { provider: 'Tor Exit', pattern: /^(185\.220\.|199\.87\.|62\.102\.|176\.10\.|5\.199\.|23\.129\.)/ },
      { provider: 'VPN Provider', pattern: /^(104\.238\.|104\.16\.)/ },
    ];

    const vpnMatch = vpnRanges.find(range => range.pattern.test(ip));
    if (vpnMatch) {
      checks.push({
        type: 'VPN Range Match',
        result: true,
        details: `Matched ${vpnMatch.provider} IP range`,
        provider: vpnMatch.provider
      });
      // Strong indicator - known VPN provider range
      score += 70;
    }

    // 5. Private IP check — RFC 1918 ranges only
    // 10.0.0.0/8, 172.16.0.0/12 (172.16–172.31), 192.168.0.0/16
    const isPrivate = ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      (() => {
        const parts = ip.split('.');
        if (parts.length !== 4) return false;
        const second = parseInt(parts[1], 10);
        return parts[0] === '172' && second >= 16 && second <= 31;
      })();
    if (isPrivate) {
      checks.push({
        type: 'Private IP',
        result: true,
        details: 'Private network IP address'
      });
      score += 10;
    }

  } catch (error) {
    console.error('Detection error:', error);
  }

  // If no checks were successful, add a default check
  if (checks.length === 0) {
    checks.push({
      type: 'Basic Analysis',
      result: false,
      details: 'No VPN/Proxy indicators detected'
    });
  }

  // Ensure score is between 0-100
  score = Math.min(Math.max(score, 0), 100);
  
  // Lower threshold for development version
  const verdict = score >= 40 ? 'PROXY/VPN' : 'ORIGINAL';
  const threatLevel = score > 60 ? 'HIGH' : score > 40 ? 'MEDIUM' : score > 20 ? 'LOW' : 'CLEAN';

  return {
    ip,
    verdict,
    score: Math.round(score),
    threatLevel,
    checks,
    whois: whoisData,
    timestamp: new Date().toISOString(),
    analysis: {
      isProxy: checks.some(c => c.type === 'IPQualityScore' && c.result && (c.details?.toLowerCase().includes('proxy: true'))) || score > 50,
      isVPN: checks.some(c => (c.type === 'IPQualityScore' && c.details?.toLowerCase().includes('vpn: true')) || c.type === 'VPN Range Match') || score > 55,
      isTor: checks.some(c => c.details?.toLowerCase().includes('tor')),
      isHosting: checks.some(c => c.type === 'IPQualityScore' && c.details?.toLowerCase().includes('hosting/datacenter')) || checks.some(c => c.details?.toLowerCase().includes('vps hosting'))
    }
  };
};

// Simple detection logic
const detectHandler = async (req: Request, res: Response) => {
  try {
    const { ip } = req.body;

    if (!ip || typeof ip !== 'string' || !ip.trim()) {
      return res.status(400).json({ error: 'IP address or domain is required' });
    }

    const input = ip.trim().toLowerCase();

    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^[0-9a-f:]+$/i;
    const domainRegex = /^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)+$/i;

    let resolvedIP = input;
    let inputDomain: string | null = null;

    if (ipv4Regex.test(input) || ipv6Regex.test(input)) {
      // It's an IP address — use as-is
      resolvedIP = input;
    } else if (domainRegex.test(input)) {
      // It's a domain — resolve to IP first
      inputDomain = input;
      try {
        const { promises: dns } = await import('dns');
        const addresses = await dns.resolve4(input).catch(() => dns.resolve6(input));
        if (!addresses || addresses.length === 0) {
          return res.status(400).json({ error: `Could not resolve domain: ${input}` });
        }
        resolvedIP = addresses[0];
        console.log(`🌐 Domain ${input} resolved to ${resolvedIP}`);
      } catch {
        return res.status(400).json({ error: `DNS resolution failed for: ${input}` });
      }
    } else {
      return res.status(400).json({ error: 'Invalid IP address or domain name' });
    }

    // Check Redis cache first (skip if forceRefresh requested)
    const cacheKey = `detect:${resolvedIP}`;
    const forceRefresh = req.body.forceRefresh === true || req.query.forceRefresh === 'true';
    const cachedResult = forceRefresh ? null : await cacheService.get(cacheKey);
    
    if (cachedResult) {
      console.log(`✓ Cache HIT for ${resolvedIP}`);
      return res.json({ ...cachedResult, inputDomain, cached: true });
    }

    console.log(`⚬ Cache MISS for ${resolvedIP} - fetching fresh data`);
    const result = await detectVPN(resolvedIP);
    
    // Store in cache for 1 hour (3600 seconds)
    await cacheService.set(cacheKey, result, 3600);
    
    // Save to MongoDB audit log
    try {
      await Lookup.create({
        ip: result.ip,
        verdict: result.verdict,
        score: result.score,
        whois: result.whois,
        checks: result.checks,
        timestamp: new Date(),
      });
      console.log(`✓ Saved lookup to MongoDB: ${resolvedIP}`);
    } catch (dbError) {
      console.log('MongoDB save skipped:', dbError instanceof Error ? dbError.message : 'Unknown error');
    }
    
    res.json({ ...result, inputDomain, cached: false });
  } catch (err: any) {
    console.error('Detection error:', err);
    res.status(500).json({ 
      error: 'Detection failed',
      message: err.message || 'Unknown error'
    });
  }
};

router.post('/', detectHandler);
router.post('/single', detectHandler);

// Bulk analysis endpoint
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { ips } = req.body;

    if (!ips || !Array.isArray(ips) || ips.length === 0) {
      return res.status(400).json({ error: 'IPs array is required' });
    }

    if (ips.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 IPs allowed per request' });
    }

    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    const validIps = ips.filter((ip: string) => ipRegex.test(ip.trim()));

    if (validIps.length === 0) {
      return res.status(400).json({ error: 'No valid IP addresses found' });
    }

    console.log(`Processing bulk request for ${validIps.length} IPs...`);

    // Process all IPs
    const results = [];
    for (const ip of validIps) {
      try {
        // Check cache first
        const cacheKey = `detect:${ip.trim()}`;
        let result = await cacheService.get(cacheKey);
        
        if (!result) {
          result = await detectVPN(ip.trim());
          await cacheService.set(cacheKey, result, 3600);
          
          // Save to MongoDB
          try {
            await Lookup.create({
              ip: result.ip,
              verdict: result.verdict,
              score: result.score,
              whois: result.whois,
              checks: result.checks,
              timestamp: new Date(),
            });
          } catch (dbError) {
            console.log('MongoDB save skipped for', ip);
          }
        }
        
        results.push(result);
      } catch (error) {
        results.push({
          ip: ip.trim(),
          error: 'Detection failed',
          verdict: 'ERROR',
          score: 0,
          threatLevel: 'UNKNOWN'
        });
      }
    }

    // Calculate summary
    const summary = {
      clean: results.filter((r: any) => r.score < 20).length,
      suspicious: results.filter((r: any) => r.score >= 20 && r.score < 40).length,
      vpn: results.filter((r: any) => r.score >= 40).length
    };

    res.json({
      total: ips.length,
      processed: validIps.length,
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

export default router;
export { detectVPN };
