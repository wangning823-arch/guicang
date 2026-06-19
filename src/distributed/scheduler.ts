/**
 * 分布式任务调度器
 * 管理任务分配和 worker 协调
 */

import type { DistributedTask, WorkerInfo, TaskHandler, DistributedTaskResult } from './types.js';
import { TaskQueue } from './queue.js';
import { Logger } from '../core/logger.js';

const logger = new Logger('distributed:scheduler');

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export class DistributedScheduler {
  private queue = new TaskQueue();
  private workers = new Map<string, WorkerInfo>();
  private handlers = new Map<string, TaskHandler>();
  private processing = new Map<string, Promise<DistributedTaskResult>>();

  /** 注册任务处理器 */
  registerHandler(type: string, handler: TaskHandler): void {
    this.handlers.set(type, handler);
    logger.info(`Registered handler for task type: ${type}`);
  }

  /** 注册 worker */
  registerWorker(worker: WorkerInfo): void {
    this.workers.set(worker.id, worker);
    logger.info(`Registered worker: ${worker.name}`, { id: worker.id });
  }

  /** 注销 worker */
  unregisterWorker(id: string): boolean {
    return this.workers.delete(id);
  }

  /** 提交任务 */
  submit(
    type: string,
    input: Record<string, unknown>,
    options?: { priority?: number; maxRetries?: number },
  ): DistributedTask {
    const task: DistributedTask = {
      id: generateId(),
      type,
      input,
      status: 'queued',
      createdAt: new Date(),
      retries: 0,
      maxRetries: options?.maxRetries ?? 3,
      priority: options?.priority ?? 5,
    };

    this.queue.enqueue(task);
    logger.info(`Task submitted: ${task.id}`, { type, priority: task.priority });

    // 尝试调度
    this.schedule();

    return task;
  }

  /** 调度任务 */
  private schedule(): void {
    // 查找空闲 worker
    for (const [workerId, worker] of this.workers) {
      if (worker.status !== 'idle') continue;

      // 查找匹配的任务
      const task = this.queue.dequeue(worker.supportedTypes);
      if (!task) continue;

      // 分配任务
      task.status = 'assigned';
      task.workerId = workerId;
      task.startedAt = new Date();

      worker.status = 'busy';
      worker.currentTaskId = task.id;

      logger.info(`Task assigned: ${task.id} to worker ${workerId}`);

      // 异步执行
      this.executeTask(task).catch((error) => {
        logger.error(`Task execution error: ${task.id}`, error);
      });
    }
  }

  /** 执行任务 */
  private async executeTask(task: DistributedTask): Promise<DistributedTaskResult> {
    const handler = this.handlers.get(task.type);
    if (!handler) {
      task.status = 'failed';
      task.error = `No handler for task type: ${task.type}`;
      task.completedAt = new Date();
      return { success: false, error: task.error, duration: 0 };
    }

    const startTime = Date.now();

    try {
      task.status = 'running';
      const result = await handler(task);
      const duration = Date.now() - startTime;

      task.status = 'completed';
      task.result = result;
      task.completedAt = new Date();

      // 更新 worker 状态
      if (task.workerId) {
        const worker = this.workers.get(task.workerId);
        if (worker) {
          worker.status = 'idle';
          worker.currentTaskId = undefined;
          worker.completedTasks++;
        }
      }

      logger.info(`Task completed: ${task.id}`, { duration });
      this.schedule(); // 调度下一个任务

      return { success: true, result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      // 重试逻辑
      if (task.retries < task.maxRetries) {
        task.retries++;
        task.status = 'queued';
        const previousWorkerId = task.workerId;
        task.workerId = undefined;
        task.startedAt = undefined;
        logger.info(`Task retrying: ${task.id}`, { retries: task.retries });

        if (previousWorkerId) {
          const worker = this.workers.get(previousWorkerId);
          if (worker) {
            worker.status = 'idle';
            worker.currentTaskId = undefined;
          }
        }

        this.queue.enqueue(task);
        this.schedule();
      } else {
        task.status = 'failed';
        task.error = errorMsg;
        task.completedAt = new Date();

        if (task.workerId) {
          const worker = this.workers.get(task.workerId);
          if (worker) {
            worker.status = 'idle';
            worker.currentTaskId = undefined;
            worker.failedTasks++;
          }
        }

        logger.error(`Task failed: ${task.id}`, { error: errorMsg });
      }

      this.schedule();
      return { success: false, error: errorMsg, duration };
    }
  }

  /** 获取任务状态 */
  getTask(id: string): DistributedTask | undefined {
    return this.queue.getById(id);
  }

  /** 获取所有 worker */
  getWorkers(): WorkerInfo[] {
    return [...this.workers.values()];
  }

  /** 获取队列统计 */
  getStats() {
    return {
      queue: this.queue.stats(),
      workers: this.workers.size,
      activeWorkers: [...this.workers.values()].filter((w) => w.status === 'busy').length,
    };
  }

  /** 清理已完成任务 */
  cleanup(): number {
    return this.queue.cleanup();
  }
}
