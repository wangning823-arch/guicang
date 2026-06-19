/**
 * 任务队列
 * 优先级队列，支持任务调度
 */

import type { DistributedTask, DistributedTaskStatus } from './types.js';

export class TaskQueue {
  private tasks: DistributedTask[] = [];

  /** 入队任务 */
  enqueue(task: DistributedTask): void {
    this.tasks.push(task);
    // 按优先级排序（高优先级在前）
    this.tasks.sort((a, b) => b.priority - a.priority);
  }

  /** 出队最高优先级任务 */
  dequeue(supportedTypes?: string[]): DistributedTask | undefined {
    const index = this.tasks.findIndex((t) => {
      if (t.status !== 'queued') return false;
      if (supportedTypes && supportedTypes.length > 0) {
        return supportedTypes.includes(t.type);
      }
      return true;
    });

    if (index === -1) return undefined;
    return this.tasks.splice(index, 1)[0];
  }

  /** 查看队列（不移除） */
  peek(): DistributedTask | undefined {
    return this.tasks.find((t) => t.status === 'queued');
  }

  /** 获取队列大小 */
  size(): number {
    return this.tasks.filter((t) => t.status === 'queued').length;
  }

  /** 获取所有任务 */
  getAll(): DistributedTask[] {
    return [...this.tasks];
  }

  /** 按状态过滤 */
  getByStatus(status: DistributedTaskStatus): DistributedTask[] {
    return this.tasks.filter((t) => t.status === status);
  }

  /** 按 ID 查找 */
  getById(id: string): DistributedTask | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  /** 移除任务 */
  remove(id: string): boolean {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) return false;
    this.tasks.splice(index, 1);
    return true;
  }

  /** 清空已完成的任务 */
  cleanup(): number {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter(
      (t) => t.status !== 'completed' && t.status !== 'failed',
    );
    return before - this.tasks.length;
  }

  /** 获取统计信息 */
  stats(): Record<DistributedTaskStatus | 'total', number> {
    const stats: Record<string, number> = {
      total: this.tasks.length,
      queued: 0,
      assigned: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const task of this.tasks) {
      stats[task.status]++;
    }

    return stats as Record<DistributedTaskStatus | 'total', number>;
  }
}
