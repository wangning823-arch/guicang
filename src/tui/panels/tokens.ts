/**
 * Token 面板
 * 显示 Token 使用统计和成本估算
 */

import type { TUIEngine } from '../engine.js';
import { Box as BoxComponent } from '../components/box.js';
import { ProgressBar, Sparkline } from '../components/progress.js';
import { colorize, Theme } from '../theme.js';

export interface TokenUsageData {
  prompt: number;
  completion: number;
  total: number;
  history: Array<{ prompt: number; completion: number; timestamp: number }>;
  cost: {
    promptRate: number;   // 每 1M tokens 成本
    completionRate: number;
    totalCost: number;
  };
  context: {
    current: number;      // 当前上下文大小
    max: number;          // 最大上下文窗口
    messages: number;     // 当前消息数
  };
}

export interface TokensPanelOptions {
  model?: string;
  maxHistory?: number;
}

export class TokensPanel {
  private box: BoxComponent;
  private data: TokenUsageData = {
    prompt: 0,
    completion: 0,
    total: 0,
    history: [],
    cost: { promptRate: 0.003, completionRate: 0.015, totalCost: 0 },
    context: { current: 0, max: 128000, messages: 0 },
  };
  private options: TokensPanelOptions;
  private isActive = false;

  constructor(x: number, y: number, width: number, height: number, options: TokensPanelOptions = {}, accentColor?: string) {
    this.box = new BoxComponent(
      { x, y, width, height },
      { title: '[TKN] Token 统计', border: true, accentColor },
    );
    this.options = {
      maxHistory: 50,
      ...options,
    };
  }

  /** 设置激活状态 */
  setActive(active: boolean): void {
    this.isActive = active;
    if (active) {
      this.box.options.accentColor = Theme.borderFocused;
    } else {
      this.box.options.accentColor = Theme.tokensPanel;
    }
  }

  /** 记录 Token 使用 */
  recordUsage(prompt: number, completion: number): void {
    this.data.prompt += prompt;
    this.data.completion += completion;
    this.data.total = this.data.prompt + this.data.completion;

    // 记录历史
    this.data.history.push({
      prompt,
      completion,
      timestamp: Date.now(),
    });

    // 限制历史长度
    if (this.data.history.length > this.options.maxHistory!) {
      this.data.history.shift();
    }

    // 计算成本
    this.data.cost.totalCost =
      (this.data.prompt / 1_000_000) * this.data.cost.promptRate +
      (this.data.completion / 1_000_000) * this.data.cost.completionRate;
  }

  /** 更新上下文信息 */
  updateContext(context: Partial<TokenUsageData['context']>): void {
    this.data.context = { ...this.data.context, ...context };
  }

  /** 更新成本费率 */
  updateCostRates(promptRate: number, completionRate: number): void {
    this.data.cost.promptRate = promptRate;
    this.data.cost.completionRate = completionRate;
  }

  /** 清空数据 */
  clear(): void {
    this.data = {
      prompt: 0,
      completion: 0,
      total: 0,
      history: [],
      cost: { promptRate: this.data.cost.promptRate, completionRate: this.data.cost.completionRate, totalCost: 0 },
      context: { current: 0, max: this.data.context.max, messages: 0 },
    };
  }

  /** 格式化数字 */
  private formatNumber(num: number): string {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    }
    if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}k`;
    }
    return String(num);
  }

  /** 格式化成本 */
  private formatCost(cost: number): string {
    if (cost >= 1) {
      return `$${cost.toFixed(2)}`;
    }
    if (cost >= 0.01) {
      return `$${cost.toFixed(3)}`;
    }
    return `$${cost.toFixed(4)}`;
  }

  /** 渲染 */
  render(engine: TUIEngine): void {
    this.box.setContent([]);

    // Token 使用总量
    this.box.appendLine(colorize('Token 总量:', Theme.textMuted));
    this.box.appendLine(`  Prompt:     ${colorize(this.formatNumber(this.data.prompt), Theme.primary)}`);
    this.box.appendLine(`  Completion: ${colorize(this.formatNumber(this.data.completion), Theme.secondary)}`);
    this.box.appendLine(`  总计:       ${colorize(this.formatNumber(this.data.total), Theme.textBright)}`);

    // 上下文使用
    this.box.appendLine('');
    this.box.appendLine(colorize('上下文:', Theme.textMuted));
    const contextPercent = this.data.context.max > 0
      ? Math.round((this.data.context.current / this.data.context.max) * 100)
      : 0;
    const contextColor = contextPercent > 80 ? Theme.error : contextPercent > 60 ? Theme.warning : Theme.success;
    const contextProgress = new ProgressBar(this.data.context.current, this.data.context.max, {
      width: 12,
      color: contextColor,
    });
    this.box.appendLine(`  ${contextProgress.render()}`);
    this.box.appendLine(`  ${this.formatNumber(this.data.context.current)} / ${this.formatNumber(this.data.context.max)}`);
    this.box.appendLine(`  消息数: ${this.data.context.messages}`);

    // 使用趋势
    if (this.data.history.length > 1) {
      this.box.appendLine('');
      this.box.appendLine(colorize('趋势:', Theme.textMuted));
      const totalTokens = this.data.history.map((h) => h.prompt + h.completion);
      const sparkline = new Sparkline(totalTokens, { width: 12, color: Theme.primary });
      this.box.appendLine(`  ${sparkline.render()}`);
    }

    // 模型信息
    if (this.options.model) {
      this.box.appendLine('');
      this.box.appendLine(colorize('模型:', Theme.textMuted));
      this.box.appendLine(`  ${this.options.model}`);
    }

    this.box.render(engine);
  }
}
