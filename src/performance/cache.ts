/**
 * 缓存系统
 * LLM 响应缓存和通用缓存
 */

import { Logger } from '../core/logger.js';

const logger = new Logger('performance:cache');

/** 缓存选项 */
export interface CacheOptions {
  /** 最大缓存条目数 */
  maxSize?: number;
  /** 默认 TTL（毫秒） */
  defaultTTL?: number;
  /** 是否启用统计 */
  enableStats?: boolean;
}

/** 缓存条目 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
  createdAt: number;
}

/** 缓存统计 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  size: number;
  hitRate: number;
}

/**
 * 通用缓存
 */
export class Cache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTTL: number;
  private stats: CacheStats;
  private enableStats: boolean;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.defaultTTL = options.defaultTTL ?? 5 * 60 * 1000; // 5 minutes
    this.enableStats = options.enableStats ?? true;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0,
      hitRate: 0,
    };
  }

  /**
   * 获取缓存
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      this.recordMiss();
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.recordMiss();
      return undefined;
    }

    entry.hits++;
    this.recordHit();
    return entry.value;
  }

  /**
   * 设置缓存
   */
  set(key: string, value: T, ttl?: number): void {
    // 检查是否需要淘汰
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      this.evictLRU();
    }

    const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
    this.store.set(key, {
      value,
      expiresAt,
      hits: 0,
      createdAt: Date.now(),
    });

    this.stats.sets++;
    this.stats.size = this.store.size;
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    const result = this.store.delete(key);
    if (result) {
      this.stats.deletes++;
      this.stats.size = this.store.size;
    }
    return result;
  }

  /**
   * 检查是否存在
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.store.clear();
    this.stats.size = 0;
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * 获取统计
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    return { ...this.stats };
  }

  /**
   * 获取所有有效键
   */
  keys(): string[] {
    const now = Date.now();
    const validKeys: string[] = [];

    for (const [key, entry] of this.store) {
      if (now <= entry.expiresAt) {
        validKeys.push(key);
      }
    }

    return validKeys;
  }

  /**
   * 淘汰最少使用的条目
   */
  private evictLRU(): void {
    let minHits = Infinity;
    let minKey = '';

    for (const [key, entry] of this.store) {
      if (entry.hits < minHits) {
        minHits = entry.hits;
        minKey = key;
      }
    }

    if (minKey) {
      this.store.delete(minKey);
      this.stats.evictions++;
      logger.debug(`Evicted LRU cache entry: ${minKey}`);
    }
  }

  private recordHit(): void {
    if (this.enableStats) {
      this.stats.hits++;
    }
  }

  private recordMiss(): void {
    if (this.enableStats) {
      this.stats.misses++;
    }
  }
}

/**
 * LLM 响应缓存
 * 基于 prompt + model 生成缓存键
 */
export class LLMResponseCache {
  private cache: Cache<string>;

  constructor(options: CacheOptions = {}) {
    this.cache = new Cache<string>({
      maxSize: options.maxSize ?? 500,
      defaultTTL: options.defaultTTL ?? 30 * 60 * 1000, // 30 minutes
      enableStats: options.enableStats ?? true,
    });
  }

  /**
   * 生成缓存键
   */
  private generateKey(prompt: string, model: string, temperature: number): string {
    const normalized = `${model}:${temperature}:${prompt}`.toLowerCase().trim();
    return this.hash(normalized);
  }

  /**
   * 简单哈希
   */
  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `llm:${Math.abs(hash).toString(36)}`;
  }

  /**
   * 获取缓存的响应
   */
  get(prompt: string, model: string, temperature: number): string | undefined {
    const key = this.generateKey(prompt, model, temperature);
    return this.cache.get(key);
  }

  /**
   * 缓存响应
   */
  set(prompt: string, model: string, temperature: number, response: string): void {
    const key = this.generateKey(prompt, model, temperature);
    this.cache.set(key, response);
  }

  /**
   * 检查是否有缓存
   */
  has(prompt: string, model: string, temperature: number): boolean {
    const key = this.generateKey(prompt, model, temperature);
    return this.cache.has(key);
  }

  /**
   * 获取统计
   */
  getStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }
}

/** 全局 LLM 缓存 */
export const llmCache = new LLMResponseCache();
