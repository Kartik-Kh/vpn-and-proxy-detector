/**
 * Performance optimization utilities
 */

/**
 * Memoize expensive function calls
 */
export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ttl: number = 60000
): T {
  const cache = new Map<string, { value: unknown; expiry: number }>();

  return ((...args: unknown[]) => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached && Date.now() < cached.expiry) {
      return cached.value;
    }

    const value = fn(...args);
    cache.set(key, { value, expiry: Date.now() + ttl });

    return value;
  }) as T;
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= interval) {
      lastCall = now;
      fn(...args);
    }
  };
}

/**
 * Batch multiple operations
 */
export class BatchProcessor<T, R> {
  private queue: T[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private batchSize: number = 50,
    private delay: number = 100
  ) {}

  add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push(item);

      if (this.queue.length >= this.batchSize) {
        this.flush().then(results => resolve(results[results.length - 1])).catch(reject);
      } else {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          this.flush().then(results => resolve(results[results.length - 1])).catch(reject);
        }, this.delay);
      }
    });
  }

  private async flush(): Promise<R[]> {
    const items = this.queue.splice(0);
    if (items.length === 0) return [];
    
    return this.processor(items);
  }
}

/**
 * LRU Cache implementation
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value as K;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Lazy load route components (for frontend use)
 */
export function lazyLoadFactory() {
  // This is a backend utility file
  // Frontend lazy loading should be implemented in React code directly
  return null;
}
