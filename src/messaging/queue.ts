/**
 * 消息队列
 * 异步任务处理
 */

import { Logger } from '../core/logger.js';

const logger = new Logger('messaging:queue');

/** 消息状态 */
export type MessageStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

/** 消息优先级 */
export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

/** 队列消息 */
export interface QueueMessage<T = unknown> {
  id: string;
  topic: string;
  payload: T;
  status: MessageStatus;
  priority: MessagePriority;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

/** 消息处理器 */
export type MessageHandler<T = unknown> = (message: QueueMessage<T>) => Promise<void>;

/** 队列选项 */
export interface QueueOptions {
  maxRetries?: number;
  retryDelay?: number;
  maxConcurrent?: number;
}

/**
 * 消息队列
 */
export class MessageQueue {
  private queues = new Map<string, QueueMessage[]>();
  private handlers = new Map<string, MessageHandler[]>();
  private processing = new Set<string>();
  private options: Required<QueueOptions>;

  constructor(options: QueueOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      maxConcurrent: options.maxConcurrent ?? 5,
    };
  }

  /**
   * 发布消息
   */
  publish<T>(
    topic: string,
    payload: T,
    priority: MessagePriority = 'normal',
  ): QueueMessage<T> {
    const message: QueueMessage<T> = {
      id: this.generateId(),
      topic,
      payload,
      status: 'pending',
      priority,
      attempts: 0,
      maxAttempts: this.options.maxRetries,
      createdAt: new Date(),
    };

    if (!this.queues.has(topic)) {
      this.queues.set(topic, []);
    }

    this.queues.get(topic)!.push(message as QueueMessage);

    // 按优先级排序
    this.sortQueue(topic);

    logger.debug(`Message published: ${topic} (${priority})`);

    // 延迟触发处理，允许批量发布后按优先级处理
    setTimeout(() => this.processNext(topic), 0);

    return message;
  }

  /**
   * 订阅主题
   */
  subscribe(topic: string, handler: MessageHandler): void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
    }
    this.handlers.get(topic)!.push(handler);
    logger.debug(`Subscribed to: ${topic}`);
  }

  /**
   * 取消订阅
   */
  unsubscribe(topic: string, handler: MessageHandler): boolean {
    const handlers = this.handlers.get(topic);
    if (!handlers) return false;

    const index = handlers.indexOf(handler);
    if (index === -1) return false;

    handlers.splice(index, 1);
    return true;
  }

  /**
   * 处理下一条消息
   */
  private async processNext(topic: string): Promise<void> {
    const queue = this.queues.get(topic);
    if (!queue || queue.length === 0) return;

    // 检查并发限制
    if (this.processing.size >= this.options.maxConcurrent) {
      return;
    }

    const message = queue.find((m) => m.status === 'pending');
    if (!message) return;

    const handlers = this.handlers.get(topic) ?? [];
    if (handlers.length === 0) return;

    message.status = 'processing';
    message.attempts++;
    this.processing.add(message.id);

    try {
      for (const handler of handlers) {
        await handler(message);
      }

      message.status = 'completed';
      message.processedAt = new Date();

      // 从队列中移除
      const idx = queue.indexOf(message);
      if (idx !== -1) queue.splice(idx, 1);

      logger.debug(`Message processed: ${topic}`);
    } catch (error) {
      message.status = message.attempts < message.maxAttempts ? 'retrying' : 'failed';
      message.error = error instanceof Error ? error.message : String(error);

      if (message.status === 'retrying') {
        logger.warn(`Message retrying: ${topic} (attempt ${message.attempts})`);

        // 延迟重试
        setTimeout(() => {
          message.status = 'pending';
          this.processNext(topic);
        }, this.options.retryDelay);
      } else {
        logger.error(`Message failed: ${topic}`, error);
      }
    } finally {
      this.processing.delete(message.id);
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(topic: string): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const queue = this.queues.get(topic) ?? [];
    return {
      pending: queue.filter((m) => m.status === 'pending').length,
      processing: queue.filter((m) => m.status === 'processing').length,
      completed: queue.filter((m) => m.status === 'completed').length,
      failed: queue.filter((m) => m.status === 'failed').length,
    };
  }

  /**
   * 获取所有主题
   */
  getTopics(): string[] {
    return [...this.queues.keys()];
  }

  /**
   * 清空队列
   */
  clear(topic?: string): void {
    if (topic) {
      this.queues.delete(topic);
    } else {
      this.queues.clear();
    }
  }

  /**
   * 获取统计
   */
  getStats(): {
    totalMessages: number;
    totalTopics: number;
    processing: number;
  } {
    let totalMessages = 0;
    for (const queue of this.queues.values()) {
      totalMessages += queue.length;
    }

    return {
      totalMessages,
      totalTopics: this.queues.size,
      processing: this.processing.size,
    };
  }

  /**
   * 按优先级排序
   */
  private sortQueue(topic: string): void {
    const queue = this.queues.get(topic);
    if (!queue) return;

    const priorityOrder: Record<MessagePriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    queue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2, 15);
  }
}

/** 全局消息队列 */
export const messageQueue = new MessageQueue();
