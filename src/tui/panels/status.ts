/**
 * 状态面板
 * 显示系统状态和健康信息
 */

import type { TUIEngine } from '../engine.js';
import { Box as BoxComponent } from '../components/box.js';
import { StatusIndicator, ProgressBar } from '../components/progress.js';
import { colorize, Theme } from '../theme.js';

export interface StatusPanelData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: {
    used: number;
    total: number;
    heap: number;
    heapTotal: number;
  };
  cpu: number;
  agents: {
    total: number;
    online: number;
    busy: number;
  };
}

export class StatusPanel {
  private box: BoxComponent;
  private data: StatusPanelData = {
    status: 'healthy',
    uptime: 0,
    memory: { used: 0, total: 0, heap: 0, heapTotal: 0 },
    cpu: 0,
    agents: { total: 0, online: 0, busy: 0 },
  };

  constructor(x: number, y: number, width: number, height: number, accentColor?: string) {
    this.box = new BoxComponent(
      { x, y, width, height },
      { title: '📊 系统状态', border: true, accentColor },
    );
  }

  /** 更新数据 */
  updateData(data: Partial<StatusPanelData>): void {
    this.data = { ...this.data, ...data };
  }

  /** 格式化运行时间 */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m ${seconds % 60}s`;
  }

  /** 格式化内存大小 */
  private formatMemory(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)}GB`;
    }
    return `${Math.round(mb)}MB`;
  }

  /** 清空数据 */
  clear(): void {
    this.data = {
      status: 'healthy',
      uptime: 0,
      memory: { used: 0, total: 0, heap: 0, heapTotal: 0 },
      cpu: 0,
      agents: { total: 0, online: 0, busy: 0 },
    };
  }

  /** 渲染 */
  render(engine: TUIEngine): void {
    this.box.setContent([]);

    // 系统状态
    const statusIndicator = new StatusIndicator(this.data.status, this.getStatusText());
    this.box.appendLine(`状态: ${statusIndicator.render()}`);

    // 运行时间
    this.box.appendLine(`运行: ${colorize(this.formatUptime(this.data.uptime), Theme.textBright)}`);

    // 内存使用
    const memPercent = this.data.memory.total > 0
      ? Math.round((this.data.memory.used / this.data.memory.total) * 100)
      : 0;
    const memColor = memPercent > 80 ? Theme.error : memPercent > 60 ? Theme.warning : Theme.success;
    this.box.appendLine('');
    this.box.appendLine(colorize('内存:', Theme.textMuted));
    const memProgress = new ProgressBar(this.data.memory.used, this.data.memory.total, {
      width: 15,
      color: memColor,
    });
    this.box.appendLine(`  ${memProgress.render()}`);
    this.box.appendLine(`  ${this.formatMemory(this.data.memory.used)} / ${this.formatMemory(this.data.memory.total)}`);

    // CPU 使用
    this.box.appendLine('');
    this.box.appendLine(colorize('CPU:', Theme.textMuted));
    const cpuColor = this.data.cpu > 80 ? Theme.error : this.data.cpu > 60 ? Theme.warning : Theme.success;
    const cpuProgress = new ProgressBar(this.data.cpu, 100, {
      width: 15,
      color: cpuColor,
    });
    this.box.appendLine(`  ${cpuProgress.render()}`);

    // Agent 状态
    this.box.appendLine('');
    this.box.appendLine(colorize('Agents:', Theme.textMuted));
    this.box.appendLine(`  总计: ${this.data.agents.total}  在线: ${colorize(String(this.data.agents.online), Theme.success)}  忙碌: ${colorize(String(this.data.agents.busy), Theme.warning)}`);

    this.box.render(engine);
  }

  /** 获取状态文本 */
  private getStatusText(): string {
    switch (this.data.status) {
      case 'healthy':
        return '健康';
      case 'degraded':
        return '降级';
      case 'unhealthy':
        return '不健康';
    }
  }
}
