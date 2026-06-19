import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigVersioning } from '../src/config/versioning.js';
import { rmSync, existsSync } from 'node:fs';

describe('ConfigVersioning', () => {
  let versioning: ConfigVersioning;
  const testDir = './test-config-versions';

  beforeEach(() => {
    versioning = new ConfigVersioning(testDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('save/get', () => {
    it('should save a version', async () => {
      const version = await versioning.save(
        { model: 'gpt-4', temperature: 0.7 },
        'admin',
        'Initial config',
      );

      expect(version.version).toBe(1);
      expect(version.author).toBe('admin');
      expect(version.message).toBe('Initial config');
      expect(version.checksum).toBeDefined();
    });

    it('should get current version', async () => {
      await versioning.save({ model: 'gpt-4' });
      await versioning.save({ model: 'gpt-3.5' });

      const current = versioning.getCurrent();
      expect(current).toBeDefined();
      expect(current!.version).toBe(2);
      expect(current!.config.model).toBe('gpt-3.5');
    });

    it('should get specific version', async () => {
      await versioning.save({ model: 'gpt-4' });
      await versioning.save({ model: 'gpt-3.5' });

      const v1 = versioning.getVersion(1);
      expect(v1).toBeDefined();
      expect(v1!.config.model).toBe('gpt-4');
    });

    it('should get all versions', async () => {
      await versioning.save({ v: 1 });
      await versioning.save({ v: 2 });
      await versioning.save({ v: 3 });

      const all = versioning.getAllVersions();
      expect(all.length).toBe(3);
    });

    it('should get recent versions', async () => {
      for (let i = 0; i < 10; i++) {
        await versioning.save({ v: i });
      }

      const recent = versioning.getRecent(5);
      expect(recent.length).toBe(5);
      expect(recent[0].version).toBe(6);
    });
  });

  describe('rollback', () => {
    it('should rollback to specific version', async () => {
      await versioning.save({ model: 'gpt-4' });
      await versioning.save({ model: 'gpt-3.5' });

      const config = versioning.rollback(1);
      expect(config).not.toBeNull();
      expect(config!.model).toBe('gpt-4');
    });

    it('should return null for non-existent version', () => {
      const config = versioning.rollback(999);
      expect(config).toBeNull();
    });
  });

  describe('compare', () => {
    it('should detect added keys', async () => {
      await versioning.save({ model: 'gpt-4' });
      await versioning.save({ model: 'gpt-4', temperature: 0.7 });

      const diff = versioning.compare(1, 2);
      expect(diff.added).toContain('temperature');
    });

    it('should detect removed keys', async () => {
      await versioning.save({ model: 'gpt-4', temperature: 0.7 });
      await versioning.save({ model: 'gpt-4' });

      const diff = versioning.compare(1, 2);
      expect(diff.removed).toContain('temperature');
    });

    it('should detect changed values', async () => {
      await versioning.save({ model: 'gpt-4' });
      await versioning.save({ model: 'gpt-3.5' });

      const diff = versioning.compare(1, 2);
      expect(diff.changed).toContain('model');
    });
  });

  describe('validate', () => {
    it('should validate correct checksums', async () => {
      await versioning.save({ model: 'gpt-4' });
      await versioning.save({ model: 'gpt-3.5' });

      expect(versioning.validate()).toBe(true);
    });
  });

  describe('persistence', () => {
    it('should persist and load versions', async () => {
      await versioning.save({ model: 'gpt-4' });
      await versioning.save({ model: 'gpt-3.5' });

      // Create new instance and load
      const newVersioning = new ConfigVersioning(testDir);
      await newVersioning.load();

      const versions = newVersioning.getAllVersions();
      expect(versions.length).toBe(2);
    });

    it('should handle loading non-existent file', async () => {
      const newVersioning = new ConfigVersioning('./nonexistent');
      await newVersioning.load();
      expect(newVersioning.getAllVersions().length).toBe(0);
    });
  });

  describe('limits', () => {
    it('should respect max versions', async () => {
      const limited = new ConfigVersioning(testDir, 5);

      for (let i = 0; i < 10; i++) {
        await limited.save({ v: i });
      }

      expect(limited.getAllVersions().length).toBe(5);
      // Version numbers continue incrementing even when old versions are removed
      expect(limited.getCurrent()!.version).toBe(6);
    });
  });
});
