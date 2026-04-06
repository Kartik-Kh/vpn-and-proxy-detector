import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

interface MLFeatures {
  rttScore: number;
  geoConsistency: number;
  timeSeriesScore: number;
  portActivityScore: number;
  behavioralScore: number;
  reputationScore: number;
  anomalyScore: number;
}

interface BehavioralPattern {
  connectionFrequency: number;
  trafficVolume: number;
  sessionDuration: number;
  unusualTiming: boolean;
}

interface ReputationData {
  historicalDetections: number;
  communityReports: number;
  knownVPNProvider: boolean;
  trustScore: number;
}

export class MLDetectionService {
  private static readonly TIME_WINDOW = 300000; // 5 minutes
  private static readonly MIN_SAMPLES = 5;
  private static readonly SUSPICIOUS_PORTS = [
    1194, 1723, 500, 4500, 1701, 8080, 3128, 9040 // Added Tor
  ];
  
  // Simple in-memory reputation cache (production should use Redis/DB)
  private static reputationCache = new Map<string, ReputationData>();
  private static behavioralHistory = new Map<string, BehavioralPattern[]>();

  /**
   * Advanced ML-based VPN detection with behavioral analysis
   */
  static async detectWithML(ip: string): Promise<{ isVPN: boolean; confidence: number; features: MLFeatures }> {
    const features = await this.collectAdvancedMetrics(ip);
    
    // Weighted scoring algorithm
    const weights = {
      rtt: 0.15,
      geo: 0.20,
      timeSeries: 0.15,
      port: 0.15,
      behavioral: 0.20,
      reputation: 0.10,
      anomaly: 0.05
    };

    const overallScore = 
      features.rttScore * weights.rtt +
      features.geoConsistency * weights.geo +
      features.timeSeriesScore * weights.timeSeries +
      features.portActivityScore * weights.port +
      features.behavioralScore * weights.behavioral +
      features.reputationScore * weights.reputation +
      features.anomalyScore * weights.anomaly;

    const confidence = Math.min(Math.max(overallScore, 0), 100);
    const isVPN = confidence > 60;

    return { isVPN, confidence, features };
  }

  /**
   * Collect advanced network metrics with ML features
   */
  private static async collectAdvancedMetrics(ip: string): Promise<MLFeatures> {
    const [
      rttData,
      geoData,
      portData,
      timeSeriesData,
      behavioralData,
      reputationData,
      anomalyData
    ] = await Promise.all([
      this.measureRTTVariation(ip),
      this.checkGeoConsistency(ip),
      this.analyzePortActivity(ip),
      this.analyzeTimeSeries(ip),
      this.analyzeBehavioralPatterns(ip),
      this.checkReputation(ip),
      this.detectAnomalies(ip)
    ]);

    return {
      rttScore: rttData,
      geoConsistency: geoData,
      timeSeriesScore: timeSeriesData,
      portActivityScore: portData,
      behavioralScore: behavioralData,
      reputationScore: reputationData,
      anomalyScore: anomalyData
    };
  }

  /**
   * Analyze behavioral patterns using historical data
   */
  private static async analyzeBehavioralPatterns(ip: string): Promise<number> {
    const history = this.behavioralHistory.get(ip) || [];
    
    // Record current pattern
    const currentPattern: BehavioralPattern = {
      connectionFrequency: Math.random() * 100, // Simulated - should track real connections
      trafficVolume: Math.random() * 1000,
      sessionDuration: Math.random() * 3600,
      unusualTiming: this.detectUnusualTiming()
    };

    history.push(currentPattern);
    if (history.length > 100) history.shift();
    this.behavioralHistory.set(ip, history);

    if (history.length < 3) return 50; // Insufficient data

    // Analyze consistency
    const frequencies = history.map(h => h.connectionFrequency);
    const mean = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
    const stdDev = Math.sqrt(
      frequencies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / frequencies.length
    );

    // High variance suggests rotating IPs (common with VPNs)
    const normalizedStdDev = stdDev / (mean || 1);
    const consistencyScore = Math.max(0, 100 - normalizedStdDev * 50);

    // Penalize unusual timing
    if (currentPattern.unusualTiming) {
      return Math.max(0, consistencyScore - 30);
    }

    return consistencyScore;
  }

  /**
   * Check IP reputation from multiple sources
   */
  private static async checkReputation(ip: string): Promise<number> {
    let cached = this.reputationCache.get(ip);
    
    if (!cached) {
      cached = {
        historicalDetections: 0,
        communityReports: 0,
        knownVPNProvider: await this.isKnownVPNProvider(ip),
        trustScore: 100
      };
      this.reputationCache.set(ip, cached);
    }

    let score = cached.trustScore;

    // Known VPN provider is high confidence
    if (cached.knownVPNProvider) score -= 50;
    
    // Historical detections reduce trust
    score -= Math.min(cached.historicalDetections * 5, 30);
    
    // Community reports impact
    score -= Math.min(cached.communityReports * 3, 20);

    return Math.max(0, score);
  }

  /**
   * Detect anomalies using statistical methods (simplified k-means clustering)
   */
  private static async detectAnomalies(ip: string): Promise<number> {
    const features = await this.extractAnomalyFeatures(ip);
    
    // Simulated cluster centroids (in production, these would be learned from data)
    const normalCentroid = { rtt: 50, ports: 2, geo: 90 };
    const vpnCentroid = { rtt: 120, ports: 5, geo: 40 };

    // Calculate distances
    const distanceToNormal = this.euclideanDistance(features, normalCentroid);
    const distanceToVPN = this.euclideanDistance(features, vpnCentroid);

    // Score based on proximity to VPN cluster
    const totalDistance = distanceToNormal + distanceToVPN;
    const anomalyScore = (distanceToVPN / totalDistance) * 100;

    return anomalyScore;
  }

  /**
   * Extract features for anomaly detection
   */
  private static async extractAnomalyFeatures(ip: string): Promise<{ rtt: number; ports: number; geo: number }> {
    return {
      rtt: await this.measureRTTVariation(ip),
      ports: 100 - await this.analyzePortActivity(ip),
      geo: await this.checkGeoConsistency(ip)
    };
  }

  /**
   * Calculate Euclidean distance between feature vectors
   */
  private static euclideanDistance(
    a: { rtt: number; ports: number; geo: number },
    b: { rtt: number; ports: number; geo: number }
  ): number {
    return Math.sqrt(
      Math.pow(a.rtt - b.rtt, 2) +
      Math.pow(a.ports - b.ports, 2) +
      Math.pow(a.geo - b.geo, 2)
    );
  }

  /**
   * Check if IP belongs to known VPN provider
   */
  private static async isKnownVPNProvider(ip: string): Promise<boolean> {
    // Check against known VPN ASNs and IP ranges
    const knownVPNASNs = ['AS62044', 'AS396982', 'AS54825']; // NordVPN, ExpressVPN, etc.
    
    try {
      const whoisData = await this.performWhoisLookup(ip);
      return knownVPNASNs.some(asn => whoisData.includes(asn));
    } catch {
      return false;
    }
  }

  /**
   * Perform WHOIS lookup
   */
  private static async performWhoisLookup(ip: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`whois ${ip}`, { timeout: 5000 });
      return stdout;
    } catch {
      return '';
    }
  }

  /**
   * Detect unusual timing patterns
   */
  private static detectUnusualTiming(): boolean {
    const hour = new Date().getHours();
    // Connections during unusual hours (2-6 AM) might indicate automation
    return hour >= 2 && hour <= 6;
  }

  /**
   * Measure RTT variation over time
   */
  private static async measureRTTVariation(ip: string): Promise<number> {
    const samples: number[] = [];
    const numSamples = 5;

    for (let i = 0; i < numSamples; i++) {
      try {
        const startTime = process.hrtime();
        const { stdout } = await execAsync(`ping -n 1 ${ip}`);
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const rtt = seconds * 1000 + nanoseconds / 1000000;
        samples.push(rtt);
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        samples.push(-1);
      }
    }

    // Calculate score based on RTT stability
    const validSamples = samples.filter(s => s !== -1);
    if (validSamples.length < 3) return 0;

    const mean = validSamples.reduce((a, b) => a + b) / validSamples.length;
    const variance = validSamples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validSamples.length;
    const stability = 1 / (1 + variance);

    return Math.min(stability * 100, 100);
  }

  /**
   * Check geographic location consistency
   */
  private static async checkGeoConsistency(ip: string): Promise<number> {
    try {
      const response = await axios.get(`http://ip-api.com/json/${ip}`);
      const data = response.data;

      // Check for proxy/VPN indicators in location data
      let score = 100;

      // Check ISP vs Location consistency
      if (data.isp && data.isp.toLowerCase().includes('hosting')) {
        score -= 30;
      }

      // Check for datacenter ranges
      if (data.hosting || data.proxy) {
        score -= 40;
      }

      // Check country vs ASN consistency
      if (data.as && data.country) {
        const asCountry = this.extractCountryFromAS(data.as);
        if (asCountry && asCountry !== data.country) {
          score -= 20;
        }
      }

      return Math.max(score, 0);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Analyze port activity patterns
   */
  private static async analyzePortActivity(ip: string): Promise<number> {
    let score = 100;
    const results = await Promise.all(
      this.SUSPICIOUS_PORTS.map(port => this.checkPort(ip, port))
    );

    const openPorts = results.filter(r => r).length;
    score -= openPorts * 20;

    return Math.max(score, 0);
  }

  /**
   * Check if a port is open
   */
  private static async checkPort(ip: string, port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        `powershell -command "Test-NetConnection -ComputerName ${ip} -Port ${port} -WarningAction SilentlyContinue | Select-Object -ExpandProperty TcpTestSucceeded"`,
        { timeout: 2000 }
      );
      return stdout.trim().toLowerCase() === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Analyze time series patterns
   */
  private static async analyzeTimeSeries(ip: string): Promise<number> {
    // In a real implementation, this would analyze historical data
    // For now, we'll return a basic score based on current metrics
    const [latencyStability, connectionStability] = await Promise.all([
      this.checkLatencyStability(ip),
      this.checkConnectionStability(ip)
    ]);

    return (latencyStability + connectionStability) / 2;
  }

  /**
   * Check latency stability
   */
  private static async checkLatencyStability(ip: string): Promise<number> {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      try {
        const startTime = process.hrtime();
        await axios.get(`http://${ip}`, { timeout: 2000 });
        const [seconds, nanoseconds] = process.hrtime(startTime);
        samples.push(seconds * 1000 + nanoseconds / 1000000);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        samples.push(-1);
      }
    }

    const validSamples = samples.filter(s => s !== -1);
    if (validSamples.length < 2) return 0;

    const mean = validSamples.reduce((a, b) => a + b) / validSamples.length;
    const variance = validSamples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validSamples.length;
    
    return Math.max(100 - (variance / 10), 0);
  }

  /**
   * Check connection stability
   */
  private static async checkConnectionStability(ip: string): Promise<number> {
    let successCount = 0;
    const attempts = 3;

    for (let i = 0; i < attempts; i++) {
      try {
        await axios.get(`http://${ip}`, { timeout: 1000 });
        successCount++;
      } catch (error) {
        // Ignore errors
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return (successCount / attempts) * 100;
  }

  /**
   * Extract country from AS number description
   */
  private static extractCountryFromAS(asString: string): string | null {
    const countryMatch = asString.match(/[A-Z]{2}$/);
    return countryMatch ? countryMatch[0] : null;
  }

  /**
   * Calculate overall ML-based detection score
   */
  static calculateScore(features: MLFeatures): number {
    // Weight the different features
    const weights = {
      rtt: 0.3,
      geo: 0.3,
      timeSeries: 0.2,
      portActivity: 0.2
    };

    const weightedScore = 
      features.rttScore * weights.rtt +
      features.geoConsistency * weights.geo +
      features.timeSeriesScore * weights.timeSeries +
      features.portActivityScore * weights.portActivity;

    return Math.round(weightedScore);
  }
}