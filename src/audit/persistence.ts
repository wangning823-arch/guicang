/**
 * 审计日志持久化
 * 操作记录存储和查询
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '../core/logger.js';

const logger = new Logger('audit:persistence');

/** 审计日志条目 */
export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: string;
  actor: string;
  resource: string;
  details: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  ipAddress?: string;
  userAgent?: string;
}

/** 查询选项 */
export interface AuditQueryOptions {
  startDate?: Date;
  endDate?: Date;
  action?: string;
  actor?: string;
  severity?: AuditEntry['severity'];
  limit?: number;
  offset?: number;
}

/**
 * 审计日志持久化器
 */
export class AuditPersistence {
  private logDir: string;
  private currentLogFile: string;
  private buffer: AuditEntry[] = [];
  private bufferLimit: number;
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor(logDir = './audit-logs', bufferLimit = 100) {
    this.logDir = logDir;
    this.currentLogFile = this.getLogFileName();
    this.bufferLimit = bufferLimit;
  }

  /**
   * 开始自动刷新
   */
  startAutoFlush(intervalMs = 5000): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch((err) => logger.error('Auto flush failed', err));
    }, intervalMs);
  }

  /**
   * 停止自动刷新
   */
  stopAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * 记录审计条目
   */
  async log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
    const fullEntry: AuditEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date(),
    };

    this.buffer.push(fullEntry);

    if (this.buffer.length >= this.bufferLimit) {
      await this.flush();
    }
  }

  /**
   * 刷新缓冲区到文件
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    await this.ensureLogDir();

    const entries = [...this.buffer];
    this.buffer = [];

    const logLine = entries
      .map((e) => JSON.stringify(e))
      .join('\n') + '\n';

    try {
      await writeFile(this.currentLogFile, logLine, { flag: 'a' });
      logger.debug(`Flushed ${entries.length} audit entries`);
    } catch (error) {
      logger.error('Failed to flush audit log', error);
      // 恢复缓冲区
      this.buffer.unshift(...entries);
    }
  }

  /**
   * 查询审计日志
   */
  async query(options: AuditQueryOptions = {}): Promise<AuditEntry[]> {
    const entries = await this.readAllLogs();

    let filtered = entries;

    if (options.startDate) {
      filtered = filtered.filter(
        (e) => new Date(e.timestamp) >= options.startDate!,
      );
    }

    if (options.endDate) {
      filtered = filtered.filter(
        (e) => new Date(e.timestamp) <= options.endDate!,
      );
    }

    if (options.action) {
      filtered = filtered.filter((e) => e.action === options.action);
    }

    if (options.actor) {
      filtered = filtered.filter((e) => e.actor === options.actor);
    }

    if (options.severity) {
      filtered = filtered.filter((e) => e.severity === options.severity);
    }

    // 排序（最新的在前）
    filtered.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    // 分页
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    return filtered.slice(offset, offset + limit);
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    totalEntries: number;
    byAction: Record<string, number>;
    bySeverity: Record<string, number>;
    byActor: Record<string, number>;
  }> {
    const entries = await this.readAllLogs();

    const byAction: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byActor: Record<string, number> = {};

    for (const entry of entries) {
      byAction[entry.action] = (byAction[entry.action] ?? 0) + 1;
      bySeverity[entry.severity] = (bySeverity[entry.severity] ?? 0) + 1;
      byActor[entry.actor] = (byActor[entry.actor] ?? 0) + 1;
    }

    return {
      totalEntries: entries.length,
      byAction,
      bySeverity,
      byActor,
    };
  }

  /**
   * 清空日志
   */
  async clear(): Promise<void> {
    this.buffer = [];
    this.currentLogFile = this.getLogFileName();
  }

  /**
   * 读取所有日志
   */
  private async readAllLogs(): Promise<AuditEntry[]> {
    await this.flush(); // 确保缓冲区已刷新

    try {
      if (!existsSync(this.currentLogFile)) {
        return [];
      }

      const content = await readFile(this.currentLogFile, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      return lines.map((line) => JSON.parse(line) as AuditEntry);
    } catch {
      return [];
    }
  }

  private async ensureLogDir(): Promise<void> {
    if (!existsSync(this.logDir)) {
      await mkdir(this.logDir, { recursive: true });
    }
  }

  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return join(this.logDir, `audit-${date}.log`);
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2, 15);
  }
}

/** 全局审计持久化器 */
export const auditPersistence = new AuditPersistence();
