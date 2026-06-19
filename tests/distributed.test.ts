import { describe, it, expect, beforeEach } from 'vitest';
import { TaskQueue } from '../src/distributed/queue.js';
import { DistributedScheduler } from '../src/distributed/scheduler.js';
import type { DistributedTask, WorkerInfo } from '../src/distributed/index.js';

describe('TaskQueue', () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = new TaskQueue();
  });

  it('enqueues and dequeues tasks', () => {
    const task: DistributedTask = {
      id: '1',
      type: 'test',
      input: {},
      status: 'queued',
      createdAt: new Date(),
      retries: 0,
      maxRetries: 3,
      priority: 5,
    };

    queue.enqueue(task);
    expect(queue.size()).toBe(1);

    const dequeued = queue.dequeue();
    expect(dequeued?.id).toBe('1');
    expect(queue.size()).toBe(0);
  });

  it('respects priority ordering', () => {
    queue.enqueue({ id: 'low', type: 'test', input: {}, status: 'queued', createdAt: new Date(), retries: 0, maxRetries: 3, priority: 1 });
    queue.enqueue({ id: 'high', type: 'test', input: {}, status: 'queued', createdAt: new Date(), retries: 0, maxRetries: 3, priority: 10 });
    queue.enqueue({ id: 'mid', type: 'test', input: {}, status: 'queued', createdAt: new Date(), retries: 0, maxRetries: 3, priority: 5 });

    expect(queue.dequeue()?.id).toBe('high');
    expect(queue.dequeue()?.id).toBe('mid');
    expect(queue.dequeue()?.id).toBe('low');
  });

  it('filters by supported types', () => {
    queue.enqueue({ id: 'a', type: 'typeA', input: {}, status: 'queued', createdAt: new Date(), retries: 0, maxRetries: 3, priority: 5 });
    queue.enqueue({ id: 'b', type: 'typeB', input: {}, status: 'queued', createdAt: new Date(), retries: 0, maxRetries: 3, priority: 5 });

    const task = queue.dequeue(['typeB']);
    expect(task?.id).toBe('b');
  });

  it('returns stats', () => {
    queue.enqueue({ id: '1', type: 'test', input: {}, status: 'queued', createdAt: new Date(), retries: 0, maxRetries: 3, priority: 5 });
    queue.enqueue({ id: '2', type: 'test', input: {}, status: 'completed', createdAt: new Date(), retries: 0, maxRetries: 3, priority: 5 });

    const stats = queue.stats();
    expect(stats.total).toBe(2);
    expect(stats.queued).toBe(1);
    expect(stats.completed).toBe(1);
  });

  it('cleanup removes completed tasks', () => {
    queue.enqueue({ id: '1', type: 'test', input: {}, status: 'completed', createdAt: new Date(), retries: 0, maxRetries: 3, priority: 5 });
    queue.enqueue({ id: '2', type: 'test', input: {}, status: 'queued', createdAt: new Date(), retries: 0, maxRetries: 3, priority: 5 });

    const removed = queue.cleanup();
    expect(removed).toBe(1);
    expect(queue.size()).toBe(1);
  });
});

describe('DistributedScheduler', () => {
  let scheduler: DistributedScheduler;

  beforeEach(() => {
    scheduler = new DistributedScheduler();
  });

  it('submits tasks', () => {
    const task = scheduler.submit('test', { data: 'hello' });
    expect(task.type).toBe('test');
    expect(task.status).toBe('queued');
  });

  it('registers and uses handlers', async () => {
    let result: unknown = null;
    scheduler.registerHandler('echo', async (task) => {
      result = task.input;
      return task.input;
    });

    const worker: WorkerInfo = {
      id: 'w1',
      name: 'Worker 1',
      supportedTypes: ['echo'],
      status: 'idle',
      completedTasks: 0,
      failedTasks: 0,
      lastHeartbeat: new Date(),
    };
    scheduler.registerWorker(worker);

    scheduler.submit('echo', { msg: 'hello' });

    // 等待任务执行
    await new Promise((r) => setTimeout(r, 50));

    expect(result).toEqual({ msg: 'hello' });
    expect(worker.completedTasks).toBe(1);
  });

  it('handles task failure with retry', async () => {
    let attempts = 0;
    let lastResult: unknown = null;
    scheduler.registerHandler('fail', async () => {
      attempts++;
      if (attempts < 2) throw new Error('Temporary failure');
      lastResult = 'success';
      return 'success';
    });

    const worker: WorkerInfo = {
      id: 'w1',
      name: 'Worker 1',
      supportedTypes: ['fail'],
      status: 'idle',
      completedTasks: 0,
      failedTasks: 0,
      lastHeartbeat: new Date(),
    };
    scheduler.registerWorker(worker);

    scheduler.submit('fail', {}, { maxRetries: 3 });

    // 等待重试完成（需要更多时间）
    await new Promise((r) => setTimeout(r, 200));

    // 至少执行了 2 次
    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(lastResult).toBe('success');
  });

  it('returns stats', () => {
    const stats = scheduler.getStats();
    expect(stats.workers).toBe(0);
    expect(stats.queue.total).toBe(0);
  });

  it('unregisters workers', () => {
    const worker: WorkerInfo = {
      id: 'w1',
      name: 'Worker 1',
      supportedTypes: [],
      status: 'idle',
      completedTasks: 0,
      failedTasks: 0,
      lastHeartbeat: new Date(),
    };
    scheduler.registerWorker(worker);
    expect(scheduler.getWorkers()).toHaveLength(1);

    scheduler.unregisterWorker('w1');
    expect(scheduler.getWorkers()).toHaveLength(0);
  });
});
