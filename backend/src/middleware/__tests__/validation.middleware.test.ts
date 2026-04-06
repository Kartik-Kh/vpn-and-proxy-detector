import { Request, Response, NextFunction } from 'express';
import { validate, schemas } from '../validation.middleware';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  describe('IP Detection Schema', () => {
    it('should pass valid IPv4 address', () => {
      mockReq.body = { ip: '192.168.1.1' };
      
      const middleware = validate(schemas.ipDetection);
      middleware(mockReq as Request, mockRes as Response, nextFunction);
      
      expect(nextFunction).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject invalid IP address', () => {
      mockReq.body = { ip: 'invalid-ip' };
      
      const middleware = validate(schemas.ipDetection);
      middleware(mockReq as Request, mockRes as Response, nextFunction);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject missing IP address', () => {
      mockReq.body = {};
      
      const middleware = validate(schemas.ipDetection);
      middleware(mockReq as Request, mockRes as Response, nextFunction);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Bulk Detection Schema', () => {
    it('should pass valid IP array', () => {
      mockReq.body = { ips: ['8.8.8.8', '1.1.1.1'] };
      
      const middleware = validate(schemas.bulkDetection);
      middleware(mockReq as Request, mockRes as Response, nextFunction);
      
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject empty array', () => {
      mockReq.body = { ips: [] };
      
      const middleware = validate(schemas.bulkDetection);
      middleware(mockReq as Request, mockRes as Response, nextFunction);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should reject array exceeding limit', () => {
      const manyIps = Array(101).fill('8.8.8.8');
      mockReq.body = { ips: manyIps };
      
      const middleware = validate(schemas.bulkDetection);
      middleware(mockReq as Request, mockRes as Response, nextFunction);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
