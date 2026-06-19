import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditPersistence } from '../src/audit/persistence.js';
import { rmSync, existsSync } from 'node:fs';

describe('AuditPersistence', () => {
  let audit: AuditPersistence;
  const testDir = './test-audit-logs';

  beforeEach(() => {
    audit = new AuditPersistence(testDir, 10);
  });

  afterEach(() => {
    audit.stopAutoFlush();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('logging', () => {
    it('should log an entry', async () => {
      await audit.log({
        action: 'user.login',
        actor: 'user1',
        resource: 'auth',
        details: { ip: '127.0.0.1' },
        severity: 'info',
      });

      const entries = await audit.query();
      expect(entries.length).toBe(1);
      expect(entries[0].action).toBe('user.login');
    });

    it('should generate unique IDs', async () => {
      await audit.log({
        action: 'action1',
        actor: 'user1',
        resource: 'r1',
        details: {},
        severity: 'info',
      });

      await audit.log({
        action: 'action2',
        actor: 'user2',
        resource: 'r2',
        details: {},
        severity: 'info',
      });

      const entries = await audit.query();
      expect(entries[0].id).not.toBe(entries[1].id);
    });
  });

  describe('query', () => {
    it('should query by action', async () => {
      await audit.log({
        action: 'user.login',
        actor: 'user1',
        resource: 'auth',
        details: {},
        severity: 'info',
      });

      await audit.log({
        action: 'user.logout',
        actor: 'user1',
        resource: 'auth',
        details: {},
        severity: 'info',
      });

      const entries = await audit.query({ action: 'user.login' });
      expect(entries.length).toBe(1);
      expect(entries[0].action).toBe('user.login');
    });

    it('should query by actor', async () => {
      await audit.log({
        action: 'action1',
        actor: 'user1',
        resource: 'r1',
        details: {},
        severity: 'info',
      });

      await audit.log({
        action: 'action2',
        actor: 'user2',
        resource: 'r2',
        details: {},
        severity: 'info',
      });

      const entries = await audit.query({ actor: 'user1' });
      expect(entries.length).toBe(1);
      expect(entries[0].actor).toBe('user1');
    });

    it('should query by severity', async () => {
      await audit.log({
        action: 'action1',
        actor: 'user1',
        resource: 'r1',
        details: {},
        severity: 'info',
      });

      await audit.log({
        action: 'action2',
        actor: 'user1',
        resource: 'r1',
        details: {},
        severity: 'error',
      });

      const entries = await audit.query({ severity: 'error' });
      expect(entries.length).toBe(1);
      expect(entries[0].severity).toBe('error');
    });

    it('should limit results', async () => {
      for (let i = 0; i < 10; i++) {
        await audit.log({
          action: `action${i}`,
          actor: 'user1',
          resource: 'r1',
          details: {},
          severity: 'info',
        });
      }

      const entries = await audit.query({ limit: 5 });
      expect(entries.length).toBe(5);
    });

    it('should offset results', async () => {
      for (let i = 0; i < 10; i++) {
        await audit.log({
          action: `action${i}`,
          actor: 'user1',
          resource: 'r1',
          details: {},
          severity: 'info',
        });
      }

      const entries = await audit.query({ offset: 5, limit: 5 });
      expect(entries.length).toBe(5);
    });
  });

  describe('flush', () => {
    it('should flush on buffer limit', async () => {
      // Buffer limit is 10
      for (let i = 0; i < 10; i++) {
        await audit.log({
          action: `action${i}`,
          actor: 'user1',
          resource: 'r1',
          details: {},
          severity: 'info',
        });
      }

      // Should have been flushed automatically
      const entries = await audit.query();
      expect(entries.length).toBe(10);
    });

    it('should manually flush', async () => {
      await audit.log({
        action: 'test',
        actor: 'user1',
        resource: 'r1',
        details: {},
        severity: 'info',
      });

      await audit.flush();

      const entries = await audit.query();
      expect(entries.length).toBe(1);
    });
  });

  describe('stats', () => {
    it('should provide stats', async () => {
      await audit.log({
        action: 'user.login',
        actor: 'user1',
        resource: 'auth',
        details: {},
        severity: 'info',
      });

      await audit.log({
        action: 'user.login',
        actor: 'user2',
        resource: 'auth',
        details: {},
        severity: 'info',
      });

      await audit.log({
        action: 'error.occurred',
        actor: 'system',
        resource: 'app',
        details: {},
        severity: 'error',
      });

      const stats = await audit.getStats();
      expect(stats.totalEntries).toBe(3);
      expect(stats.byAction['user.login']).toBe(2);
      expect(stats.bySeverity['info']).toBe(2);
      expect(stats.bySeverity['error']).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear logs', async () => {
      await audit.log({
        action: 'test',
        actor: 'user1',
        resource: 'r1',
        details: {},
        severity: 'info',
      });

      await audit.clear();

      const entries = await audit.query();
      expect(entries.length).toBe(0);
    });
  });
});
