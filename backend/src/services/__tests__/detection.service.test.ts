import { DetectionService } from '../detection.service';

describe('DetectionService', () => {
  describe('detectIP', () => {
    it('should detect Google DNS as non-VPN', async () => {
      const result = await DetectionService.detectIP('8.8.8.8');
      
      expect(result).toBeDefined();
      expect(result.verdict).toBe('ORIGINAL');
      expect(result.score).toBeLessThan(50);
      expect(result.checks).toBeDefined();
      expect(Array.isArray(result.checks)).toBe(true);
    }, 30000);

    it('should return check results array', async () => {
      const result = await DetectionService.detectIP('1.1.1.1');
      
      expect(result.checks).toBeDefined();
      expect(Array.isArray(result.checks)).toBe(true);
      expect(result.checks.length).toBeGreaterThan(0);
    }, 15000);

    it('should include verdict in response', async () => {
      const result = await DetectionService.detectIP('8.8.8.8');
      
      expect(result.verdict).toMatch(/^(PROXY\/VPN|ORIGINAL)$/);
    }, 20000);
  });
});

