/**
 * 配置版本控制
 * 配置变更历史和回滚
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '../core/logger.js';

const logger = new Logger('config:versioning');

/** 配置版本 */
export interface ConfigVersion {
  version: number;
  config: Record<string, unknown>;
  timestamp: Date;
  author: string;
  message: string;
  checksum: string;
}

/**
 * 配置版本管理器
 */
export class ConfigVersioning {
  private versions: ConfigVersion[] = [];
  private storagePath: string;
  private maxVersions: number;

  constructor(storagePath = './config-versions', maxVersions = 50) {
    this.storagePath = storagePath;
    this.maxVersions = maxVersions;
  }

  /**
   * 保存配置版本
   */
  async save(
    config: Record<string, unknown>,
    author = 'system',
    message = '',
  ): Promise<ConfigVersion> {
    const version: ConfigVersion = {
      version: this.versions.length + 1,
      config: { ...config },
      timestamp: new Date(),
      author,
      message,
      checksum: this.checksum(JSON.stringify(config)),
    };

    this.versions.push(version);

    // 限制版本数
    if (this.versions.length > this.maxVersions) {
      this.versions.shift();
    }

    await this.persistVersions();

    logger.info(`Config version saved: v${version.version}`);
    return version;
  }

  /**
   * 获取当前版本
   */
  getCurrent(): ConfigVersion | undefined {
    return this.versions[this.versions.length - 1];
  }

  /**
   * 获取指定版本
   */
  getVersion(version: number): ConfigVersion | undefined {
    return this.versions.find((v) => v.version === version);
  }

  /**
   * 获取所有版本
   */
  getAllVersions(): ConfigVersion[] {
    return [...this.versions];
  }

  /**
   * 获取最近 N 个版本
   */
  getRecent(count = 10): ConfigVersion[] {
    return this.versions.slice(-count);
  }

  /**
   * 回滚到指定版本
   */
  rollback(version: number): Record<string, unknown> | null {
    const target = this.getVersion(version);
    if (!target) {
      logger.warn(`Version ${version} not found`);
      return null;
    }

    logger.info(`Rolling back to version ${version}`);
    return { ...target.config };
  }

  /**
   * 比较两个版本
   */
  compare(v1: number, v2: number): {
    added: string[];
    removed: string[];
    changed: string[];
  } {
    const version1 = this.getVersion(v1);
    const version2 = this.getVersion(v2);

    if (!version1 || !version2) {
      return { added: [], removed: [], changed: [] };
    }

    const keys1 = new Set(Object.keys(version1.config));
    const keys2 = new Set(Object.keys(version2.config));

    const added = [...keys2].filter((k) => !keys1.has(k));
    const removed = [...keys1].filter((k) => !keys2.has(k));
    const changed = [...keys1].filter(
      (k) =>
        keys2.has(k) &&
        JSON.stringify(version1.config[k]) !== JSON.stringify(version2.config[k]),
    );

    return { added, removed, changed };
  }

  /**
   * 验证配置完整性
   */
  validate(): boolean {
    for (const version of this.versions) {
      const currentChecksum = this.checksum(JSON.stringify(version.config));
      if (currentChecksum !== version.checksum) {
        logger.error(`Version ${version.version} checksum mismatch`);
        return false;
      }
    }
    return true;
  }

  /**
   * 加载版本历史
   */
  async load(): Promise<void> {
    try {
      const filePath = join(this.storagePath, 'versions.json');
      if (!existsSync(filePath)) return;

      const content = await readFile(filePath, 'utf-8');
      this.versions = JSON.parse(content);
      logger.info(`Loaded ${this.versions.length} config versions`);
    } catch (error) {
      logger.error('Failed to load version history', error);
    }
  }

  /**
   * 持久化版本历史
   */
  private async persistVersions(): Promise<void> {
    try {
      if (!existsSync(this.storagePath)) {
        await mkdir(this.storagePath, { recursive: true });
      }

      const filePath = join(this.storagePath, 'versions.json');
      await writeFile(filePath, JSON.stringify(this.versions, null, 2));
    } catch (error) {
      logger.error('Failed to persist version history', error);
    }
  }

  private checksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}

/** 全局配置版本管理器 */
export const configVersioning = new ConfigVersioning();
