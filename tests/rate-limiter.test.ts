import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from '../src/api/rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 1000, maxRequests: 3 });
  });

  afterEach(() => {
    limiter.stopCleanup();
  });

  describe('fixed window', () => {
    it('should allow requests within limit', () => {
      const result = limiter.check('client1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
    });

    it('should deny requests over limit', () => {
      limiter.consume('client1');
      limiter.consume('client1');
      limiter.consume('client1');

      const result = limiter.check('client1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track remaining requests', () => {
      limiter.consume('client1');
      const result = limiter.check('client1');
      expect(result.remaining).toBe(2);
    });

    it('should reset window after timeout', async () => {
      const shortLimiter = new RateLimiter({ windowMs: 50, maxRequests: 2 });

      shortLimiter.consume('client1');
      shortLimiter.consume('client1');

      const result1 = shortLimiter.check('client1');
      expect(result1.allowed).toBe(false);

      await new Promise((r) => setTimeout(r, 60));

      const result2 = shortLimiter.check('client1');
      expect(result2.allowed).toBe(true);
    });

    it('should provide retry after', () => {
      limiter.consume('client1');
      limiter.consume('client1');
      limiter.consume('client1');

      const result = limiter.check('client1');
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('token bucket', () => {
    it('should work with token bucket strategy', () => {
      const tokenLimiter = new RateLimiter({
        strategy: 'token-bucket',
        maxRequests: 5,
        refillRate: 10,
      });

      const result = tokenLimiter.check('client1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });

    it('should consume tokens', () => {
      const tokenLimiter = new RateLimiter({
        strategy: 'token-bucket',
        maxRequests: 5,
        refillRate: 10,
      });

      tokenLimiter.consume('client1');
      const result = tokenLimiter.check('client1');
      expect(result.remaining).toBe(4);
    });

    it('should refill tokens over time', async () => {
      const tokenLimiter = new RateLimiter({
        strategy: 'token-bucket',
        maxRequests: 5,
        refillRate: 100, // 100 tokens per second
      });

      for (let i = 0; i < 5; i++) {
        tokenLimiter.consume('client1');
      }

      const result1 = tokenLimiter.check('client1');
      expect(result1.allowed).toBe(false);

      await new Promise((r) => setTimeout(r, 20));

      const result2 = tokenLimiter.check('client1');
      expect(result2.allowed).toBe(true);
    });
  });

  describe('client management', () => {
    it('should track separate clients', () => {
      limiter.consume('client1');
      limiter.consume('client1');

      const result = limiter.check('client2');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
    });

    it('should get client status', () => {
      limiter.consume('client1');

      const status = limiter.getClientStatus('client1');
      expect(status).not.toBeNull();
      expect(status!.count).toBe(1);
      expect(status!.remaining).toBe(2);
    });

    it('should return null for unknown client', () => {
      const status = limiter.getClientStatus('unknown');
      expect(status).toBeNull();
    });

    it('should reset client', () => {
      limiter.consume('client1');
      limiter.consume('client1');

      limiter.resetClient('client1');

      const result = limiter.check('client1');
      expect(result.remaining).toBe(3);
    });
  });

  describe('stats', () => {
    it('should report stats', () => {
      limiter.check('client1');
      limiter.check('client2');

      const stats = limiter.getStats();
      expect(stats.totalClients).toBe(2);
      expect(stats.strategy).toBe('fixed-window');
      expect(stats.maxRequests).toBe(3);
    });
  });

  describe('cleanup', () => {
    it('should clean up expired records', async () => {
      const shortLimiter = new RateLimiter({ windowMs: 50 });
      shortLimiter.startCleanup(10);

      shortLimiter.check('client1');

      await new Promise((r) => setTimeout(r, 120));

      shortLimiter.stopCleanup();

      // Client should be cleaned up
      const status = shortLimiter.getClientStatus('client1');
      expect(status).toBeNull();
    });
  });
});
