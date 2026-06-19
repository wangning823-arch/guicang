/**
 * 调度器
 * 管理所有定时任务的执行
 */

import { BaseTask, type ScheduleConfig, type TaskCallback, type TaskResult, type TaskStatus } from './base.js';
import { Logger } from '../core/logger.js';

/** 简单任务包装 */
class SimpleTask extends BaseTask {
  private callback: TaskCallback;

  constructor(config: ScheduleConfig, callback: TaskCallback) {
    super(config);
    this.callback = callback;
  }

  async execute(): Promise<TaskResult> {
    const start = Date.now();
    this.status = 'running';

    try {
      await this.callback();
      const duration = Date.now() - start;

      this.status = 'completed';
      this.executionCount++;
      this.lastExecution = new Date();

      const result: TaskResult = {
        name: this.name,
        status: 'completed',
        duration,
        executedAt: new Date(),
      };

      this.lastResult = result;
      return result;
    } catch (error) {
      const duration = Date.now() - start;

      this.status = 'failed';
      this.executionCount++;
      this.lastExecution = new Date();

      const result: TaskResult = {
        name: this.name,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        duration,
        executedAt: new Date(),
      };

      this.lastResult = result;
      return result;
    }
  }
}

/**
 * 调度器
 */
export class Scheduler {
  private tasks = new Map<string, BaseTask>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private logger = new Logger('scheduler');

  /**
   * 注册定时任务
   */
  schedule(config: ScheduleConfig, callback: TaskCallback): BaseTask {
    if (this.tasks.has(config.name)) {
      throw new Error(`Task "${config.name}" is already scheduled`);
    }

    const task = new SimpleTask(config, callback);
    this.tasks.set(config.name, task);

    // 如果需要立即执行
    if (config.runImmediately) {
      this.runTask(task).catch((err) => {
        this.logger.error(`Immediate execution failed for ${config.name}`, err);
      });
    }

    // 设置定时器
    const timer = setInterval(() => {
      this.runTask(task).catch((err) => {
        this.logger.error(`Scheduled execution failed for ${config.name}`, err);
      });
    }, config.intervalMs);

    this.timers.set(config.name, timer);
    this.logger.info(`Scheduled task: ${config.name}`, { intervalMs: config.intervalMs });

    return task;
  }

  /**
   * 执行单个任务
   */
  private async runTask(task: BaseTask): Promise<void> {
    if (task.status === 'cancelled') return;

    // 检查最大执行次数
    if (
      task.config.maxExecutions &&
      task.executionCount >= task.config.maxExecutions
    ) {
      this.logger.info(`Task ${task.name} reached max executions`);
      this.cancel(task.name);
      return;
    }

    const result = await task.execute();
    this.logger.debug(`Task ${task.name} completed`, { duration: result.duration });
  }

  /**
   * 取消任务
   */
  cancel(name: string): boolean {
    const task = this.tasks.get(name);
    if (!task) return false;

    task.cancel();
    const timer = this.timers.get(name);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(name);
    }

    this.logger.info(`Cancelled task: ${name}`);
    return true;
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(name: string): TaskStatus | undefined {
    return this.tasks.get(name)?.status;
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): Array<{ name: string; status: TaskStatus; executionCount: number }> {
    return [...this.tasks.values()].map((t) => ({
      name: t.name,
      status: t.status,
      executionCount: t.executionCount,
    }));
  }

  /**
   * 停止所有任务
   */
  stopAll(): void {
    for (const [name, timer] of this.timers) {
      clearInterval(timer);
      this.logger.debug(`Stopped timer for ${name}`);
    }
    this.timers.clear();

    for (const task of this.tasks.values()) {
      task.cancel();
    }

    this.logger.info('All tasks stopped');
  }

  /**
   * 清空所有任务（测试用）
   */
  clear(): void {
    this.stopAll();
    this.tasks.clear();
  }
}

/** 全局调度器实例 */
export const scheduler = new Scheduler();
