/**
 * 短期记忆
 * 基于内存的有界存储，FIFO 淘汰
 */

import { type MemoryStore, type MemoryEntry, type MemoryQueryOptions, generateId } from './base.js';

export class ShortTermMemory implements MemoryStore {
  readonly type = 'short-term';
  private entries: MemoryEntry[] = [];
  private limit: number;

  constructor(limit: number = 100) {
    this.limit = limit;
  }

  async add(
    entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>,
  ): Promise<MemoryEntry> {
    const newEntry: MemoryEntry = {
      ...entry,
      id: generateId(),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 0,
    };

    this.entries.push(newEntry);

    // FIFO 淘汰：超出限制时移除最旧的
    while (this.entries.length > this.limit) {
      this.entries.shift();
    }

    return newEntry;
  }

  async query(options?: MemoryQueryOptions): Promise<MemoryEntry[]> {
    let results = [...this.entries];

    // 关键词过滤
    if (options?.keyword) {
      const keyword = options.keyword.toLowerCase();
      results = results.filter(
        (e) =>
          e.content.toLowerCase().includes(keyword) ||
          e.metadata.toString().toLowerCase().includes(keyword),
      );
    }

    // 时间范围过滤
    if (options?.since) {
      results = results.filter((e) => e.createdAt >= options.since!);
    }
    if (options?.until) {
      results = results.filter((e) => e.createdAt <= options.until!);
    }

    // 排序
    switch (options?.sortBy) {
      case 'recency':
        results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'frequency':
        results.sort((a, b) => b.accessCount - a.accessCount);
        break;
      default:
        // 默认按创建时间倒序
        results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    // 限制返回数量
    const limit = options?.limit ?? 10;
    return results.slice(0, limit);
  }

  async get(id: string): Promise<MemoryEntry | null> {
    const entry = this.entries.find((e) => e.id === id);
    if (entry) {
      entry.lastAccessedAt = new Date();
      entry.accessCount++;
      return { ...entry };
    }
    return null;
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
    const index = this.entries.findIndex((e) => e.id === id);
    if (index === -1) return null;

    this.entries[index] = {
      ...this.entries[index],
      ...updates,
      id, // 保持 ID 不变
    };

    return { ...this.entries[index] };
  }

  async delete(id: string): Promise<boolean> {
    const index = this.entries.findIndex((e) => e.id === id);
    if (index === -1) return false;

    this.entries.splice(index, 1);
    return true;
  }

  async clear(): Promise<void> {
    this.entries = [];
  }

  async count(): Promise<number> {
    return this.entries.length;
  }
}
