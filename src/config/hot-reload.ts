/**
 * 配置文件热重载
 * 监控配置文件变更并自动重新加载
 */

import { watch, type FSWatcher } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './loader.js';
import type { GuicangConfig } from './schema.js';
import { Logger } from '../core/logger.js';

export type ConfigChangeCallback = (newConfig: GuicangConfig, oldConfig: GuicangConfig) => void;

export interface HotReloadOptions {
  /** 配置文件路径 */
  configPath?: string;
  /** 防抖间隔（毫秒） */
  debounceMs?: number;
  /** 变更回调 */
  onChange?: ConfigChangeCallback;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

const logger = new Logger('config:hot-reload');

/**
 * 配置热重载管理器
 */
export class ConfigHotReload {
  private watcher: FSWatcher | null = null;
  private currentConfig: GuicangConfig | null = null;
  private configPath: string;
  private debounceMs: number;
  private onChange?: ConfigChangeCallback;
  private onError?: (error: Error) => void;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: HotReloadOptions = {}) {
    this.configPath = resolve(options.configPath ?? './guicang.toml');
    this.debounceMs = options.debounceMs ?? 300;
    this.onChange = options.onChange;
    this.onError = options.onError;
  }

  /**
   * 启动热重载
   */
  async start(): Promise<GuicangConfig> {
    // 初始加载
    this.currentConfig = await loadConfig(this.configPath);
    logger.info('Config loaded', { path: this.configPath });

    try {
      this.watcher = watch(this.configPath, async (eventType) => {
        if (eventType === 'change') {
          this.handleFileChange();
        }
      });

      this.watcher.on('error', (error) => {
        logger.error('Watcher error', error);
        this.onError?.(error as Error);
      });

      logger.info('Hot reload started', { path: this.configPath });
    } catch (error) {
      logger.warn('Could not start file watcher', error);
      // 文件不存在时不报错，只记录日志
    }

    return this.currentConfig;
  }

  /**
   * 停止热重载
   */
  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    logger.info('Hot reload stopped');
  }

  /**
   * 获取当前配置
   */
  getConfig(): GuicangConfig | null {
    return this.currentConfig;
  }

  /**
   * 手动重新加载配置
   */
  async reload(): Promise<GuicangConfig> {
    const oldConfig = this.currentConfig;
    this.currentConfig = await loadConfig(this.configPath);

    if (oldConfig && this.onChange) {
      this.onChange(this.currentConfig, oldConfig);
    }

    return this.currentConfig;
  }

  private handleFileChange(): void {
    // 防抖处理
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      try {
        const oldConfig = this.currentConfig;
        this.currentConfig = await loadConfig(this.configPath);
        logger.info('Config reloaded');

        if (oldConfig && this.onChange) {
          this.onChange(this.currentConfig, oldConfig);
        }
      } catch (error) {
        logger.error('Failed to reload config', error);
        this.onError?.(error as Error);
      }
    }, this.debounceMs);
  }
}

/**
 * 创建热重载实例
 */
export function createHotReload(options: HotReloadOptions = {}): ConfigHotReload {
  return new ConfigHotReload(options);
}
