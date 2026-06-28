/**
 * 语义缓存
 * 基于 TF-IDF 语义相似度匹配缓存结果
 * 当精确匹配失败时，查找语义相似的缓存条目
 */

import { TextEmbedder } from '../knowledge/embedding.js';
import { Logger } from '../core/logger.js';

const logger = new Logger('performance:semantic-cache');

/** 语义缓存条目 */
interface SemanticCacheEntry<T> {
  key: string;
  value: T;
  embedding: number[];
  createdAt: number;
  hits: number;
}

/** 语义缓存选项 */
export interface SemanticCacheOptions {
  /** 最大缓存条目数（默认 200） */
  maxSize?: number;
  /** 相似度阈值，高于此值视为匹配（默认 0.85） */
  similarityThreshold?: number;
  /** TTL 毫秒（默认 30 分钟） */
  ttlMs?: number;
}

const DEFAULT_OPTIONS: Required<SemanticCacheOptions> = {
  maxSize: 200,
  similarityThreshold: 0.85,
  ttlMs: 30 * 60 * 1000,
};

/**
 * 语义缓存
 *
 * 工作流程：
 * 1. 存储时：计算文本的 TF-IDF 向量并保存
 * 2. 查询时：先精确匹配，失败后计算查询向量与所有缓存向量的余弦相似度
 * 3. 返回相似度最高的条目（如果超过阈值）
 */
export class SemanticCache<T = unknown> {
  private entries: SemanticCacheEntry<T>[] = [];
  private embedder = new TextEmbedder();
  private options: Required<SemanticCacheOptions>;

  constructor(options?: SemanticCacheOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 精确匹配查找
   */
  getExact(key: string): T | undefined {
    const entry = this.entries.find((e) => e.key === key);
    if (!entry) return undefined;

    if (this.isExpired(entry)) {
      this.removeBykey(key);
      return undefined;
    }

    entry.hits++;
    return entry.value;
  }

  /**
   * 语义匹配查找
   * 计算查询文本与所有缓存条目的相似度
   */
  getSemantic(query: string): { value: T; score: number; key: string } | undefined {
    const queryEmbedding = this.embedder.embed(query);

    let bestMatch: SemanticCacheEntry<T> | null = null;
    let bestScore = 0;

    for (const entry of this.entries) {
      if (this.isExpired(entry)) continue;
      if (entry.embedding.length === 0) continue;

      const score = this.embedder.cosineSimilarity(queryEmbedding, entry.embedding);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }

    if (bestMatch && bestScore >= this.options.similarityThreshold) {
      bestMatch.hits++;
      logger.debug(
        `Semantic cache hit: score=${bestScore.toFixed(3)}, key=${bestMatch.key}`,
      );
      return {
        value: bestMatch.value,
        score: bestScore,
        key: bestMatch.key,
      };
    }

    return undefined;
  }

  /**
   * 智能查找：先精确匹配，再语义匹配
   */
  get(key: string, queryText?: string): { value: T; source: 'exact' | 'semantic'; score?: number } | undefined {
    // 1. 精确匹配
    const exact = this.getExact(key);
    if (exact !== undefined) {
      return { value: exact, source: 'exact' };
    }

    // 2. 语义匹配（如果有查询文本）
    if (queryText) {
      const semantic = this.getSemantic(queryText);
      if (semantic) {
        return { value: semantic.value, source: 'semantic', score: semantic.score };
      }
    }

    return undefined;
  }

  /**
   * 存储缓存条目
   */
  set(key: string, value: T, text: string): void {
    // 计算嵌入向量
    const embedding = this.embedder.embed(text);

    // 淘汰检查
    if (this.entries.length >= this.options.maxSize) {
      this.evict();
    }

    this.entries.push({
      key,
      value,
      embedding,
      createdAt: Date.now(),
      hits: 0,
    });
  }

  /**
   * 检查是否存在
   */
  has(key: string): boolean {
    return this.getExact(key) !== undefined;
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.removeBykey(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.entries.length;
  }

  /**
   * 获取缓存统计
   */
  getStats(): {
    size: number;
    expired: number;
    totalHits: number;
    avgHits: number;
  } {
    const now = Date.now();
    let expired = 0;
    let totalHits = 0;

    for (const entry of this.entries) {
      if (now - entry.createdAt > this.options.ttlMs) {
        expired++;
      }
      totalHits += entry.hits;
    }

    return {
      size: this.entries.length,
      expired,
      totalHits,
      avgHits: this.entries.length > 0 ? totalHits / this.entries.length : 0,
    };
  }

  /**
   * 清理过期条目
   */
  cleanup(): number {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => !this.isExpired(e));
    return before - this.entries.length;
  }

  // --- 内部方法 ---

  private isExpired(entry: SemanticCacheEntry<T>): boolean {
    return Date.now() - entry.createdAt > this.options.ttlMs;
  }

  private removeBykey(key: string): boolean {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.key !== key);
    return this.entries.length < before;
  }

  /**
   * 淘汰策略：优先淘汰低 hits 的过期条目，否则淘汰 hits 最少的
   */
  private evict(): void {
    // 先清理过期的
    const removed = this.cleanup();
    if (removed > 0) return;

    // 淘汰 hits 最少的
    if (this.entries.length > 0) {
      let minHits = Infinity;
      let minIdx = 0;
      for (let i = 0; i < this.entries.length; i++) {
        if (this.entries[i].hits < minHits) {
          minHits = this.entries[i].hits;
          minIdx = i;
        }
      }
      this.entries.splice(minIdx, 1);
    }
  }
}

/** 全局语义缓存 */
export const semanticCache = new SemanticCache();
