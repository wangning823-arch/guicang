/**
 * 内存监控
 * 追踪内存使用情况
 */

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

export class MemoryMonitor {
  private snapshots: MemorySnapshot[] = [];
  private interval: ReturnType<typeof setInterval> | null = null;

  /** 获取当前内存快照 */
  snapshot(): MemorySnapshot {
    const mem = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
    };
    this.snapshots.push(snapshot);
    return snapshot;
  }

  /** 开始定期监控 */
  start(intervalMs: number = 1000): void {
    this.stop();
    this.interval = setInterval(() => this.snapshot(), intervalMs);
  }

  /** 停止监控 */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /** 获取所有快照 */
  getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  /** 获取内存增长趋势 */
  getGrowthRate(): number {
    if (this.snapshots.length < 2) return 0;

    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];
    const timeDiff = (last.timestamp - first.timestamp) / 1000; // 秒

    if (timeDiff === 0) return 0;

    return (last.heapUsed - first.heapUsed) / timeDiff; // bytes/sec
  }

  /** 格式化内存大小 */
  static formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }

  /** 生成报告 */
  report(): string {
    if (this.snapshots.length === 0) return 'No memory snapshots recorded';

    const latest = this.snapshots[this.snapshots.length - 1];
    const lines = [
      'Memory Report:',
      '==============',
      `Heap Used: ${MemoryMonitor.formatBytes(latest.heapUsed)}`,
      `Heap Total: ${MemoryMonitor.formatBytes(latest.heapTotal)}`,
      `External: ${MemoryMonitor.formatBytes(latest.external)}`,
      `RSS: ${MemoryMonitor.formatBytes(latest.rss)}`,
      `Growth Rate: ${MemoryMonitor.formatBytes(this.getGrowthRate())}/s`,
      `Snapshots: ${this.snapshots.length}`,
    ];

    return lines.join('\n');
  }

  /** 清空快照 */
  clear(): void {
    this.snapshots = [];
  }
}

/** 全局内存监控 */
export const memoryMonitor = new MemoryMonitor();
