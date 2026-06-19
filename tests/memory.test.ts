import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { ShortTermMemory } from '../src/memory/short-term.js';
import { LongTermMemory } from '../src/memory/long-term.js';

describe('ShortTermMemory', () => {
  let memory: ShortTermMemory;

  beforeEach(() => {
    memory = new ShortTermMemory(5);
  });

  it('adds and retrieves entries', async () => {
    const entry = await memory.add({
      content: 'test memory',
      metadata: { source: 'test' },
    });

    expect(entry.id).toMatch(/^mem_/);
    expect(entry.content).toBe('test memory');
    expect(entry.accessCount).toBe(0);

    const retrieved = await memory.get(entry.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.content).toBe('test memory');
    expect(retrieved!.accessCount).toBe(1);
  });

  it('respects FIFO limit', async () => {
    for (let i = 0; i < 10; i++) {
      await memory.add({ content: `entry ${i}`, metadata: {} });
      // 稍微延迟确保时间戳不同
      await new Promise((r) => setTimeout(r, 2));
    }

    expect(await memory.count()).toBe(5);

    const entries = await memory.query({ sortBy: 'recency' });
    // 应该保留最新的 5 条（entry 5-9）
    expect(entries.map((e) => e.content)).toEqual([
      'entry 9',
      'entry 8',
      'entry 7',
      'entry 6',
      'entry 5',
    ]);
  });

  it('queries with keyword filter', async () => {
    await memory.add({ content: 'apple pie recipe', metadata: {} });
    await memory.add({ content: 'banana bread recipe', metadata: {} });
    await memory.add({ content: 'cherry tart recipe', metadata: {} });

    const results = await memory.query({ keyword: 'apple' });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('apple pie recipe');
  });

  it('queries with time range', async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 1000 * 60 * 60);

    await memory.add({ content: 'old entry', metadata: {} });
    await memory.update((await memory.query())[0].id, { createdAt: old });

    await memory.add({ content: 'new entry', metadata: {} });

    const recent = await memory.query({ since: new Date(now.getTime() - 1000) });
    expect(recent).toHaveLength(1);
    expect(recent[0].content).toBe('new entry');
  });

  it('updates entries', async () => {
    const entry = await memory.add({ content: 'original', metadata: {} });
    const updated = await memory.update(entry.id, { content: 'modified' });

    expect(updated).not.toBeNull();
    expect(updated!.content).toBe('modified');

    const retrieved = await memory.get(entry.id);
    expect(retrieved!.content).toBe('modified');
  });

  it('deletes entries', async () => {
    const entry = await memory.add({ content: 'to delete', metadata: {} });
    const deleted = await memory.delete(entry.id);

    expect(deleted).toBe(true);
    expect(await memory.get(entry.id)).toBeNull();
    expect(await memory.count()).toBe(0);
  });

  it('clears all entries', async () => {
    await memory.add({ content: 'a', metadata: {} });
    await memory.add({ content: 'b', metadata: {} });

    await memory.clear();
    expect(await memory.count()).toBe(0);
  });

  it('returns null for non-existent get', async () => {
    expect(await memory.get('nonexistent')).toBeNull();
  });

  it('returns false for non-existent delete', async () => {
    expect(await memory.delete('nonexistent')).toBe(false);
  });
});

describe('LongTermMemory', () => {
  let memory: LongTermMemory;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = resolve(tmpdir(), `guicang-memory-${Date.now()}`);
    memory = new LongTermMemory(resolve(tmpDir, 'memory.json'));
  });

  afterEach(async () => {
    try {
      await rm(tmpDir, { recursive: true });
    } catch {
      // ignore if directory doesn't exist
    }
  });

  it('persists to file', async () => {
    await memory.add({ content: 'persistent memory', metadata: { important: true } });

    // 创建新实例，从文件加载
    const memory2 = new LongTermMemory(resolve(tmpDir, 'memory.json'));
    const entries = await memory2.query();

    expect(entries).toHaveLength(1);
    expect(entries[0].content).toBe('persistent memory');
  });

  it('adds and retrieves entries', async () => {
    const entry = await memory.add({
      content: 'long term memory',
      metadata: { tags: ['important'] },
    });

    const retrieved = await memory.get(entry.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.content).toBe('long term memory');
    expect(retrieved!.accessCount).toBe(1);
  });

  it('updates persist to file', async () => {
    const entry = await memory.add({ content: 'original', metadata: {} });
    await memory.update(entry.id, { content: 'updated' });

    const memory2 = new LongTermMemory(resolve(tmpDir, 'memory.json'));
    const retrieved = await memory2.get(entry.id);
    expect(retrieved!.content).toBe('updated');
  });

  it('deletes persist to file', async () => {
    const entry = await memory.add({ content: 'to delete', metadata: {} });
    await memory.delete(entry.id);

    const memory2 = new LongTermMemory(resolve(tmpDir, 'memory.json'));
    expect(await memory2.get(entry.id)).toBeNull();
  });

  it('handles missing file gracefully', async () => {
    const memory2 = new LongTermMemory(resolve(tmpDir, 'nonexistent.json'));
    const entries = await memory2.query();
    expect(entries).toHaveLength(0);
  });

  it('clears and persists', async () => {
    await memory.add({ content: 'a', metadata: {} });
    await memory.clear();

    const memory2 = new LongTermMemory(resolve(tmpDir, 'memory.json'));
    expect(await memory2.count()).toBe(0);
  });
});
