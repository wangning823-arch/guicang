/**
 * 性能计时器
 * 用于测量代码执行时间
 */

export interface TimingResult {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
}

export class Timer {
  private timings: Map<string, { start: number }> = new Map();
  private results: TimingResult[] = [];

  /** 开始计时 */
  start(name: string): void {
    this.timings.set(name, { start: performance.now() });
  }

  /** 结束计时 */
  stop(name: string): TimingResult {
    const timing = this.timings.get(name);
    if (!timing) {
      throw new Error(`Timer "${name}" was not started`);
    }

    const endTime = performance.now();
    const result: TimingResult = {
      name,
      duration: endTime - timing.start,
      startTime: timing.start,
      endTime,
    };

    this.results.push(result);
    this.timings.delete(name);
    return result;
  }

  /** 获取所有结果 */
  getResults(): TimingResult[] {
    return [...this.results];
  }

  /** 清空结果 */
  clear(): void {
    this.timings.clear();
    this.results = [];
  }

  /** 生成报告 */
  report(): string {
    if (this.results.length === 0) return 'No timings recorded';

    const lines = ['Performance Report:', '=================='];

    for (const r of this.results) {
      lines.push(`${r.name}: ${r.duration.toFixed(2)}ms`);
    }

    const total = this.results.reduce((sum, r) => sum + r.duration, 0);
    lines.push(`------------------`);
    lines.push(`Total: ${total.toFixed(2)}ms`);

    return lines.join('\n');
  }
}

/** 全局计时器 */
export const timer = new Timer();

/** 异步函数计时装饰器 */
export function timed<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  name?: string,
): T {
  const timerName = name ?? fn.name;

  return ((...args: unknown[]) => {
    timer.start(timerName);
    return fn(...args).finally(() => timer.stop(timerName));
  }) as T;
}
