import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DistributedLock } from '../src/distributed/lock.js';

describe('DistributedLock', () => {
  let lock: DistributedLock;

  beforeEach(() => {
    lock = new DistributedLock();
  });

  describe('acquire/release', () => {
    it('should acquire a lock', async () => {
      const result = await lock.acquire('resource1', 'owner1');
      expect(result).not.toBeNull();
      expect(result!.resource).toBe('resource1');
      expect(result!.owner).toBe('owner1');
    });

    it('should release a lock', async () => {
      await lock.acquire('resource1', 'owner1');
      const released = lock.release('resource1');
      expect(released).toBe(true);
      expect(lock.isLocked('resource1')).toBe(false);
    });

    it('should return false when releasing non-existent lock', () => {
      const released = lock.release('nonexistent');
      expect(released).toBe(false);
    });

    it('should fail to acquire same resource twice', async () => {
      await lock.acquire('resource1', 'owner1');
      const result = await lock.acquire('resource1', 'owner2', {
        acquireTimeout: 100,
      });
      expect(result).toBeNull();
    });
  });

  describe('lock ownership', () => {
    it('should check lock ownership', async () => {
      await lock.acquire('resource1', 'owner1');
      expect(lock.isOwnedBy('resource1', 'owner1')).toBe(true);
      expect(lock.isOwnedBy('resource1', 'owner2')).toBe(false);
    });

    it('should return false for non-existent lock', () => {
      expect(lock.isOwnedBy('resource1', 'owner1')).toBe(false);
    });
  });

  describe('lock expiry', () => {
    it('should auto-release expired lock', async () => {
      await lock.acquire('resource1', 'owner1', { timeout: 50 });

      await new Promise((r) => setTimeout(r, 100));

      expect(lock.isLocked('resource1')).toBe(false);
    });

    it('should allow acquiring expired lock', async () => {
      await lock.acquire('resource1', 'owner1', { timeout: 50 });

      await new Promise((r) => setTimeout(r, 100));

      const result = await lock.acquire('resource1', 'owner2');
      expect(result).not.toBeNull();
      expect(result!.owner).toBe('owner2');
    });
  });

  describe('lock info', () => {
    it('should get lock info', async () => {
      await lock.acquire('resource1', 'owner1');
      const info = lock.getLock('resource1');
      expect(info).toBeDefined();
      expect(info!.owner).toBe('owner1');
    });

    it('should get all locks', async () => {
      await lock.acquire('resource1', 'owner1');
      await lock.acquire('resource2', 'owner2');

      const allLocks = lock.getAllLocks();
      expect(allLocks.length).toBe(2);
    });
  });

  describe('force release', () => {
    it('should force release any lock', async () => {
      await lock.acquire('resource1', 'owner1');
      const released = lock.forceRelease('resource1');
      expect(released).toBe(true);
      expect(lock.isLocked('resource1')).toBe(false);
    });
  });

  describe('stats', () => {
    it('should report stats', async () => {
      await lock.acquire('resource1', 'owner1');
      await lock.acquire('resource2', 'owner2');

      const stats = lock.getStats();
      expect(stats.totalLocks).toBe(2);
      expect(stats.lockedResources).toContain('resource1');
      expect(stats.lockedResources).toContain('resource2');
    });

    it('should clean up expired locks in stats', async () => {
      await lock.acquire('resource1', 'owner1', { timeout: 50 });

      await new Promise((r) => setTimeout(r, 100));

      const stats = lock.getStats();
      expect(stats.totalLocks).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all locks', async () => {
      await lock.acquire('resource1', 'owner1');
      await lock.acquire('resource2', 'owner2');

      lock.clear();

      const stats = lock.getStats();
      expect(stats.totalLocks).toBe(0);
    });
  });
});
