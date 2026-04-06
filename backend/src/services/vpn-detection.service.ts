import { IPIntelligenceService } from './ip-intelligence.service';
import { NetworkMetricsService } from './network-metrics.service';
import { WhoisService } from './whois.service';
import * as dns from 'dns/promises';

interface DNSAnalysisResult {
  reverseDNS: string | null;
  isVPNPattern: boolean;
  hasMXRecord: boolean;
  txtRecords: string[];
  nameservers: string[];
  anomalies: string[];
  suspiciousPatterns: number;
  reputationScore: number;
}

interface AdvancedBehavioralMetrics {
  asnReputation: number;
  portScanningIndicators: string[];
  geographicalConsistency: number;
  timeBasedPatterns: string[];
  peerReputationScore: number;
}

interface VPNDetectionResult {
  isVPN: boolean;
  confidenceScore: number;
  anomalies: any[];
  behavioralAnalysis: AdvancedBehavioralMetrics;
  riskLevel: 'CLEAN' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detectionMethods: string[];
  metrics: {
    network: any;
    geographic: any;
    intelligence: any;
    dns: DNSAnalysisResult & {
      anomalyScore: number;
    };
    whois: {
      confidence: number;
      indicators: string[];
      isLikelyVPN: boolean;
    };
  };
}

export class VPNDetectionService {
  // Known VPN/Proxy ASN patterns
  private static readonly KNOWN_VPN_ASN_PATTERNS = [
    /as\s*396982/i,  // Google LLC (often used by VPNs)
    /as\s*13335/i,   // Cloudflare
    /as\s*16509/i,   // Amazon AWS
    /as\s*15169/i,   // Google Cloud
    /digitalocean/i,
    /vultr/i,
    /ovh/i,
    /hetzner/i,
    /linode/i
  ];

  // VPN provider keywords for advanced pattern matching
  private static readonly VPN_PROVIDER_KEYWORDS = [
    'nordvpn', 'expressvpn', 'surfshark', 'protonvpn', 'mullvad',
    'privatevpn', 'cyberghost', 'purevpn', 'ipvanish', 'tunnelbear',
    'windscribe', 'hidemyass', 'vyprvpn', 'proxy', 'vpn', 'anonymizer',
    'tor-exit', 'relay', 'exit-node'
  ];

  // Suspicious port patterns commonly used by VPN/Proxy services
  private static readonly SUSPICIOUS_PORTS = [1080, 1194, 3128, 8080, 8888, 9050, 9051];

  static async analyzeConnection(ip: string): Promise<VPNDetectionResult> {
    // Fetch IP intelligence, network metrics, DNS info, and WHOIS data in parallel
    const [ipData, networkMetrics, dnsResults, whoisAnalysis] = await Promise.all([
      IPIntelligenceService.getEnhancedIPData(ip),
      NetworkMetricsService.getMetrics(ip),
      this.performDNSAnalysis(ip),
      WhoisService.analyzeWhoisForVPNDetection(ip)
    ]);
    
    // Perform advanced behavioral analysis
    const behavioralMetrics = this.performBehavioralAnalysis(ipData, networkMetrics, dnsResults);
    
    // Calculate individual confidence scores with ML-inspired weighting
    const intelligenceScore = IPIntelligenceService.calculateConfidenceScore(ipData);
    const networkScore = NetworkMetricsService.calculateAnomalyScore(networkMetrics);
    const dnsScore = this.calculateDNSScore(dnsResults);
    const behavioralScore = this.calculateBehavioralScore(behavioralMetrics);
    const asnScore = this.calculateASNReputationScore(ipData);
    
    // Detect anomalies from different sources
    const geoAnomalies = IPIntelligenceService.detectGeographicalAnomalies(ipData);
    const networkAnomalies = NetworkMetricsService.detectAnomalies(networkMetrics);
    const dnsAnomalies = this.detectDNSAnomalies(dnsResults);
    const behavioralAnomalies = this.detectBehavioralAnomalies(behavioralMetrics);

    // Combine all anomalies
    const allAnomalies = [
      ...geoAnomalies, 
      ...networkAnomalies, 
      ...dnsAnomalies,
      ...behavioralAnomalies,
      ...whoisAnalysis.indicators.map((indicator: string) => ({
        type: 'WHOIS_INDICATOR',
        severity: 'medium',
        details: indicator
      }))
    ];

    // Calculate weighted final confidence score with advanced ML-inspired algorithm
    const baseScore = (
      (intelligenceScore * 0.30) +  // IP intelligence databases
      (networkScore * 0.20) +       // Network metrics & port analysis
      (dnsScore * 0.15) +          // DNS patterns & reverse lookup
      (whoisAnalysis.confidence * 0.15) + // WHOIS data analysis
      (behavioralScore * 0.12) +   // Behavioral patterns
      (asnScore * 0.08)            // ASN reputation
    );

    // Advanced confidence boosting with multi-factor confirmation
    let confidenceBoost = 0;
    const detectionMethods: string[] = [];
    
    // Multi-source VPN confirmation
    const confirmationSources = [
      { check: ipData.ipQualityScore?.vpn, name: 'IPQualityScore VPN Database' },
      { check: ipData.proxycheck?.[ip]?.proxy === 'yes', name: 'ProxyCheck Detection' },
      { check: ipData.maxmind?.traits?.is_anonymous_vpn, name: 'MaxMind Anonymous VPN' },
      { check: networkMetrics.ports?.common, name: 'Suspicious Port Detection' },
      { check: dnsResults.isVPNPattern, name: 'DNS Pattern Analysis' },
      { check: whoisAnalysis.isLikelyVPN, name: 'WHOIS Organization Analysis' },
      { check: behavioralMetrics.asnReputation > 70, name: 'ASN Reputation Score' }
    ];

    const confirmedSources = confirmationSources.filter(s => s.check);
    confirmedSources.forEach(s => detectionMethods.push(s.name));
    
    if (confirmedSources.length >= 4) {
      confidenceBoost += 20;
    } else if (confirmedSources.length >= 3) {
      confidenceBoost += 12;
    } else if (confirmedSources.length >= 2) {
      confidenceBoost += 6;
    }

    // High-severity anomaly boost
    const highSeverityAnomalies = allAnomalies.filter(a => a.severity === 'high' || a.severity === 'critical');
    if (highSeverityAnomalies.length >= 3) {
      confidenceBoost += 10;
    }

    // Behavioral pattern boost
    if (behavioralMetrics.portScanningIndicators.length >= 2) {
      confidenceBoost += 8;
      detectionMethods.push('Port Scanning Pattern Detection');
    }

    // Geographical inconsistency boost
    if (behavioralMetrics.geographicalConsistency < 40) {
      confidenceBoost += 7;
      detectionMethods.push('Geographical Anomaly Detection');
    }

    // Adjust final score with boosts and apply sigmoid normalization
    const rawScore = Math.min(100, baseScore + confidenceBoost);
    const adjustedScore = this.applySigmoidNormalization(rawScore);
    
    // Determine risk level
    const riskLevel = this.determineRiskLevel(adjustedScore);

    return {
      isVPN: adjustedScore >= 65,
      confidenceScore: adjustedScore,
      anomalies: allAnomalies,
      behavioralAnalysis: behavioralMetrics,
      riskLevel,
      detectionMethods,
      metrics: {
        network: networkMetrics,
        geographic: {
          locations: Array.from(new Set([
            ipData.ipinfo?.country,
            ipData.ipAPI?.country,
            ipData.maxmind?.country?.iso_code
          ]).values()).filter(Boolean),
          datacenters: {
            isDatacenter: ipData.ipQualityScore?.is_datacenter || ipData.ipAPI?.hosting,
            provider: ipData.ipinfo?.org || ipData.ipAPI?.isp
          },
          asn: ipData.ipinfo?.asn || ipData.ipAPI?.as || '',
          isp: ipData.ipinfo?.org || ipData.ipAPI?.isp || ''
        },
        intelligence: {
          abuseConfidence: ipData.abuseIPDB?.abuseConfidenceScore || 0,
          fraudScore: ipData.ipQualityScore?.fraud_score || 0,
          proxyScore: ipData.proxycheck?.[ip]?.risk || 0,
          dnsblListings: ipData.dnsbl?.length || 0,
          vpnIndicators: {
            isAnonymous: ipData.maxmind?.traits?.is_anonymous || false,
            isVPN: ipData.ipQualityScore?.vpn || ipData.proxycheck?.[ip]?.proxy === 'yes',
            isTor: ipData.ipQualityScore?.tor || false,
            isDatacenter: ipData.ipQualityScore?.is_datacenter || false
          }
        },
        dns: {
          ...dnsResults,
          anomalyScore: dnsScore
        },
        whois: {
          confidence: whoisAnalysis.confidence,
          indicators: whoisAnalysis.indicators,
          isLikelyVPN: whoisAnalysis.isLikelyVPN
        }
      }
    };
  }

  private static async performDNSAnalysis(ip: string): Promise<DNSAnalysisResult> {
    try {
      // Perform reverse DNS lookup
      const reverseDNS = await dns.reverse(ip).catch(() => null);
      
      // Check for MX records (VPN servers typically don't have mail servers)
      const hasMXRecord = await dns.resolveMx(reverseDNS?.[0] || ip).then(() => true).catch(() => false);
      
      // Get TXT records
      const txtRecords = await dns.resolveTxt(reverseDNS?.[0] || ip).then(records => 
        records.map(record => record.join('')))
        .catch(() => []);
      
      // Get nameservers
      const nameservers = await dns.resolveNs(reverseDNS?.[0] || ip).catch(() => []);
      
      // Check if hostname matches common VPN patterns
      const vpnPatterns = /vpn|proxy|tunnel|tor|private|secure|anon/i;
      const isVPNPattern = reverseDNS ? 
        vpnPatterns.test(reverseDNS[0]) :
        false;
      
      const anomalies = [];
      
      // Look for security-related TXT records
      if (txtRecords.some(record => record.toLowerCase().includes('spf1'))) {
        anomalies.push('HAS_SPF_RECORD');
      }
      
      // Check for common VPN provider nameservers
      if (nameservers.some(ns => 
        /cloudflare|aws|google|azure|digital\s*ocean/i.test(ns))) {
        anomalies.push('CLOUD_PROVIDER_NS');
      }
      
      // Calculate suspicious pattern count
      let suspiciousPatterns = 0;
      if (isVPNPattern) suspiciousPatterns++;
      if (!hasMXRecord) suspiciousPatterns++;
      if (anomalies.includes('CLOUD_PROVIDER_NS')) suspiciousPatterns++;
      
      // Calculate reputation score
      const reputationScore = this.calculateDNSReputationScore(
        isVPNPattern, 
        hasMXRecord, 
        anomalies.length, 
        txtRecords.length
      );
      
      return {
        reverseDNS: reverseDNS?.[0] || null,
        isVPNPattern,
        hasMXRecord,
        txtRecords,
        nameservers,
        anomalies,
        suspiciousPatterns,
        reputationScore
      };
    } catch (error) {
      console.error('DNS analysis error:', error);
      return {
        reverseDNS: null,
        isVPNPattern: false,
        hasMXRecord: false,
        txtRecords: [],
        nameservers: [],
        anomalies: [],
        suspiciousPatterns: 0,
        reputationScore: 0
      };
    }
  }

  private static calculateDNSReputationScore(
    isVPNPattern: boolean,
    hasMXRecord: boolean,
    anomalyCount: number,
    txtRecordCount: number
  ): number {
    let score = 0;
    
    if (isVPNPattern) score += 40;
    if (!hasMXRecord) score += 20;
    if (anomalyCount > 2) score += 30;
    if (txtRecordCount === 0) score += 10;
    
    return Math.min(100, score);
  }

  private static calculateDNSScore(dnsResults: DNSAnalysisResult): number {
    let score = 0;
    let factors = 0;

    // VPN pattern in hostname
    if (dnsResults.isVPNPattern) {
      score += 100;
      factors++;
    }

    // Lack of MX records (typical for VPN servers)
    if (!dnsResults.hasMXRecord) {
      score += 60;
      factors++;
    }

    // Cloud provider nameservers
    if (dnsResults.anomalies.includes('CLOUD_PROVIDER_NS')) {
      score += 70;
      factors++;
    }

    // Has SPF record (unusual for VPN servers)
    if (dnsResults.anomalies.includes('HAS_SPF_RECORD')) {
      score -= 30;
      factors++;
    }

    return factors > 0 ? Math.max(0, Math.min(100, score / factors)) : 0;
  }

  private static detectDNSAnomalies(dnsResults: DNSAnalysisResult): any[] {
    const anomalies = [];

    if (dnsResults.isVPNPattern) {
      anomalies.push({
        type: 'VPN_HOSTNAME_PATTERN',
        severity: 'high',
        details: `Hostname contains VPN-related terms: ${dnsResults.reverseDNS}`
      });
    }

    if (!dnsResults.hasMXRecord) {
      anomalies.push({
        type: 'NO_MAIL_SERVER',
        severity: 'low',
        details: 'No MX records found (typical for VPN servers)'
      });
    }

    if (dnsResults.anomalies.includes('CLOUD_PROVIDER_NS')) {
      anomalies.push({
        type: 'CLOUD_PROVIDER_NS',
        severity: 'medium',
        details: 'Using cloud provider nameservers'
      });
    }

    return anomalies;
  }

  // Advanced behavioral analysis using ML-inspired pattern recognition
  private static performBehavioralAnalysis(
    ipData: any, 
    networkMetrics: any, 
    dnsResults: DNSAnalysisResult
  ): AdvancedBehavioralMetrics {
    // ASN reputation analysis
    const asnReputation = this.calculateASNReputationScore(ipData);
    
    // Port scanning indicators
    const portScanningIndicators: string[] = [];
    if (networkMetrics.ports?.common) {
      this.SUSPICIOUS_PORTS.forEach(port => {
        if (networkMetrics.ports?.openPorts?.includes(port)) {
          portScanningIndicators.push(`Suspicious port ${port} detected`);
        }
      });
    }
    
    // Geographical consistency analysis
    const geographicalConsistency = this.calculateGeographicalConsistency(ipData);
    
    // Time-based pattern detection
    const timeBasedPatterns = this.detectTimeBasedPatterns(ipData);
    
    // Peer reputation scoring
    const peerReputationScore = this.calculatePeerReputation(ipData, dnsResults);
    
    return {
      asnReputation,
      portScanningIndicators,
      geographicalConsistency,
      timeBasedPatterns,
      peerReputationScore
    };
  }

  // Calculate ASN (Autonomous System Number) reputation score
  private static calculateASNReputationScore(ipData: any): number {
    let score = 0;
    const asn = ipData.ipinfo?.asn || ipData.ipAPI?.as || '';
    const org = (ipData.ipinfo?.org || ipData.ipAPI?.isp || ipData.ipAPI?.org || '').toLowerCase();
    
    // Check against known VPN ASN patterns
    for (const pattern of this.KNOWN_VPN_ASN_PATTERNS) {
      if (pattern.test(asn) || pattern.test(org)) {
        score += 35;
        break;
      }
    }
    
    // Check for datacenter/hosting providers
    if (ipData.ipQualityScore?.is_datacenter || ipData.ipAPI?.hosting) {
      score += 40;
    }
    
    // Check organization name for VPN keywords
    for (const keyword of this.VPN_PROVIDER_KEYWORDS) {
      if (org.includes(keyword)) {
        score += 45;
        break;
      }
    }
    
    return Math.min(100, score);
  }

  // Calculate behavioral score from multiple behavioral metrics
  private static calculateBehavioralScore(metrics: AdvancedBehavioralMetrics): number {
    let score = 0;
    let factors = 0;
    
    // ASN reputation
    score += metrics.asnReputation;
    factors++;
    
    // Port scanning indicators
    if (metrics.portScanningIndicators.length > 0) {
      score += Math.min(100, metrics.portScanningIndicators.length * 30);
      factors++;
    }
    
    // Geographical consistency (inverted - low consistency = high score)
    score += (100 - metrics.geographicalConsistency);
    factors++;
    
    // Time-based patterns
    if (metrics.timeBasedPatterns.length > 0) {
      score += Math.min(100, metrics.timeBasedPatterns.length * 25);
      factors++;
    }
    
    // Peer reputation
    score += metrics.peerReputationScore;
    factors++;
    
    return factors > 0 ? Math.min(100, score / factors) : 0;
  }

  // Calculate geographical consistency across different data sources
  private static calculateGeographicalConsistency(ipData: any): number {
    const countries = new Set([
      ipData.ipinfo?.country,
      ipData.ipAPI?.country,
      ipData.ipAPI?.countryCode,
      ipData.maxmind?.country?.iso_code
    ].filter(Boolean));
    
    if (countries.size === 0) return 50; // Unknown
    if (countries.size === 1) return 100; // Fully consistent
    if (countries.size === 2) return 60;  // Some inconsistency
    return 20; // High inconsistency - potential VPN
  }

  // Detect time-based behavioral patterns
  private static detectTimeBasedPatterns(ipData: any): string[] {
    const patterns: string[] = [];
    
    // Check for recent abuse (indicator of compromised/VPN IP)
    if (ipData.ipQualityScore?.recent_abuse) {
      patterns.push('Recent abuse detected');
    }
    
    // Check for bot status
    if (ipData.ipQualityScore?.bot_status) {
      patterns.push('Bot-like behavior detected');
    }
    
    // Check AbuseIPDB reports
    if (ipData.abuseIPDB?.totalReports > 5) {
      patterns.push(`High abuse reports: ${ipData.abuseIPDB.totalReports}`);
    }
    
    return patterns;
  }

  // Calculate peer reputation based on network neighborhood
  private static calculatePeerReputation(ipData: any, dnsResults: DNSAnalysisResult): number {
    let score = 0;
    let factors = 0;
    
    // DNSBL listings indicate poor reputation
    if (ipData.dnsbl && ipData.dnsbl.length > 0) {
      score += Math.min(100, ipData.dnsbl.length * 20);
      factors++;
    }
    
    // Abuse confidence from AbuseIPDB
    if (ipData.abuseIPDB?.abuseConfidenceScore) {
      score += ipData.abuseIPDB.abuseConfidenceScore;
      factors++;
    }
    
    // Fraud score from IPQualityScore
    if (ipData.ipQualityScore?.fraud_score) {
      score += ipData.ipQualityScore.fraud_score;
      factors++;
    }
    
    // DNS reputation
    if (dnsResults.suspiciousPatterns) {
      score += dnsResults.suspiciousPatterns * 15;
      factors++;
    }
    
    return factors > 0 ? Math.min(100, score / factors) : 0;
  }

  // Detect behavioral anomalies
  private static detectBehavioralAnomalies(metrics: AdvancedBehavioralMetrics): any[] {
    const anomalies: any[] = [];
    
    if (metrics.asnReputation > 70) {
      anomalies.push({
        type: 'HIGH_ASN_REPUTATION_RISK',
        severity: 'high',
        details: `ASN associated with VPN/hosting providers (score: ${metrics.asnReputation.toFixed(1)})`
      });
    }
    
    if (metrics.portScanningIndicators.length > 0) {
      anomalies.push({
        type: 'SUSPICIOUS_PORT_ACTIVITY',
        severity: 'medium',
        details: metrics.portScanningIndicators.join(', ')
      });
    }
    
    if (metrics.geographicalConsistency < 50) {
      anomalies.push({
        type: 'GEOGRAPHICAL_INCONSISTENCY',
        severity: 'medium',
        details: `Low geographical consistency (${metrics.geographicalConsistency.toFixed(1)}%) - potential geo-spoofing`
      });
    }
    
    if (metrics.timeBasedPatterns.length > 2) {
      anomalies.push({
        type: 'SUSPICIOUS_TEMPORAL_PATTERNS',
        severity: 'high',
        details: metrics.timeBasedPatterns.join(', ')
      });
    }
    
    if (metrics.peerReputationScore > 60) {
      anomalies.push({
        type: 'POOR_PEER_REPUTATION',
        severity: 'medium',
        details: `Poor network reputation score: ${metrics.peerReputationScore.toFixed(1)}/100`
      });
    }
    
    return anomalies;
  }

  // Apply sigmoid normalization for smoother confidence scores
  private static applySigmoidNormalization(score: number): number {
    // Sigmoid function: 1 / (1 + e^(-k(x-50)))
    // Maps 0-100 to a smoother curve, emphasizing mid-range differences
    const k = 0.08; // Steepness factor
    const normalized = 100 / (1 + Math.exp(-k * (score - 50)));
    return Math.round(normalized * 100) / 100;
  }

  // Determine risk level based on confidence score
  private static determineRiskLevel(score: number): 'CLEAN' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score < 25) return 'CLEAN';
    if (score < 45) return 'LOW';
    if (score < 65) return 'MEDIUM';
    if (score < 85) return 'HIGH';
    return 'CRITICAL';
  }

  static async getDetailedAnalysis(ip: string): Promise<any> {
    const [detectionResult, ipData] = await Promise.all([
      this.analyzeConnection(ip),
      IPIntelligenceService.getEnhancedIPData(ip)
    ]);

    return {
      ...detectionResult,
      detailedMetrics: {
        ipQualityScore: {
          proxy: ipData.ipQualityScore?.proxy,
          vpn: ipData.ipQualityScore?.vpn,
          tor: ipData.ipQualityScore?.tor,
          recent_abuse: ipData.ipQualityScore?.recent_abuse,
          bot_status: ipData.ipQualityScore?.bot_status
        },
        abuseIPDB: {
          totalReports: ipData.abuseIPDB?.totalReports,
          lastReportedAt: ipData.abuseIPDB?.lastReportedAt,
          usageType: ipData.abuseIPDB?.usageType
        },
        proxyCheck: {
          proxy: ipData.proxycheck?.[ip]?.proxy,
          type: ipData.proxycheck?.[ip]?.type,
          risk: ipData.proxycheck?.[ip]?.risk,
          port: ipData.proxycheck?.[ip]?.port
        },
        maxmind: {
          isAnonymous: ipData.maxmind?.traits?.is_anonymous,
          isAnonymousVpn: ipData.maxmind?.traits?.is_anonymous_vpn,
          isHostingProvider: ipData.maxmind?.traits?.is_hosting_provider,
          isTorExitNode: ipData.maxmind?.traits?.is_tor_exit_node
        }
      }
    };
  }
}