/**
 * 记忆系统基类
 * 定义短期和长期记忆的统一接口
 */

import type { Message } from '../core/types.js';

/** 记忆条目 */
export interface MemoryEntry {
  /** 唯一标识 */
  id: string;
  /** 记忆内容 */
  content: string;
  /** 关联的消息 */
  message?: Message;
  /** 元数据 */
  metadata: Record<string, unknown>;
  /** 创建时间 */
  createdAt: Date;
  /** 最后访问时间 */
  lastAccessedAt: Date;
  /** 访问次数 */
  accessCount: number;
  /** 重要性（0-1，默认 0.5） */
  importance: number;
}

/** 记忆查询选项 */
export interface MemoryQueryOptions {
  /** 最大返回条数 */
  limit?: number;
  /** 搜索关键词 */
  keyword?: string;
  /** 时间范围：起始 */
  since?: Date;
  /** 时间范围：结束 */
  until?: Date;
  /** 按相关性排序（衰减排序） */
  sortBy?: 'relevance' | 'recency' | 'frequency';
  /** 衰减速率（默认 0.01，半衰期约 70 天） */
  decayRate?: number;
}

/**
 * 记忆存储接口
 */
export interface MemoryStore {
  /** 存储类型标识 */
  readonly type: string;

  /** 添加记忆 */
  add(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>): Promise<MemoryEntry>;

  /** 查询记忆 */
  query(options?: MemoryQueryOptions): Promise<MemoryEntry[]>;

  /** 获取单条记忆 */
  get(id: string): Promise<MemoryEntry | null>;

  /** 更新记忆 */
  update(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null>;

  /** 删除记忆 */
  delete(id: string): Promise<boolean>;

  /** 清空所有记忆 */
  clear(): Promise<void>;

  /** 获取记忆数量 */
  count(): Promise<number>;
}

/** 生成唯一 ID */
export function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 计算记忆衰减分数
 * 基于指数衰减：score = importance * exp(-λ * daysSinceAccess)
 * importance 越高、lastAccessedAt 越近 → 分数越高
 */
export function calculateDecayScore(entry: MemoryEntry, decayRate = 0.01): number {
  const now = Date.now();
  const daysSinceAccess = (now - entry.lastAccessedAt.getTime()) / (1000 * 60 * 60 * 24);
  const importance = entry.importance ?? 0.5;
  return importance * Math.exp(-decayRate * daysSinceAccess);
}
