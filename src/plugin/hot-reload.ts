/**
 * 插件热重载
 * 运行时插件更新
 */

import { watch, type FSWatcher } from 'node:fs';
import { Logger } from '../core/logger.js';

const logger = new Logger('plugin:hot-reload');

/** 热重载事件 */
export type HotReloadEvent = 'added' | 'changed' | 'removed';

/** 热重载回调 */
export type HotReloadCallback = (
  pluginName: string,
  event: HotReloadEvent,
) => Promise<void>;

/**
 * 插件热重载器
 */
export class PluginHotReload {
  private watcher: FSWatcher | null = null;
  private watchedPaths = new Map<string, string>(); // path -> pluginName
  private callbacks: HotReloadCallback[] = [];
  private enabled = true;

  /**
   * 开始监听
   */
  start(watchDir: string): void {
    if (this.watcher) {
      this.stop();
    }

    try {
      this.watcher = watch(watchDir, { recursive: true }, (eventType, filename) => {
        if (!filename || !this.enabled) return;

        this.handleChange(filename, eventType === 'rename' ? 'changed' : 'changed');
      });

      logger.info(`Watching for plugin changes in ${watchDir}`);
    } catch (error) {
      logger.error('Failed to start hot reload watcher', error);
    }
  }

  /**
   * 停止监听
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      logger.info('Hot reload watcher stopped');
    }
  }

  /**
   * 注册插件路径
   */
  watchPlugin(pluginName: string, path: string): void {
    this.watchedPaths.set(path, pluginName);
    logger.debug(`Watching plugin: ${pluginName} at ${path}`);
  }

  /**
   * 取消注册
   */
  unwatchPlugin(pluginName: string): void {
    for (const [path, name] of this.watchedPaths) {
      if (name === pluginName) {
        this.watchedPaths.delete(path);
        break;
      }
    }
  }

  /**
   * 注册回调
   */
  onReload(callback: HotReloadCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * 启用/禁用
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info(`Hot reload ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * 处理文件变化
   */
  private async handleChange(filename: string, event: HotReloadEvent): Promise<void> {
    // 找到对应的插件
    for (const [path, pluginName] of this.watchedPaths) {
      if (filename.includes(path) || filename.includes(pluginName)) {
        logger.info(`Plugin ${pluginName} ${event}: ${filename}`);

        // 触发回调
        for (const callback of this.callbacks) {
          try {
            await callback(pluginName, event);
          } catch (error) {
            logger.error(`Hot reload callback error for ${pluginName}`, error);
          }
        }
        break;
      }
    }
  }

  /**
   * 获取状态
   */
  isRunning(): boolean {
    return this.watcher !== null;
  }

  /**
   * 获取监听的插件数
   */
  getWatchCount(): number {
    return this.watchedPaths.size;
  }
}

/** 全局热重载器 */
export const pluginHotReload = new PluginHotReload();
