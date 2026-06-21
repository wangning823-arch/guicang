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
  private isDirty = true;
  private formattedContent: string[] = [];
  private isActive = false;

  constructor(x: number, y: number, width: number, height: number, options: LogsPanelOptions = {}, accentColor?: string) {
    this.box = new BoxComponent(
      { x, y, width, height },
      { title: '[LOG] 日志', border: true, accentColor },
    );
    this.maxEntries = options.maxEntries ?? 100;
  }

  /** 设置激活状态 */
  setActive(active: boolean): void {
    this.isActive = active;
    if (active) {
      this.box.options.accentColor = Theme.borderFocused;
    } else {
      this.box.options.accentColor = Theme.info;
    }
  }

  /** 添加日志条目 */
  addEntry(entry: LogEntry): void {
    this.entries.push(entry);

    // 限制条目数量
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // 标记需要更新
    this.isDirty = true;
  }

  /** 格式化所有条目 */
  private formatEntries(): string[] {
    const content: string[] = [];
    for (const entry of this.entries) {
      const timestamp = this.formatTime(entry.timestamp);
      const levelColor = this.getLevelColor(entry.level);
      const levelTag = colorize(`[${entry.level.toUpperCase().padEnd(5)}]`, levelColor);
      const moduleTag = colorize(`[${entry.module}]`, Theme.textMuted);
      const logLine = `${colorize(timestamp, Theme.textMuted)} ${levelTag} ${moduleTag} ${entry.message}`;
      content.push(logLine);
    }
    return content;
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
    this.formattedContent = [];
    this.box.setContent([]);
    this.isDirty = true;
  }

  /** 获取最近的日志 */
  getRecent(count: number): LogEntry[] {
    return this.entries.slice(-count);
  }

  /** 渲染 */
  render(engine: TUIEngine): void {
    // 仅在数据变化时重建内容
    if (this.isDirty) {
      this.formattedContent = this.formatEntries();
      this.box.setContent(this.formattedContent);
      this.isDirty = false;
    }
    this.box.render(engine);
  }
}
