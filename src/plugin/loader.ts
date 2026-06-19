/**
 * 插件加载器
 * 从文件系统或 npm 包加载插件
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { BasePlugin, type PluginManifest, type PluginContext } from './base.js';
import { Logger } from '../core/logger.js';

const logger = new Logger('plugin:loader');

/** 插件加载选项 */
export interface PluginLoaderOptions {
  /** 插件目录路径 */
  pluginsDir: string;
  /** 是否自动加载 */
  autoLoad?: boolean;
}

/**
 * 从目录加载插件
 */
export async function loadPluginsFromDir(
  pluginsDir: string,
  context: PluginContext,
): Promise<BasePlugin[]> {
  const plugins: BasePlugin[] = [];

  try {
    const entries = await readdir(pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginDir = join(pluginsDir, entry.name);
      const plugin = await loadPluginFromDir(pluginDir, context);

      if (plugin) {
        plugins.push(plugin);
      }
    }
  } catch (error) {
    logger.warn(`Failed to load plugins from ${pluginsDir}`, error);
  }

  return plugins;
}

/**
 * 从单个目录加载插件
 */
export async function loadPluginFromDir(
  pluginDir: string,
  context: PluginContext,
): Promise<BasePlugin | null> {
  try {
    // 读取 manifest
    const manifestPath = join(pluginDir, 'plugin.json');
    const manifestContent = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent) as PluginManifest;

    // 加载插件代码
    const entryPath = join(pluginDir, 'index.js');
    const entryStat = await stat(entryPath).catch(() => null);

    if (!entryStat) {
      logger.warn(`Plugin ${manifest.name}: entry file not found`);
      return null;
    }

    // 动态导入
    const module = await import(entryPath);
    const PluginClass = module.default ?? module[manifest.name];

    if (!PluginClass) {
      logger.warn(`Plugin ${manifest.name}: no default export found`);
      return null;
    }

    const plugin = new PluginClass(manifest) as BasePlugin;

    // 初始化插件
    await plugin.initialize(context);
    logger.info(`Loaded plugin: ${manifest.name} v${manifest.version}`);

    return plugin;
  } catch (error) {
    logger.error(`Failed to load plugin from ${pluginDir}`, error);
    return null;
  }
}

/**
 * 从 npm 包加载插件
 */
export async function loadPluginFromPackage(
  packageName: string,
  context: PluginContext,
): Promise<BasePlugin | null> {
  try {
    const module = await import(packageName);
    const manifest: PluginManifest = module.manifest ?? {
      name: packageName,
      version: '0.0.0',
    };

    const PluginClass = module.default ?? module[manifest.name];

    if (!PluginClass) {
      logger.warn(`Package ${packageName}: no plugin class found`);
      return null;
    }

    const plugin = new PluginClass(manifest) as BasePlugin;
    await plugin.initialize(context);
    logger.info(`Loaded plugin from package: ${packageName}`);

    return plugin;
  } catch (error) {
    logger.error(`Failed to load plugin from package ${packageName}`, error);
    return null;
  }
}
