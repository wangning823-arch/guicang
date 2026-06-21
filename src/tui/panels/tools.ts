/**
 * 工具面板
 * 显示最近的工具调用记录
 */

import type { TUIEngine } from '../engine.js';
import { Box as BoxComponent } from '../components/box.js';
import { colorize, Theme } from '../theme.js';

export interface ToolCallEntry {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  success: boolean;
  duration: number;
  timestamp: Date;
}

export interface ToolsPanelOptions {
  maxEntries?: number;
}

export class ToolsPanel {
  private box: BoxComponent;
  private entries: ToolCallEntry[] = [];
  private maxEntries: number;
  private isDirty = true;
  private formattedContent: string[] = [];
  private isActive = false;

  constructor(x: number, y: number, width: number, height: number, options: ToolsPanelOptions = {}, accentColor?: string) {
    this.box = new BoxComponent(
      { x, y, width, height },
      { title: '[TOOL] 最近工具', border: true, accentColor },
    );
    this.maxEntries = options.maxEntries ?? 20;
  }

  /** 设置激活状态 */
  setActive(active: boolean): void {
    this.isActive = active;
    if (active) {
      this.box.options.accentColor = Theme.borderFocused;
    } else {
      this.box.options.accentColor = Theme.warning;
    }
  }

  /** 添加工具调用记录 */
  addEntry(entry: ToolCallEntry): void {
    this.entries.push(entry);

    // 限制条目数量
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // 标记需要更新
    this.isDirty = true;
  }

  /** 清空记录 */
  clear(): void {
    this.entries = [];
    this.formattedContent = [];
    this.box.setContent([]);
    this.isDirty = true;
  }

  /** 获取最近的工具调用 */
  getRecent(count: number): ToolCallEntry[] {
    return this.entries.slice(-count);
  }

  /** 获取统计信息 */
  getStats(): {
    total: number;
    success: number;
    failed: number;
    avgDuration: number;
  } {
    const total = this.entries.length;
    const success = this.entries.filter((e) => e.success).length;
    const failed = total - success;
    const avgDuration = total > 0
      ? this.entries.reduce((sum, e) => sum + e.duration, 0) / total
      : 0;

    return { total, success, failed, avgDuration };
  }

  /** 格式化内容 */
  private formatContent(): string[] {
    const content: string[] = [];
    for (const entry of this.entries) {
      const statusIcon = entry.success ? colorize('[OK]', Theme.success) : colorize('[FAIL]', Theme.error);
      const duration = entry.duration < 1000
        ? `${entry.duration}ms`
        : `${(entry.duration / 1000).toFixed(1)}s`;
      const toolLine = `${statusIcon} ${colorize(entry.name, Theme.primary)} ${colorize(duration, Theme.textMuted)}`;
      content.push(toolLine);
    }
    return content;
  }

  /** 渲染 */
  render(engine: TUIEngine): void {
    // 仅在数据变化时重建内容
    if (this.isDirty) {
      this.formattedContent = this.formatContent();
      this.box.setContent(this.formattedContent);
      this.isDirty = false;
    }
    this.box.render(engine);
  }
}
