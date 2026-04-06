import { Request, Response, NextFunction } from 'express';
import monitoringService from '../services/monitoring.service';

/**
 * Middleware to track API performance metrics
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const endpoint = `${req.method} ${req.path}`;

  // Intercept response to capture metrics
  const originalSend = res.send;
  res.send = function (data): Response {
    const responseTime = Date.now() - startTime;
    const success = res.statusCode < 400;

    monitoringService.trackRequest(endpoint, responseTime, success);

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Endpoint to expose Prometheus metrics
 */
export const metricsEndpoint = (_req: Request, res: Response) => {
  const metrics = monitoringService.exportPrometheusMetrics();
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
};

/**
 * Endpoint for health check with detailed metrics
 */
export const healthCheckEndpoint = async (_req: Request, res: Response) => {
  const health = await monitoringService.getHealthStatus();
  const statusCode = health.status === 'healthy' ? 200 : (health.status === 'degraded' ? 503 : 500);
  
  res.status(statusCode).json(health);
};

/**
 * Endpoint for performance summary
 */
export const performanceEndpoint = (_req: Request, res: Response) => {
  const performance = monitoringService.getPerformanceSummary();
  const anomalies = monitoringService.checkAnomalies();
  
  res.json({
    performance,
    anomalies,
    timestamp: new Date().toISOString()
  });
};
