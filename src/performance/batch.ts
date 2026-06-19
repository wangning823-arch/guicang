/**
 * 批处理系统
 * 批量工具执行和请求合并
 */

import { Logger } from '../core/logger.js';

const logger = new Logger('performance:batch');

/** 批处理选项 */
export interface BatchOptions {
  /** 最大批大小 */
  maxBatchSize?: number;
  /** 等待时间（毫秒） */
  waitTime?: number;
  /** 是否启用 */
  enabled?: boolean;
}

/** 批处理项 */
interface BatchItem<TInput, TOutput> {
  input: TInput;
  resolve: (output: TOutput) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/** 批处理结果 */
export interface BatchResult<TOutput> {
  outputs: TOutput[];
  duration: number;
  batchSize: number;
}

/**
 * 批处理器
 */
export class BatchProcessor<TInput, TOutput> {
  private queue: BatchItem<TInput, TOutput>[] = [];
  private processor: (inputs: TInput[]) => Promise<TOutput[]>;
  private options: Required<BatchOptions>;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    processor: (inputs: TInput[]) => Promise<TOutput[]>,
    options: BatchOptions = {},
  ) {
    this.processor = processor;
    this.options = {
      maxBatchSize: options.maxBatchSize ?? 10,
      waitTime: options.waitTime ?? 100,
      enabled: options.enabled ?? true,
    };
  }

  /**
   * 添加到批处理队列
   */
  add(input: TInput): Promise<TOutput> {
    return new Promise((resolve, reject) => {
      if (!this.options.enabled) {
        // 直接执行
        this.processor([input])
          .then((outputs) => resolve(outputs[0]))
          .catch(reject);
        return;
      }

      this.queue.push({
        input,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      // 启动定时器
      if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.options.waitTime);
      }

      // 检查是否达到最大批量
      if (this.queue.length >= this.options.maxBatchSize) {
        this.flush();
      }
    });
  }

  /**
   * 刷新队列
   */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.options.maxBatchSize);
    const inputs = batch.map((item) => item.input);

    const startTime = Date.now();

    try {
      const outputs = await this.processor(inputs);
      const duration = Date.now() - startTime;

      logger.debug(`Batch executed: ${batch.length} items in ${duration}ms`);

      // 分发结果
      for (let i = 0; i < batch.length; i++) {
        batch[i].resolve(outputs[i]);
      }
    } catch (error) {
      logger.error('Batch execution failed', error);

      // 拒绝所有
      for (const item of batch) {
        item.reject(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }
  }

  /**
   * 获取队列大小
   */
  get queueSize(): number {
    return this.queue.length;
  }

  /**
   * 获取统计
   */
  getStats(): {
    queueSize: number;
    maxBatchSize: number;
    waitTime: number;
    enabled: boolean;
  } {
    return {
      queueSize: this.queue.length,
      maxBatchSize: this.options.maxBatchSize,
      waitTime: this.options.waitTime,
      enabled: this.options.enabled,
    };
  }
}

/**
 * 工具批量执行器
 */
export class ToolBatchExecutor {
  private processors = new Map<string, BatchProcessor<unknown, unknown>>();

  private defaultProcessor:
    | ((inputs: unknown[]) => Promise<unknown[]>)
    | null = null;

  /**
   * 设置默认处理器
   */
  setDefaultProcessor(
    processor: (inputs: unknown[]) => Promise<unknown[]>,
  ): void {
    this.defaultProcessor = processor;
  }

  /**
   * 执行工具调用
   */
  async execute(tool: string, args: unknown): Promise<unknown> {
    if (!this.defaultProcessor) {
      throw new Error('No default processor set');
    }

    // 检查是否已有此工具的处理器
    if (!this.processors.has(tool)) {
      const processor = new BatchProcessor<unknown, unknown>(
        async (inputs) => {
          return this.defaultProcessor!(inputs);
        },
        { maxBatchSize: 5, waitTime: 50 },
      );
      this.processors.set(tool, processor);
    }

    const batchProcessor = this.processors.get(tool)!;
    return batchProcessor.add({ tool, args });
  }

  /**
   * 获取统计
   */
  getStats(): Record<string, unknown> {
    const stats: Record<string, unknown> = {};
    for (const [tool, processor] of this.processors) {
      stats[tool] = processor.getStats();
    }
    return stats;
  }
}

/** 全局工具批量执行器 */
export const toolBatchExecutor = new ToolBatchExecutor();
