/**
 * 日志面板
 * 实时日志流显示
 */

import type { TUIEngine } from '../engine.js';
import { Box as BoxComponent } from '../components/box.js';
import { colorize, Theme } from '../theme.js';

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  module: string;
  message: string;
  data?: unknown;
}

export interface LogsPanelOptions {
  maxEntries?: number;
}

export class LogsPanel {
  private box: BoxComponent;
  private entries: LogEntry[] = [];
  private maxEntries: number;

  constructor(x: number, y: number, width: number, height: number, options: LogsPanelOptions = {}) {
    this.box = new BoxComponent(
      { x, y, width, height },
      { title: '📋 日志', border: true },
    );
    this.maxEntries = options.maxEntries ?? 100;
  }

  /** 添加日志条目 */
  addEntry(entry: LogEntry): void {
    this.entries.push(entry);

    // 限制条目数量
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // 格式化日志
    const timestamp = this.formatTime(entry.timestamp);
    const levelColor = this.getLevelColor(entry.level);
    const levelTag = colorize(`[${entry.level.toUpperCase().padEnd(5)}]`, levelColor);
    const moduleTag = colorize(`[${entry.module}]`, Theme.textMuted);

    const logLine = `${colorize(timestamp, Theme.textMuted)} ${levelTag} ${moduleTag} ${entry.message}`;
    this.box.appendLine(logLine);
  }

  /** 获取日志级别颜色 */
  private getLevelColor(level: string): string {
    switch (level) {
      case 'debug':
        return Theme.logDebug;
      case 'info':
        return Theme.logInfo;
      case 'warn':
        return Theme.logWarn;
      case 'error':
        return Theme.logError;
      default:
        return Theme.text;
    }
  }

  /** 格式化时间 */
  private formatTime(date: Date): string {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  }

  /** 清空日志 */
  clear(): void {
    this.entries = [];
    this.box.setContent([]);
  }

  /** 获取最近的日志 */
  getRecent(count: number): LogEntry[] {
    return this.entries.slice(-count);
  }

  /** 渲染 */
  render(engine: TUIEngine): void {
    this.box.render(engine);
  }
}
