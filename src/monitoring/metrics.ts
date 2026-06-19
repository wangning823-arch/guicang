/**
 * 指标收集器
 * 收集和聚合系统指标
 */

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export class MetricsCollector {
  private metrics = new Map<string, MetricValue[]>();
  private counters = new Map<string, number>();

  /** 记录计数器 */
  counter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + value);
    this.record(name, current + value, labels);
  }

  /** 记录仪表盘 */
  gauge(name: string, value: number, labels?: Record<string, string>): void {
    this.record(name, value, labels);
  }

  /** 记录直方图 */
  histogram(name: string, value: number, labels?: Record<string, string>): void {
    this.record(name, value, labels);
  }

  /** 获取计数器值 */
  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.getKey(name, labels);
    return this.counters.get(key) ?? 0;
  }

  /** 获取指标历史 */
  getHistory(name: string, limit: number = 100): MetricValue[] {
    return (this.metrics.get(name) ?? []).slice(-limit);
  }

  /** 获取指标摘要 */
  getSummary(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    latest: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;

    const nums = values.map((v) => v.value);
    return {
      count: nums.length,
      min: Math.min(...nums),
      max: Math.max(...nums),
      avg: nums.reduce((a, b) => a + b, 0) / nums.length,
      latest: nums[nums.length - 1],
    };
  }

  /** 清空指标 */
  clear(): void {
    this.metrics.clear();
    this.counters.clear();
  }

  /** 获取所有指标名称 */
  getMetricNames(): string[] {
    return [...this.metrics.keys()];
  }

  private record(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push({
      value,
      timestamp: Date.now(),
      labels,
    });

    // 限制历史长度
    const history = this.metrics.get(name)!;
    if (history.length > 10000) {
      history.splice(0, history.length - 10000);
    }
  }

  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }
}

/** 全局指标收集器 */
export const metrics = new MetricsCollector();
