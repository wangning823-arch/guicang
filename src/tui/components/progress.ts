/**
 * Progress 组件
 * 进度条和状态指示器
 */

import { Colors, colorize, Theme } from '../theme.js';

export interface ProgressOptions {
  width?: number;
  showPercent?: boolean;
  showValue?: boolean;
  color?: string;
  bgColor?: string;
}

export class ProgressBar {
  private value: number;
  private max: number;
  private options: ProgressOptions;

  constructor(value: number, max: number, options: ProgressOptions = {}) {
    this.value = value;
    this.max = max;
    this.options = {
      width: 20,
      showPercent: true,
      color: Theme.primary,
      bgColor: Colors.gray,
      ...options,
    };
  }

  /** 设置值 */
  setValue(value: number): void {
    this.value = Math.max(0, Math.min(this.max, value));
  }

  /** 渲染进度条 */
  render(): string {
    const percent = this.max > 0 ? (this.value / this.max) * 100 : 0;
    const filled = Math.round((this.options.width! * percent) / 100);
    const empty = this.options.width! - filled;

    const filledBar = colorize('#'.repeat(filled), this.options.color!);
    const emptyBar = colorize('.'.repeat(empty), this.options.bgColor!);

    let result = filledBar + emptyBar;

    if (this.options.showPercent) {
      result += ` ${Math.round(percent)}%`;
    }

    if (this.options.showValue) {
      result += ` (${this.value}/${this.max})`;
    }

    return result;
  }
}

export interface StatusIndicatorOptions {
  size?: 'small' | 'medium' | 'large';
}

export class StatusIndicator {
  private status: 'healthy' | 'degraded' | 'unhealthy';
  private label: string;

  constructor(status: 'healthy' | 'degraded' | 'unhealthy', label: string) {
    this.status = status;
    this.label = label;
  }

  /** 渲染状态指示器 */
  render(): string {
    const colors = {
      healthy: Theme.statusHealthy,
      degraded: Theme.statusDegraded,
      unhealthy: Theme.statusUnhealthy,
    };

    const symbols = {
      healthy: '*',
      degraded: 'o',
      unhealthy: '.',
    };

    return colorize(symbols[this.status], colors[this.status]) + ' ' + this.label;
  }
}

export interface SparklineOptions {
  width?: number;
  height?: number;
  color?: string;
}

export class Sparkline {
  private data: number[];
  private options: SparklineOptions;

  constructor(data: number[], options: SparklineOptions = {}) {
    this.data = data;
    this.options = {
      width: 10,
      height: 3,
      color: Theme.primary,
      ...options,
    };
  }

  /** 渲染迷你图 */
  render(): string {
    if (this.data.length === 0) return '';

    const max = Math.max(...this.data);
    const min = Math.min(...this.data);
    const range = max - min || 1;

    const blockChars = ['_', '.', ':', '=', '+', '*', '#', '@'];

    // 只取最后 width 个数据点
    const displayData = this.data.slice(-this.options.width!);

    let result = '';
    for (const value of displayData) {
      const normalized = (value - min) / range;
      const blockIndex = Math.floor(normalized * (blockChars.length - 1));
      result += colorize(blockChars[blockIndex], this.options.color!);
    }

    return result;
  }
}
