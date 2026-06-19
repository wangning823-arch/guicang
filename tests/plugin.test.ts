import { describe, it, expect, beforeEach } from 'vitest';
import {
  BasePlugin,
  type PluginManifest,
  type PluginContext,
  registerPlugin,
  getPlugin,
  getAllPlugins,
  getLoadedPluginNames,
  unloadPlugin,
  clearPluginRegistry,
} from '../src/plugin/index.js';
import { DEFAULT_CONFIG } from '../src/config/schema.js';

/** 测试插件 */
class TestPlugin extends BasePlugin {
  initialized = false;
  cleanedUp = false;

  constructor(manifest: PluginManifest) {
    super(manifest);
  }

  async initialize(context: PluginContext): Promise<void> {
    this.initialized = true;
    context.log(`Test plugin initialized: ${this.name}`);
  }

  async cleanup(): Promise<void> {
    this.cleanedUp = true;
  }
}

describe('Plugin Registry', () => {
  beforeEach(() => {
    clearPluginRegistry();
  });

  it('registers and retrieves plugins', () => {
    const plugin = new TestPlugin({ name: 'test', version: '1.0.0' });
    registerPlugin(plugin);

    expect(getPlugin('test')).toBe(plugin);
    expect(getLoadedPluginNames()).toContain('test');
  });

  it('throws on duplicate registration', () => {
    registerPlugin(new TestPlugin({ name: 'dup', version: '1.0.0' }));
    expect(() => registerPlugin(new TestPlugin({ name: 'dup', version: '1.0.0' }))).toThrow(
      'already registered',
    );
  });

  it('returns all plugins', () => {
    registerPlugin(new TestPlugin({ name: 'a', version: '1.0.0' }));
    registerPlugin(new TestPlugin({ name: 'b', version: '2.0.0' }));

    expect(getAllPlugins()).toHaveLength(2);
  });

  it('unloads plugins', async () => {
    const plugin = new TestPlugin({ name: 'unload-me', version: '1.0.0' });
    registerPlugin(plugin);

    const unloaded = await unloadPlugin('unload-me');
    expect(unloaded).toBe(true);
    expect(plugin.cleanedUp).toBe(true);
    expect(getPlugin('unload-me')).toBeUndefined();
  });

  it('returns false for unloading unknown plugin', async () => {
    expect(await unloadPlugin('unknown')).toBe(false);
  });
});

describe('TestPlugin', () => {
  it('initializes correctly', async () => {
    const plugin = new TestPlugin({ name: 'test', version: '1.0.0' });
    const context: PluginContext = {
      config: DEFAULT_CONFIG,
      registerTool: () => {},
      registerSkill: () => {},
      registerProvider: () => {},
      log: () => {},
    };

    await plugin.initialize(context);
    expect(plugin.initialized).toBe(true);
  });

  it('cleans up correctly', async () => {
    const plugin = new TestPlugin({ name: 'test', version: '1.0.0' });
    const context: PluginContext = {
      config: DEFAULT_CONFIG,
      registerTool: () => {},
      registerSkill: () => {},
      registerProvider: () => {},
      log: () => {},
    };

    await plugin.initialize(context);
    await plugin.cleanup();
    expect(plugin.cleanedUp).toBe(true);
  });

  it('has correct manifest', () => {
    const plugin = new TestPlugin({
      name: 'my-plugin',
      version: '2.0.0',
      description: 'A test plugin',
      author: 'Test Author',
    });

    expect(plugin.name).toBe('my-plugin');
    expect(plugin.version).toBe('2.0.0');
    expect(plugin.manifest.description).toBe('A test plugin');
    expect(plugin.manifest.author).toBe('Test Author');
  });
});
