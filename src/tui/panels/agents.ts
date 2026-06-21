/**
 * Agents 面板
 * 显示运行中的 Agent 列表和状态
 */

import type { TUIEngine } from '../engine.js';
import { Box as BoxComponent } from '../components/box.js';
import { StatusIndicator } from '../components/progress.js';
import { colorize, Theme } from '../theme.js';

export interface AgentInfo {
  id: string;
  name: string;
  status: 'idle' | 'thinking' | 'acting' | 'observing' | 'error';
  currentTask?: string;
  completedTasks: number;
  lastActive: Date;
}

export class AgentsPanel {
  private box: BoxComponent;
  private agents: AgentInfo[] = [];
  private selected = 0;
  private isDirty = true;
  private formattedContent: string[] = [];
  private isActive = false;

  constructor(x: number, y: number, width: number, height: number, accentColor?: string) {
    this.box = new BoxComponent(
      { x, y, width, height },
      { title: '[AGT] Agent 列表', border: true, accentColor },
    );
  }

  /** 设置激活状态 */
  setActive(active: boolean): void {
    this.isActive = active;
    if (active) {
      this.box.options.accentColor = Theme.borderFocused;
    } else {
      this.box.options.accentColor = Theme.success;
    }
  }

  /** 更新 Agent 列表 */
  updateAgents(agents: AgentInfo[]): void {
    this.agents = agents;
    this.isDirty = true;
  }

  /** 选择上一个 */
  selectPrev(): void {
    if (this.selected > 0) {
      this.selected--;
      this.isDirty = true;
    }
  }

  /** 选择下一个 */
  selectNext(): void {
    if (this.selected < this.agents.length - 1) {
      this.selected++;
      this.isDirty = true;
    }
  }

  /** 获取选中的 Agent */
  getSelected(): AgentInfo | undefined {
    return this.agents[this.selected];
  }

  /** 清空 */
  clear(): void {
    this.agents = [];
    this.selected = 0;
    this.formattedContent = [];
    this.isDirty = true;
  }

  /** 格式化运行时间 */
  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  /** 获取状态显示文本 */
  private getStatusText(status: string): string {
    switch (status) {
      case 'idle': return '空闲';
      case 'thinking': return '思考中';
      case 'acting': return '执行中';
      case 'observing': return '观察中';
      case 'error': return '错误';
      default: return status;
    }
  }

  /** 格式化内容 */
  private formatContent(): string[] {
    const content: string[] = [];

    if (this.agents.length === 0) {
      content.push(colorize('  暂无运行中的 Agent', Theme.textMuted));
      content.push('');
      content.push(colorize('  使用 /agent spawn 创建新 Agent', Theme.textDim));
    } else {
      for (let i = 0; i < this.agents.length; i++) {
        const agent = this.agents[i];
        const isSelected = i === this.selected;

        // 状态指示器
        const healthStatus = agent.status === 'error' ? 'unhealthy'
          : agent.status === 'idle' ? 'healthy'
          : 'degraded';
        const indicator = new StatusIndicator(healthStatus, '');

        // Agent 信息
        const name = isSelected
          ? colorize(`> ${agent.name}`, Theme.accent)
          : `  ${agent.name}`;

        const statusText = colorize(
          this.getStatusText(agent.status),
          agent.status === 'error' ? Theme.error
            : agent.status === 'idle' ? Theme.success
            : Theme.warning,
        );

        content.push(`${indicator.render()} ${name} [${statusText}]`);

        // 详细信息（缩进显示）
        if (agent.currentTask) {
          content.push(`    任务: ${colorize(agent.currentTask, Theme.textMuted)}`);
        }
        content.push(`    完成: ${agent.completedTasks}  最后活跃: ${this.formatTimeAgo(agent.lastActive)}`);

        // 分隔线
        if (i < this.agents.length - 1) {
          content.push(colorize('  ─────────────────────────', Theme.textDim));
        }
      }
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
