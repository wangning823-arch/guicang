/**
 * 插件注册中心
 * 管理所有已加载的插件
 */

import { BasePlugin, type PluginContext } from './base.js';
import { loadPluginsFromDir, loadPluginFromPackage } from './loader.js';
import type { GuicangConfig } from '../config/schema.js';
import { Logger } from '../core/logger.js';

const logger = new Logger('plugin:registry');

/** 已加载的插件 */
const loadedPlugins = new Map<string, BasePlugin>();

/**
 * 注册插件
 */
export function registerPlugin(plugin: BasePlugin): void {
  if (loadedPlugins.has(plugin.name)) {
    throw new Error(`Plugin "${plugin.name}" is already registered`);
  }
  loadedPlugins.set(plugin.name, plugin);
  logger.info(`Registered plugin: ${plugin.name} v${plugin.version}`);
}

/**
 * 获取插件
 */
export function getPlugin(name: string): BasePlugin | undefined {
  return loadedPlugins.get(name);
}

/**
 * 获取所有已加载的插件
 */
export function getAllPlugins(): BasePlugin[] {
  return [...loadedPlugins.values()];
}

/**
 * 获取所有已加载的插件名称
 */
export function getLoadedPluginNames(): string[] {
  return [...loadedPlugins.keys()];
}

/**
 * 卸载插件
 */
export async function unloadPlugin(name: string): Promise<boolean> {
  const plugin = loadedPlugins.get(name);
  if (!plugin) return false;

  try {
    await plugin.cleanup();
    loadedPlugins.delete(name);
    logger.info(`Unloaded plugin: ${name}`);
    return true;
  } catch (error) {
    logger.error(`Failed to unload plugin ${name}`, error);
    return false;
  }
}

/**
 * 从目录加载所有插件
 */
export async function loadPlugins(
  pluginsDir: string,
  config: GuicangConfig,
  context: Omit<PluginContext, 'config'>,
): Promise<void> {
  const fullContext: PluginContext = { ...context, config };
  const plugins = await loadPluginsFromDir(pluginsDir, fullContext);

  for (const plugin of plugins) {
    registerPlugin(plugin);
  }
}

/**
 * 从 npm 包加载插件
 */
export async function loadPlugin(
  packageName: string,
  config: GuicangConfig,
  context: Omit<PluginContext, 'config'>,
): Promise<void> {
  const fullContext: PluginContext = { ...context, config };
  const plugin = await loadPluginFromPackage(packageName, fullContext);

  if (plugin) {
    registerPlugin(plugin);
  }
}

/**
 * 卸载所有插件
 */
export async function unloadAllPlugins(): Promise<void> {
  for (const [name] of loadedPlugins) {
    await unloadPlugin(name);
  }
}

/**
 * 清空插件注册表（测试用）
 */
export function clearPluginRegistry(): void {
  loadedPlugins.clear();
}
