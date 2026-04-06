import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

/**
 * Compression middleware configuration
 */
export const compressionMiddleware = compression({
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Balance between speed and compression
  threshold: 1024 // Only compress responses > 1KB
});

/**
 * Response caching middleware for static/rarely changing data
 */
export const responseCacheMiddleware = (ttl: number = 300) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Set cache headers
    res.set('Cache-Control', `public, max-age=${ttl}`);
    res.set('Expires', new Date(Date.now() + ttl * 1000).toUTCString());

    next();
  };
};

/**
 * ETag support for conditional requests
 */
export const etagMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;

  res.send = function (data): Response {
    if (typeof data === 'string' || Buffer.isBuffer(data)) {
      const crypto = require('crypto');
      const etag = crypto.createHash('md5').update(data).digest('hex');
      res.set('ETag', `"${etag}"`);

      // Check if client has cached version
      if (req.headers['if-none-match'] === `"${etag}"`) {
        res.status(304);
        return originalSend.call(this, '');
      }
    }

    return originalSend.call(this, data);
  };

  next();
};
