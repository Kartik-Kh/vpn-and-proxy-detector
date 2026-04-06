import cacheService from '../cache.service';

describe('CacheService', () => {
  describe('get and set operations', () => {
    it('should set and get a value', async () => {
      const key = 'test:key1';
      const value = { data: 'test value' };

      await cacheService.set(key, value, 60);
      const result = await cacheService.get(key);

      expect(result).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      const result = await cacheService.get('test:nonexistent123456');
      expect(result).toBeNull();
    });
  });

  describe('connection handling', () => {
    it('should gracefully handle operations', async () => {
      // Even if Redis isn't connected, operations shouldn't throw
      await expect(cacheService.get('any:key')).resolves.toBeDefined();
    });
    
    it('should support isConnected check', () => {
      const connected = cacheService.isConnected();
      expect(typeof connected).toBe('boolean');
    });
  });
});
