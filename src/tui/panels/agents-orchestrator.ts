/**
 * Agent 编排面板
 * 显示和管理多 Agent 并行任务
 */

import { TUIEngine, type KeyEvent, type Rect } from '../engine.js';
import { Colors, Theme, colorize, dim, bold } from '../theme.js';
import { Box } from '../components/box.js';
import { getStringWidth, truncateString } from '../utils.js';

/** Agent 状态 */
export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'waiting';

/** 编排任务 */
export interface OrchestratorTask {
  id: string;
  name: string;
  agentName: string;
  status: AgentStatus;
  progress?: number;
  result?: string;
  startTime?: Date;
  endTime?: Date;
  dependencies?: string[];
}

/** 编排面板选项 */
export interface OrchestratorPanelOptions {
  rect: Rect;
}

/** Agent 编排面板 */
export class OrchestratorPanel {
  private engine: TUIEngine;
  private box: Box;
  private tasks: OrchestratorTask[] = [];
  private selectedIndex: number = 0;
  private viewMode: 'list' | 'graph' | 'timeline' = 'list';

  constructor(engine: TUIEngine, options: OrchestratorPanelOptions) {
    this.engine = engine;
    this.box = new Box({
      title: '🤖 Agent 编排',
      rect: options.rect,
      accentColor: Colors.brightYellow,
    });
  }

  /** 设置任务列表 */
  setTasks(tasks: OrchestratorTask[]): void {
    this.tasks = tasks;
  }

  /** 添加任务 */
  addTask(task: OrchestratorTask): void {
    this.tasks.push(task);
  }

  /** 更新任务状态 */
  updateTask(id: string, updates: Partial<OrchestratorTask>): void {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      Object.assign(task, updates);
    }
  }

  /** 切换视图模式 */
  switchView(mode: 'list' | 'graph' | 'timeline'): void {
    this.viewMode = mode;
  }

  /** 渲染面板 */
  render(): void {
    const { rect } = this.box.getRect() as { rect: Rect };
    const contentHeight = rect.height - 2;
    const contentWidth = rect.width - 2;

    const lines: string[] = [];

    // 视图模式指示器
    const modeIndicator = `[${this.viewMode.toUpperCase()}]`;
    lines.push(dim(` 视图: ${modeIndicator} (Tab 切换)`));

    if (this.tasks.length === 0) {
      lines.push(dim('  暂无运行中的任务'));
    } else {
      switch (this.viewMode) {
        case 'list':
          lines.push(...this.renderList(contentWidth));
          break;
        case 'graph':
          lines.push(...this.renderGraph(contentWidth));
          break;
        case 'timeline':
          lines.push(...this.renderTimeline(contentWidth));
          break;
      }
    }

    // 填充剩余空间
    while (lines.length < contentHeight) {
      lines.push('');
    }

    this.box.setContent(lines.slice(0, contentHeight));
    this.box.render();
  }

  /** 渲染列表视图 */
  private renderList(width: number): string[] {
    const lines: string[] = [];

    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.tasks[i];
      const isSelected = i === this.selectedIndex;
      const statusIcon = this.getStatusIcon(task.status);
      const name = truncateString(task.name, width - 25);
      const agent = truncateString(task.agentName, 10);

      let line = '';
      if (isSelected) {
        line = colorize(` ▸ ${statusIcon} ${name}`, Colors.brightWhite);
        line += colorize(` [${agent}]`, Colors.brightCyan);
      } else {
        line = `   ${statusIcon} ${colorize(name, Colors.white)}`;
        line += dim(` [${agent}]`);
      }

      // 进度条
      if (task.progress !== undefined && task.status === 'running') {
        const progressWidth = 10;
        const filled = Math.floor((task.progress / 100) * progressWidth);
        const empty = progressWidth - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        line += ` ${colorize(bar, Colors.brightGreen)} ${task.progress}%`;
      }

      // 持续时间
      if (task.startTime) {
        const duration = task.endTime
          ? task.endTime.getTime() - task.startTime.getTime()
          : Date.now() - task.startTime.getTime();
        line += dim(` ${this.formatDuration(duration)}`);
      }

      lines.push(line);
    }

    return lines;
  }

  /** 渲染图形视图 */
  private renderGraph(width: number): string[] {
    const lines: string[] = [];

    // 统计
    const running = this.tasks.filter(t => t.status === 'running').length;
    const completed = this.tasks.filter(t => t.status === 'completed').length;
    const failed = this.tasks.filter(t => t.status === 'failed').length;

    lines.push(` ${colorize('运行中:', Colors.brightCyan)} ${running}  ${colorize('完成:', Colors.brightGreen)} ${completed}  ${colorize('失败:', Colors.brightRed)} ${failed}`);
    lines.push('');

    // ASCII 拓扑图
    for (const task of this.tasks) {
      const statusIcon = this.getStatusIcon(task.status);
      const name = truncateString(task.name, width - 15);
      lines.push(` ${statusIcon} ${name}`);
    }

    return lines;
  }

  /** 渲染时间线视图 */
  private renderTimeline(width: number): string[] {
    const lines: string[] = [];

    for (const task of this.tasks) {
      const statusIcon = this.getStatusIcon(task.status);
      const name = truncateString(task.name, width - 30);

      const startTime = task.startTime?.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) || '--:--';
      const endTime = task.endTime?.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) || '--:--';

      lines.push(` ${colorize(startTime, Colors.brightBlack)} ${statusIcon} ${name} ${dim(endTime)}`);
    }

    return lines;
  }

  /** 获取状态图标 */
  private getStatusIcon(status: AgentStatus): string {
    switch (status) {
      case 'idle': return colorize('○', Colors.brightBlack);
      case 'running': return colorize('●', Colors.brightCyan);
      case 'completed': return colorize('✓', Colors.brightGreen);
      case 'failed': return colorize('✗', Colors.brightRed);
      case 'waiting': return colorize('◎', Colors.brightYellow);
      default: return '?';
    }
  }

  /** 格式化持续时间 */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  /** 处理按键 */
  handleKey(event: KeyEvent): boolean {
    if (event.name === 'up') {
      this.selectPrev();
      return true;
    }
    if (event.name === 'down') {
      this.selectNext();
      return true;
    }
    if (event.name === 'tab') {
      this.cycleViewMode();
      return true;
    }
    return false;
  }

  /** 选择上一个 */
  selectPrev(): void {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
    }
  }

  /** 选择下一个 */
  selectNext(): void {
    if (this.selectedIndex < this.tasks.length - 1) {
      this.selectedIndex++;
    }
  }

  /** 循环切换视图模式 */
  private cycleViewMode(): void {
    const modes: Array<'list' | 'graph' | 'timeline'> = ['list', 'graph', 'timeline'];
    const currentIndex = modes.indexOf(this.viewMode);
    this.viewMode = modes[(currentIndex + 1) % modes.length];
  }

  /** 获取选中的任务 */
  getSelectedTask(): OrchestratorTask | null {
    if (this.tasks.length > 0 && this.selectedIndex < this.tasks.length) {
      return this.tasks[this.selectedIndex];
    }
    return null;
  }

  /** 获取任务统计 */
  getStats(): { total: number; running: number; completed: number; failed: number } {
    return {
      total: this.tasks.length,
      running: this.tasks.filter(t => t.status === 'running').length,
      completed: this.tasks.filter(t => t.status === 'completed').length,
      failed: this.tasks.filter(t => t.status === 'failed').length,
    };
  }
}
