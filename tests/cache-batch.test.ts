import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Cache, LLMResponseCache } from '../src/performance/cache.js';
import { BatchProcessor } from '../src/performance/batch.js';

describe('Cache', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    cache = new Cache<string>({ maxSize: 5, defaultTTL: 1000 });
  });

  describe('basic operations', () => {
    it('should set and get value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing key', () => {
      expect(cache.get('missing')).toBeUndefined();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('missing')).toBe(false);
    });

    it('should delete key', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size).toBe(0);
    });

    it('should report size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);
    });
  });

  describe('TTL', () => {
    it('should expire entries', async () => {
      const shortCache = new Cache<string>({ defaultTTL: 50 });
      shortCache.set('key1', 'value1');
      expect(shortCache.get('key1')).toBe('value1');

      await new Promise((r) => setTimeout(r, 100));
      expect(shortCache.get('key1')).toBeUndefined();
    });

    it('should support custom TTL', async () => {
      cache.set('key1', 'value1', 50);
      expect(cache.get('key1')).toBe('value1');

      await new Promise((r) => setTimeout(r, 100));
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('eviction', () => {
    it('should evict LRU when full', () => {
      const smallCache = new Cache<string>({ maxSize: 3 });

      smallCache.set('a', '1');
      smallCache.set('b', '2');
      smallCache.set('c', '3');

      smallCache.get('a');

      smallCache.set('d', '4');

      expect(smallCache.has('a')).toBe(true);
      expect(smallCache.has('b')).toBe(false);
      expect(smallCache.has('c')).toBe(true);
      expect(smallCache.has('d')).toBe(true);
    });
  });

  describe('stats', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('missing');

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track sets and deletes', () => {
      cache.set('key1', 'value1');
      cache.delete('key1');

      const stats = cache.getStats();
      expect(stats.sets).toBe(1);
      expect(stats.deletes).toBe(1);
    });
  });

  describe('keys', () => {
    it('should return valid keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const keys = cache.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should not return expired keys', async () => {
      const shortCache = new Cache<string>({ defaultTTL: 50 });
      shortCache.set('key1', 'value1');
      shortCache.set('key2', 'value2');

      await new Promise((r) => setTimeout(r, 100));

      const keys = shortCache.keys();
      expect(keys.length).toBe(0);
    });
  });
});

describe('LLMResponseCache', () => {
  let cache: LLMResponseCache;

  beforeEach(() => {
    cache = new LLMResponseCache();
  });

  it('should cache and retrieve responses', () => {
    cache.set('What is 2+2?', 'gpt-4', 0, '4');
    expect(cache.get('What is 2+2?', 'gpt-4', 0)).toBe('4');
  });

  it('should return undefined for cache miss', () => {
    expect(cache.get('prompt', 'gpt-4', 0)).toBeUndefined();
  });

  it('should check if cached', () => {
    cache.set('prompt', 'gpt-4', 0, 'response');
    expect(cache.has('prompt', 'gpt-4', 0)).toBe(true);
    expect(cache.has('other', 'gpt-4', 0)).toBe(false);
  });

  it('should differentiate by model', () => {
    cache.set('prompt', 'gpt-4', 0, 'response-4');
    cache.set('prompt', 'gpt-3.5', 0, 'response-35');

    expect(cache.get('prompt', 'gpt-4', 0)).toBe('response-4');
    expect(cache.get('prompt', 'gpt-3.5', 0)).toBe('response-35');
  });

  it('should differentiate by temperature', () => {
    cache.set('prompt', 'gpt-4', 0, 'response-0');
    cache.set('prompt', 'gpt-4', 1, 'response-1');

    expect(cache.get('prompt', 'gpt-4', 0)).toBe('response-0');
    expect(cache.get('prompt', 'gpt-4', 1)).toBe('response-1');
  });

  it('should track stats', () => {
    cache.set('prompt', 'gpt-4', 0, 'response');
    cache.get('prompt', 'gpt-4', 0);
    cache.get('missing', 'gpt-4', 0);

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });

  it('should clear all', () => {
    cache.set('prompt', 'gpt-4', 0, 'response');
    cache.clear();
    expect(cache.has('prompt', 'gpt-4', 0)).toBe(false);
  });
});

describe('BatchProcessor', () => {
  it('should batch items together', async () => {
    const processor = vi.fn(async (inputs: number[]) => {
      return inputs.map((x) => x * 2);
    });

    const batch = new BatchProcessor(processor, {
      maxBatchSize: 3,
      waitTime: 50,
    });

    const results = await Promise.all([
      batch.add(1),
      batch.add(2),
      batch.add(3),
    ]);

    expect(results).toEqual([2, 4, 6]);
    expect(processor).toHaveBeenCalledTimes(1);
    expect(processor).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('should flush when max batch size reached', async () => {
    const processor = vi.fn(async (inputs: number[]) => {
      return inputs.map((x) => x * 2);
    });

    const batch = new BatchProcessor(processor, {
      maxBatchSize: 2,
      waitTime: 100,
    });

    const results = await Promise.all([batch.add(1), batch.add(2)]);

    expect(results).toEqual([2, 4]);
    expect(processor).toHaveBeenCalledTimes(1);
  });

  it('should flush on timeout', async () => {
    const processor = vi.fn(async (inputs: number[]) => {
      return inputs.map((x) => x * 2);
    });

    const batch = new BatchProcessor(processor, {
      maxBatchSize: 10,
      waitTime: 50,
    });

    const result = await batch.add(5);
    expect(result).toBe(10);
    expect(processor).toHaveBeenCalledTimes(1);
  });

  it('should execute directly when disabled', async () => {
    const processor = vi.fn(async (inputs: number[]) => {
      return inputs.map((x) => x * 2);
    });

    const batch = new BatchProcessor(processor, { enabled: false });

    const result = await batch.add(5);
    expect(result).toBe(10);
    expect(processor).toHaveBeenCalledTimes(1);
    expect(processor).toHaveBeenCalledWith([5]);
  });

  it('should report queue size', () => {
    const processor = vi.fn(async (inputs: number[]) => inputs);
    const batch = new BatchProcessor(processor, { waitTime: 1000 });

    expect(batch.queueSize).toBe(0);
    batch.add(1);
    expect(batch.queueSize).toBe(1);
  });

  it('should get stats', () => {
    const processor = vi.fn(async (inputs: number[]) => inputs);
    const batch = new BatchProcessor(processor, {
      maxBatchSize: 5,
      waitTime: 100,
    });

    const stats = batch.getStats();
    expect(stats.maxBatchSize).toBe(5);
    expect(stats.waitTime).toBe(100);
    expect(stats.enabled).toBe(true);
  });

  it('should handle errors', async () => {
    const processor = vi.fn(async () => {
      throw new Error('batch error');
    });

    const batch = new BatchProcessor(processor, { waitTime: 50 });

    await expect(batch.add(1)).rejects.toThrow('batch error');
  });
});
