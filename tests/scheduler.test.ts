import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Scheduler } from '../src/scheduler/index.js';

describe('Scheduler', () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    scheduler = new Scheduler();
  });

  afterEach(() => {
    scheduler.clear();
  });

  it('registers and runs tasks', async () => {
    let executed = false;

    scheduler.schedule(
      { name: 'test-task', intervalMs: 1000, runImmediately: true },
      async () => {
        executed = true;
      },
    );

    // 等待立即执行完成
    await new Promise((r) => setTimeout(r, 50));

    expect(executed).toBe(true);
    expect(scheduler.getTaskStatus('test-task')).toBe('completed');
  });

  it('throws on duplicate task', () => {
    scheduler.schedule(
      { name: 'dup', intervalMs: 1000 },
      async () => {},
    );

    expect(() =>
      scheduler.schedule(
        { name: 'dup', intervalMs: 1000 },
        async () => {},
      ),
    ).toThrow('already scheduled');
  });

  it('cancels tasks', async () => {
    scheduler.schedule(
      { name: 'cancel-me', intervalMs: 1000 },
      async () => {},
    );

    const cancelled = scheduler.cancel('cancel-me');
    expect(cancelled).toBe(true);
    expect(scheduler.getTaskStatus('cancel-me')).toBe('cancelled');
  });

  it('returns false for cancelling unknown task', () => {
    expect(scheduler.cancel('unknown')).toBe(false);
  });

  it('tracks execution count', async () => {
    let count = 0;

    scheduler.schedule(
      { name: 'counter', intervalMs: 50, maxExecutions: 3 },
      async () => {
        count++;
      },
    );

    // 等待足够的时间让任务执行 3 次
    await new Promise((r) => setTimeout(r, 300));

    expect(count).toBe(3);
    expect(scheduler.getTaskStatus('counter')).toBe('cancelled'); // 达到最大次数后取消
  });

  it('returns all tasks', () => {
    scheduler.schedule(
      { name: 'task-1', intervalMs: 1000 },
      async () => {},
    );
    scheduler.schedule(
      { name: 'task-2', intervalMs: 2000 },
      async () => {},
    );

    const tasks = scheduler.getAllTasks();
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.name)).toContain('task-1');
    expect(tasks.map((t) => t.name)).toContain('task-2');
  });

  it('stops all tasks', () => {
    scheduler.schedule(
      { name: 'a', intervalMs: 1000 },
      async () => {},
    );
    scheduler.schedule(
      { name: 'b', intervalMs: 1000 },
      async () => {},
    );

    scheduler.stopAll();

    const tasks = scheduler.getAllTasks();
    expect(tasks.every((t) => t.status === 'cancelled')).toBe(true);
  });

  it('handles task errors gracefully', async () => {
    scheduler.schedule(
      { name: 'error-task', intervalMs: 1000, runImmediately: true },
      async () => {
        throw new Error('Test error');
      },
    );

    await new Promise((r) => setTimeout(r, 50));

    const status = scheduler.getTaskStatus('error-task');
    expect(status).toBe('failed');
  });
});
