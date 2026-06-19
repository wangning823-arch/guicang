import { describe, it, expect, beforeEach } from 'vitest';
import { PluginHotReload } from '../src/plugin/hot-reload.js';

describe('PluginHotReload', () => {
  let hotReload: PluginHotReload;

  beforeEach(() => {
    hotReload = new PluginHotReload();
  });

  describe('lifecycle', () => {
    it('should create instance', () => {
      expect(hotReload).toBeDefined();
    });

    it('should report not running initially', () => {
      expect(hotReload.isRunning()).toBe(false);
    });

    it('should have zero watched plugins initially', () => {
      expect(hotReload.getWatchCount()).toBe(0);
    });
  });

  describe('plugin management', () => {
    it('should watch a plugin', () => {
      hotReload.watchPlugin('test-plugin', '/path/to/plugin');
      expect(hotReload.getWatchCount()).toBe(1);
    });

    it('should unwatch a plugin', () => {
      hotReload.watchPlugin('test-plugin', '/path/to/plugin');
      hotReload.unwatchPlugin('test-plugin');
      expect(hotReload.getWatchCount()).toBe(0);
    });

    it('should track multiple plugins', () => {
      hotReload.watchPlugin('plugin-a', '/path/a');
      hotReload.watchPlugin('plugin-b', '/path/b');
      expect(hotReload.getWatchCount()).toBe(2);
    });
  });

  describe('callbacks', () => {
    it('should register callback', () => {
      let called = false;
      hotReload.onReload(async () => {
        called = true;
      });

      // Trigger callback manually via internal method
      hotReload['callbacks'][0]('test-plugin', 'changed');

      expect(called).toBe(true);
    });

    it('should register multiple callbacks', () => {
      let count = 0;
      hotReload.onReload(async () => { count++; });
      hotReload.onReload(async () => { count++; });

      hotReload['callbacks'].forEach((cb) => cb('test', 'changed'));
      expect(count).toBe(2);
    });
  });

  describe('enable/disable', () => {
    it('should disable hot reload', () => {
      hotReload.setEnabled(false);
      expect(hotReload['enabled']).toBe(false);
    });

    it('should enable hot reload', () => {
      hotReload.setEnabled(false);
      hotReload.setEnabled(true);
      expect(hotReload['enabled']).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle callback errors', async () => {
      hotReload.onReload(async () => {
        throw new Error('Callback error');
      });

      // This should not throw
      await hotReload['handleChange']('test.js', 'changed');
    });
  });
});
