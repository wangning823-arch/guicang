/**
 * 长期记忆
 * 基于文件的持久化存储
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { type MemoryStore, type MemoryEntry, type MemoryQueryOptions, generateId, calculateDecayScore } from './base.js';

/** 持久化数据格式 */
interface PersistenceData {
  entries: MemoryEntry[];
  version: number;
}

export class LongTermMemory implements MemoryStore {
  readonly type = 'long-term';
  private entries: MemoryEntry[] = [];
  private filePath: string;
  private loaded = false;

  constructor(filePath: string = './data/memory/long-term.json') {
    this.filePath = filePath;
  }

  /** 从文件加载数据 */
  private async load(): Promise<void> {
    if (this.loaded) return;

    try {
      const content = await readFile(this.filePath, 'utf-8');
      const data = JSON.parse(content) as PersistenceData;
      this.entries = data.entries.map((e) => ({
        ...e,
        createdAt: new Date(e.createdAt),
        lastAccessedAt: new Date(e.lastAccessedAt),
      }));
    } catch {
      // 文件不存在或格式错误，使用空数据
      this.entries = [];
    }

    this.loaded = true;
  }

  /** 保存数据到文件 */
  private async save(): Promise<void> {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });

    const data: PersistenceData = {
      entries: this.entries,
      version: 1,
    };

    await writeFile(this.filePath, JSON.stringify(data, null, 2));
  }

  async add(
    entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>,
  ): Promise<MemoryEntry> {
    await this.load();

    const newEntry: MemoryEntry = {
      ...entry,
      id: generateId(),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 0,
      importance: entry.importance ?? 0.5,
    };

    this.entries.push(newEntry);
    await this.save();

    return newEntry;
  }

  async query(options?: MemoryQueryOptions): Promise<MemoryEntry[]> {
    await this.load();

    let results = [...this.entries];

    // 关键词过滤
    if (options?.keyword) {
      const keyword = options.keyword.toLowerCase();
      results = results.filter(
        (e) =>
          e.content.toLowerCase().includes(keyword) ||
          JSON.stringify(e.metadata).toLowerCase().includes(keyword),
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
      case 'relevance':
        // 衰减排序：importance × exp(-λ × daysSinceAccess)
        {
          const decayRate = options.decayRate ?? 0.01;
          results.sort((a, b) => calculateDecayScore(b, decayRate) - calculateDecayScore(a, decayRate));
        }
        break;
      default:
        results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    const limit = options?.limit ?? 10;
    return results.slice(0, limit);
  }

  async get(id: string): Promise<MemoryEntry | null> {
    await this.load();

    const entry = this.entries.find((e) => e.id === id);
    if (entry) {
      entry.lastAccessedAt = new Date();
      entry.accessCount++;
      await this.save();
      return { ...entry };
    }
    return null;
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
    await this.load();

    const index = this.entries.findIndex((e) => e.id === id);
    if (index === -1) return null;

    this.entries[index] = {
      ...this.entries[index],
      ...updates,
      id,
    };

    await this.save();
    return { ...this.entries[index] };
  }

  async delete(id: string): Promise<boolean> {
    await this.load();

    const index = this.entries.findIndex((e) => e.id === id);
    if (index === -1) return false;

    this.entries.splice(index, 1);
    await this.save();
    return true;
  }

  async clear(): Promise<void> {
    this.entries = [];
    await this.save();
  }

  async count(): Promise<number> {
    await this.load();
    return this.entries.length;
  }
}
