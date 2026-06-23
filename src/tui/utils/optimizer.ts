/**
 * 性能优化器
 * 提供各种性能优化工具
 */

/** 对象池 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset?: (obj: T) => void;
  private maxSize: number;

  constructor(factory: () => T, options?: { reset?: (obj: T) => void; maxSize?: number }) {
    this.factory = factory;
    this.reset = options?.reset;
    this.maxSize = options?.maxSize || 100;
  }

  /** 获取对象 */
  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  /** 释放对象 */
  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      if (this.reset) {
        this.reset(obj);
      }
      this.pool.push(obj);
    }
  }

  /** 预分配对象 */
  preAllocate(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.pool.length < this.maxSize) {
        this.pool.push(this.factory());
      }
    }
  }

  /** 获取池大小 */
  getSize(): number {
    return this.pool.length;
  }

  /** 清空池 */
  clear(): void {
    this.pool = [];
  }
}

/** 字符串缓存 */
export class StringCache {
  private cache: Map<string, string> = new Map();
  private maxSize: number;
  private accessOrder: string[] = [];

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  /** 获取缓存的字符串 */
  get(key: string): string | undefined {
    if (this.cache.has(key)) {
      // 更新访问顺序
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      this.accessOrder.push(key);
      return this.cache.get(key);
    }
    return undefined;
  }

  /** 设置缓存 */
  set(key: string, value: string): void {
    // 如果已存在，更新访问顺序
    if (this.cache.has(key)) {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    } else if (this.cache.size >= this.maxSize) {
      // LRU 淘汰
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  /** 检查缓存 */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /** 获取缓存大小 */
  getSize(): number {
    return this.cache.size;
  }

  /** 清空缓存 */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }
}

/** 脏区域追踪器 */
export class DirtyRegionTracker {
  private dirtyRegions: Set<string> = new Set();

  /** 标记区域为脏 */
  markDirty(x: number, y: number, width: number, height: number): void {
    const key = `${x},${y},${width},${height}`;
    this.dirtyRegions.add(key);
  }

  /** 检查区域是否为脏 */
  isDirty(x: number, y: number, width: number, height: number): boolean {
    const key = `${x},${y},${width},${height}`;
    return this.dirtyRegions.has(key);
  }

  /** 清除脏标记 */
  clear(): void {
    this.dirtyRegions.clear();
  }

  /** 获取所有脏区域 */
  getDirtyRegions(): string[] {
    return Array.from(this.dirtyRegions);
  }

  /** 合并重叠的区域 */
  mergeRegions(): void {
    // 简化实现：直接返回
    // 完整实现需要检测和合并重叠的矩形
  }
}

/** 性能计时器 */
export class PerformanceTimer {
  private timers: Map<string, number> = new Map();
  private results: Map<string, number[]> = new Map();

  /** 开始计时 */
  start(name: string): void {
    this.timers.set(name, performance.now());
  }

  /** 结束计时 */
  end(name: string): number {
    const start = this.timers.get(name);
    if (start === undefined) {
      return 0;
    }

    const duration = performance.now() - start;
    this.timers.delete(name);

    // 记录结果
    const results = this.results.get(name) || [];
    results.push(duration);
    if (results.length > 100) {
      results.shift();
    }
    this.results.set(name, results);

    return duration;
  }

  /** 获取平均时间 */
  getAverage(name: string): number {
    const results = this.results.get(name);
    if (!results || results.length === 0) {
      return 0;
    }
    return results.reduce((a, b) => a + b, 0) / results.length;
  }

  /** 获取最小时间 */
  getMin(name: string): number {
    const results = this.results.get(name);
    if (!results || results.length === 0) {
      return 0;
    }
    return Math.min(...results);
  }

  /** 获取最大时间 */
  getMax(name: string): number {
    const results = this.results.get(name);
    if (!results || results.length === 0) {
      return 0;
    }
    return Math.max(...results);
  }

  /** 获取所有结果 */
  getResults(name: string): number[] {
    return this.results.get(name) || [];
  }

  /** 清除结果 */
  clearResults(name?: string): void {
    if (name) {
      this.results.delete(name);
    } else {
      this.results.clear();
    }
  }
}

/** 帧率监控器 */
export class FrameRateMonitor {
  private frames: number[] = [];
  private lastTime: number = 0;
  private fps: number = 0;

  /** 记录帧 */
  recordFrame(): void {
    const now = performance.now();
    if (this.lastTime > 0) {
      this.frames.push(now - this.lastTime);
      // 保留最近 60 帧
      if (this.frames.length > 60) {
        this.frames.shift();
      }
    }
    this.lastTime = now;
    this.calculateFPS();
  }

  /** 计算 FPS */
  private calculateFPS(): void {
    if (this.frames.length === 0) {
      this.fps = 0;
      return;
    }

    const avgFrameTime = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    this.fps = 1000 / avgFrameTime;
  }

  /** 获取当前 FPS */
  getFPS(): number {
    return Math.round(this.fps);
  }

  /** 获取平均帧时间 */
  getAverageFrameTime(): number {
    if (this.frames.length === 0) {
      return 0;
    }
    return this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
  }

  /** 重置 */
  reset(): void {
    this.frames = [];
    this.lastTime = 0;
    this.fps = 0;
  }
}

/** 内存使用监控器 */
export class MemoryMonitor {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private samples: Array<{ timestamp: number; heapUsed: number; heapTotal: number }> = [];
  private maxSamples: number = 60;

  /** 开始监控 */
  start(intervalMs: number = 1000): void {
    this.stop();
    this.intervalId = setInterval(() => {
      this.sample();
    }, intervalMs);
  }

  /** 停止监控 */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** 采样 */
  sample(): void {
    const mem = process.memoryUsage();
    this.samples.push({
      timestamp: Date.now(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    });

    // 限制样本数量
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  /** 获取当前内存使用 */
  getCurrent(): { heapUsed: number; heapTotal: number; external: number } {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
    };
  }

  /** 获取平均内存使用 */
  getAverage(): { heapUsed: number; heapTotal: number } {
    if (this.samples.length === 0) {
      return this.getCurrent();
    }

    const avgHeapUsed = this.samples.reduce((sum, s) => sum + s.heapUsed, 0) / this.samples.length;
    const avgHeapTotal = this.samples.reduce((sum, s) => sum + s.heapTotal, 0) / this.samples.length;

    return { heapUsed: avgHeapUsed, heapTotal: avgHeapTotal };
  }

  /** 获取内存历史 */
  getHistory(): Array<{ timestamp: number; heapUsed: number; heapTotal: number }> {
    return [...this.samples];
  }

  /** 格式化内存大小 */
  static formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
