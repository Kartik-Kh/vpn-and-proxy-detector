import { EventEmitter } from 'events';

interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorCount: number;
  cacheHitRate: number;
  activeConnections: number;
  detectionAccuracy: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  services: {
    mongodb: boolean;
    redis: boolean;
    external_apis: boolean;
  };
  metrics: PerformanceMetrics;
  lastCheck: Date;
}

export class MonitoringService extends EventEmitter {
  private metrics: Metric[] = [];
  private performanceData: PerformanceMetrics = {
    requestCount: 0,
    averageResponseTime: 0,
    errorCount: 0,
    cacheHitRate: 0,
    activeConnections: 0,
    detectionAccuracy: 0
  };
  private responseTimes: number[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  private readonly MAX_METRICS_HISTORY = 10000;
  private readonly startTime = Date.now();

  /**
   * Record a metric
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const metric: Metric = {
      name,
      value,
      timestamp: new Date(),
      tags
    };

    this.metrics.push(metric);

    // Prevent memory overflow
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_HISTORY);
    }

    this.emit('metric', metric);
  }

  /**
   * Track API request
   */
  trackRequest(endpoint: string, responseTime: number, success: boolean): void {
    this.performanceData.requestCount++;
    
    if (success) {
      this.responseTimes.push(responseTime);
      if (this.responseTimes.length > 1000) {
        this.responseTimes = this.responseTimes.slice(-1000);
      }
      this.updateAverageResponseTime();
    } else {
      this.performanceData.errorCount++;
    }

    this.recordMetric('api.request', 1, {
      endpoint,
      success: success.toString(),
      responseTime: responseTime.toString()
    });
  }

  /**
   * Track cache hit/miss
   */
  trackCacheAccess(hit: boolean): void {
    if (hit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
    
    const total = this.cacheHits + this.cacheMisses;
    this.performanceData.cacheHitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;

    this.recordMetric('cache.access', hit ? 1 : 0);
  }

  /**
   * Track active connections
   */
  setActiveConnections(count: number): void {
    this.performanceData.activeConnections = count;
    this.recordMetric('connections.active', count);
  }

  /**
   * Track detection accuracy (for ML improvement)
   */
  trackDetectionAccuracy(correct: boolean): void {
    const recentDetections = this.metrics
      .filter(m => m.name === 'detection.accuracy')
      .slice(-100);
    
    const correctDetections = recentDetections.filter(m => m.value === 1).length + (correct ? 1 : 0);
    const total = recentDetections.length + 1;
    
    this.performanceData.detectionAccuracy = (correctDetections / total) * 100;
    this.recordMetric('detection.accuracy', correct ? 1 : 0);
  }

  /**
   * Get current health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const uptime = (Date.now() - this.startTime) / 1000;
    
    // Quick health checks
    const mongoHealth = await this.checkMongoDBHealth();
    const redisHealth = await this.checkRedisHealth();
    const apiHealth = await this.checkExternalAPIsHealth();

    const allHealthy = mongoHealth && redisHealth && apiHealth;
    const someUnhealthy = !mongoHealth || !redisHealth || !apiHealth;

    return {
      status: allHealthy ? 'healthy' : (someUnhealthy ? 'degraded' : 'down'),
      uptime,
      services: {
        mongodb: mongoHealth,
        redis: redisHealth,
        external_apis: apiHealth
      },
      metrics: this.performanceData,
      lastCheck: new Date()
    };
  }

  /**
   * Get metrics for a specific time range
   */
  getMetrics(name: string, since: Date): Metric[] {
    return this.metrics.filter(m => 
      m.name === name && m.timestamp >= since
    );
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): PerformanceMetrics {
    return { ...this.performanceData };
  }

  /**
   * Alert on anomalies
   */
  checkAnomalies(): string[] {
    const alerts: string[] = [];

    if (this.performanceData.errorCount > 100) {
      alerts.push(`High error count: ${this.performanceData.errorCount}`);
    }

    if (this.performanceData.averageResponseTime > 5000) {
      alerts.push(`Slow response time: ${this.performanceData.averageResponseTime}ms`);
    }

    if (this.performanceData.cacheHitRate < 50 && this.cacheHits + this.cacheMisses > 100) {
      alerts.push(`Low cache hit rate: ${this.performanceData.cacheHitRate.toFixed(2)}%`);
    }

    if (this.performanceData.activeConnections > 1000) {
      alerts.push(`High connection count: ${this.performanceData.activeConnections}`);
    }

    return alerts;
  }

  /**
   * Export metrics for external monitoring tools (Prometheus, Datadog, etc.)
   */
  exportPrometheusMetrics(): string {
    const lines: string[] = [];

    lines.push(`# HELP vpn_detector_requests_total Total number of API requests`);
    lines.push(`# TYPE vpn_detector_requests_total counter`);
    lines.push(`vpn_detector_requests_total ${this.performanceData.requestCount}`);

    lines.push(`# HELP vpn_detector_errors_total Total number of errors`);
    lines.push(`# TYPE vpn_detector_errors_total counter`);
    lines.push(`vpn_detector_errors_total ${this.performanceData.errorCount}`);

    lines.push(`# HELP vpn_detector_response_time_ms Average response time in milliseconds`);
    lines.push(`# TYPE vpn_detector_response_time_ms gauge`);
    lines.push(`vpn_detector_response_time_ms ${this.performanceData.averageResponseTime}`);

    lines.push(`# HELP vpn_detector_cache_hit_rate Cache hit rate percentage`);
    lines.push(`# TYPE vpn_detector_cache_hit_rate gauge`);
    lines.push(`vpn_detector_cache_hit_rate ${this.performanceData.cacheHitRate}`);

    lines.push(`# HELP vpn_detector_active_connections Number of active connections`);
    lines.push(`# TYPE vpn_detector_active_connections gauge`);
    lines.push(`vpn_detector_active_connections ${this.performanceData.activeConnections}`);

    return lines.join('\n');
  }

  /**
   * Private helper methods
   */
  private updateAverageResponseTime(): void {
    if (this.responseTimes.length === 0) return;
    
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    this.performanceData.averageResponseTime = sum / this.responseTimes.length;
  }

  private async checkMongoDBHealth(): Promise<boolean> {
    try {
      const mongoose = await import('mongoose');
      return mongoose.default.connection.readyState === 1;
    } catch {
      return false;
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      const cacheService = await import('./cache.service');
      return cacheService.default.isConnected();
    } catch {
      return false;
    }
  }

  private async checkExternalAPIsHealth(): Promise<boolean> {
    // Simple check - could be enhanced with actual API pings
    return this.performanceData.errorCount < this.performanceData.requestCount * 0.5;
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset(): void {
    this.metrics = [];
    this.responseTimes = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.performanceData = {
      requestCount: 0,
      averageResponseTime: 0,
      errorCount: 0,
      cacheHitRate: 0,
      activeConnections: 0,
      detectionAccuracy: 0
    };
  }
}

export default new MonitoringService();
