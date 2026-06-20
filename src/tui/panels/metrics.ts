/**
 * 指标面板
 * 显示性能指标和统计信息
 */

import type { TUIEngine } from '../engine.js';
import { Box as BoxComponent } from '../components/box.js';
import { Sparkline } from '../components/progress.js';
import { colorize, Theme } from '../theme.js';

export interface MetricsPanelData {
  requests: {
    total: number;
    success: number;
    failed: number;
  };
  latency: {
    avg: number;
    min: number;
    max: number;
    history: number[];
  };
  tokens: {
    total: number;
    prompt: number;
    completion: number;
  };
  tools: {
    total: number;
    success: number;
    failed: number;
  };
}

export class MetricsPanel {
  private box: BoxComponent;
  private data: MetricsPanelData = {
    requests: { total: 0, success: 0, failed: 0 },
    latency: { avg: 0, min: 0, max: 0, history: [] },
    tokens: { total: 0, prompt: 0, completion: 0 },
    tools: { total: 0, success: 0, failed: 0 },
  };

  constructor(x: number, y: number, width: number, height: number) {
    this.box = new BoxComponent(
      { x, y, width, height },
      { title: '📈 性能指标', border: true },
    );
  }

  /** 更新数据 */
  updateData(data: Partial<MetricsPanelData>): void {
    this.data = { ...this.data, ...data };
  }

  /** 记录请求 */
  recordRequest(success: boolean): void {
    this.data.requests.total++;
    if (success) {
      this.data.requests.success++;
    } else {
      this.data.requests.failed++;
    }
  }

  /** 记录延迟 */
  recordLatency(ms: number): void {
    this.data.latency.history.push(ms);
    if (this.data.latency.history.length > 50) {
      this.data.latency.history.shift();
    }

    this.data.latency.avg = this.data.latency.history.reduce((a, b) => a + b, 0) / this.data.latency.history.length;
    this.data.latency.min = Math.min(...this.data.latency.history);
    this.data.latency.max = Math.max(...this.data.latency.history);
  }

  /** 记录 Token 使用 */
  recordTokens(prompt: number, completion: number): void {
    this.data.tokens.prompt += prompt;
    this.data.tokens.completion += completion;
    this.data.tokens.total += prompt + completion;
  }

  /** 记录工具调用 */
  recordTool(success: boolean): void {
    this.data.tools.total++;
    if (success) {
      this.data.tools.success++;
    } else {
      this.data.tools.failed++;
    }
  }

  /** 清空数据 */
  clear(): void {
    this.data = {
      requests: { total: 0, success: 0, failed: 0 },
      latency: { avg: 0, min: 0, max: 0, history: [] },
      tokens: { total: 0, prompt: 0, completion: 0 },
      tools: { total: 0, success: 0, failed: 0 },
    };
  }

  /** 渲染 */
  render(engine: TUIEngine): void {
    this.box.setContent([]);

    // 请求数统计
    this.box.appendLine(colorize('请求数:', Theme.textMuted));
    this.box.appendLine(`  成功: ${colorize(String(this.data.requests.success), Theme.success)}  失败: ${colorize(String(this.data.requests.failed), Theme.error)}  总计: ${this.data.requests.total}`);

    // 延迟统计
    this.box.appendLine('');
    this.box.appendLine(colorize('延迟:', Theme.textMuted));
    this.box.appendLine(`  平均: ${Math.round(this.data.latency.avg)}ms  最小: ${this.data.latency.min}ms  最大: ${this.data.latency.max}ms`);

    // 延迟趋势图
    if (this.data.latency.history.length > 0) {
      const sparkline = new Sparkline(this.data.latency.history, { width: 15, color: Theme.primary });
      this.box.appendLine(`  趋势: ${sparkline.render()}`);
    }

    // Token 使用
    this.box.appendLine('');
    this.box.appendLine(colorize('Token 使用:', Theme.textMuted));
    this.box.appendLine(`  Prompt: ${formatNumber(this.data.tokens.prompt)}  Completion: ${formatNumber(this.data.tokens.completion)}`);
    this.box.appendLine(`  总计: ${formatNumber(this.data.tokens.total)}`);

    // 工具调用统计
    this.box.appendLine('');
    this.box.appendLine(colorize('工具调用:', Theme.textMuted));
    const toolSuccessRate = this.data.tools.total > 0
      ? Math.round((this.data.tools.success / this.data.tools.total) * 100)
      : 100;
    this.box.appendLine(`  成功: ${colorize(String(this.data.tools.success), Theme.success)}  失败: ${colorize(String(this.data.tools.failed), Theme.error)}  成功率: ${toolSuccessRate}%`);

    this.box.render(engine);
  }
}

/** 格式化大数字 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return String(num);
}
