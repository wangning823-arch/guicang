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
  /** 按相关性排序 */
  sortBy?: 'relevance' | 'recency' | 'frequency';
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
