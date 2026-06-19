import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigHotReload } from '../src/config/hot-reload.js';

describe('ConfigHotReload', () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(async () => {
    tmpDir = resolve(tmpdir(), `guicang-config-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    configPath = resolve(tmpDir, 'guicang.toml');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it('loads initial config', async () => {
    await writeFile(configPath, `
name = "test-project"
logLevel = "debug"
`);

    const hotReload = new ConfigHotReload({ configPath });
    const config = await hotReload.start();

    expect(config.name).toBe('test-project');
    expect(config.logLevel).toBe('debug');

    hotReload.stop();
  });

  it('uses default config when file missing', async () => {
    const hotReload = new ConfigHotReload({ configPath });
    const config = await hotReload.start();

    expect(config.name).toBe('guicang');

    hotReload.stop();
  });

  it('manual reload works', async () => {
    await writeFile(configPath, `
name = "v1"
`);

    const hotReload = new ConfigHotReload({ configPath });
    await hotReload.start();

    // 修改配置文件
    await writeFile(configPath, `
name = "v2"
`);

    const newConfig = await hotReload.reload();
    expect(newConfig.name).toBe('v2');

    hotReload.stop();
  });

  it('onChange callback fires on reload', async () => {
    await writeFile(configPath, `
name = "before"
`);

    let callbackFired = false;
    let receivedNewConfig = false;

    const hotReload = new ConfigHotReload({
      configPath,
      onChange: (newConfig) => {
        callbackFired = true;
        receivedNewConfig = newConfig.name === 'after';
      },
    });

    await hotReload.start();

    await writeFile(configPath, `
name = "after"
`);

    await hotReload.reload();

    expect(callbackFired).toBe(true);
    expect(receivedNewConfig).toBe(true);

    hotReload.stop();
  });

  it('getConfig returns current config', async () => {
    await writeFile(configPath, `
name = "current"
`);

    const hotReload = new ConfigHotReload({ configPath });
    await hotReload.start();

    const config = hotReload.getConfig();
    expect(config).not.toBeNull();
    expect(config!.name).toBe('current');

    hotReload.stop();
  });

  it('stop cleans up resources', async () => {
    const hotReload = new ConfigHotReload({ configPath });
    await hotReload.start();

    hotReload.stop();

    // stop 后 getConfig 仍应返回最后的配置
    const config = hotReload.getConfig();
    expect(config).not.toBeNull();
  });
});
