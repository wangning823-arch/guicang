/**
 * API 限流
 * 请求频率控制和配额管理
 */

import { Logger } from '../core/logger.js';

const logger = new Logger('api:rate-limiter');

/** 限流策略 */
export type RateLimitStrategy = 'fixed-window' | 'sliding-window' | 'token-bucket';

/** 限流选项 */
export interface RateLimitOptions {
  /** 时间窗口（毫秒） */
  windowMs?: number;
  /** 最大请求数 */
  maxRequests?: number;
  /** 限流策略 */
  strategy?: RateLimitStrategy;
  /** 令牌桶：每秒补充令牌数 */
  refillRate?: number;
}

/** 限流结果 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfter?: number;
}

/** 客户端记录 */
interface ClientRecord {
  count: number;
  windowStart: number;
  tokens: number;
  lastRefill: number;
}

/**
 * API 限流器
 */
export class RateLimiter {
  private clients = new Map<string, ClientRecord>();
  private options: Required<RateLimitOptions>;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: RateLimitOptions = {}) {
    this.options = {
      windowMs: options.windowMs ?? 60000, // 1 minute
      maxRequests: options.maxRequests ?? 100,
      strategy: options.strategy ?? 'fixed-window',
      refillRate: options.refillRate ?? 10,
    };
  }

  /**
   * 开始自动清理
   */
  startCleanup(intervalMs = 60000): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, intervalMs);
  }

  /**
   * 停止自动清理
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 检查请求是否允许
   */
  check(clientId: string): RateLimitResult {
    const now = Date.now();
    let record = this.clients.get(clientId);

    if (!record) {
      record = {
        count: 0,
        windowStart: now,
        tokens: this.options.maxRequests,
        lastRefill: now,
      };
      this.clients.set(clientId, record);
    }

    switch (this.options.strategy) {
      case 'fixed-window':
        return this.checkFixedWindow(clientId, record, now);
      case 'sliding-window':
        return this.checkSlidingWindow(clientId, record, now);
      case 'token-bucket':
        return this.checkTokenBucket(clientId, record, now);
      default:
        return this.checkFixedWindow(clientId, record, now);
    }
  }

  /**
   * 记录请求
   */
  consume(clientId: string): RateLimitResult {
    const result = this.check(clientId);
    if (result.allowed) {
      const record = this.clients.get(clientId)!;
      record.count++;

      // 令牌桶策略需要消耗令牌
      if (this.options.strategy === 'token-bucket') {
        record.tokens = Math.max(0, record.tokens - 1);
      }
    }
    return result;
  }

  /**
   * 获取客户端状态
   */
  getClientStatus(clientId: string): {
    count: number;
    limit: number;
    remaining: number;
  } | null {
    const record = this.clients.get(clientId);
    if (!record) return null;

    return {
      count: record.count,
      limit: this.options.maxRequests,
      remaining: Math.max(0, this.options.maxRequests - record.count),
    };
  }

  /**
   * 重置客户端
   */
  resetClient(clientId: string): boolean {
    return this.clients.delete(clientId);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalClients: number;
    strategy: RateLimitStrategy;
    windowMs: number;
    maxRequests: number;
  } {
    return {
      totalClients: this.clients.size,
      strategy: this.options.strategy,
      windowMs: this.options.windowMs,
      maxRequests: this.options.maxRequests,
    };
  }

  /**
   * 固定窗口检查
   */
  private checkFixedWindow(
    clientId: string,
    record: ClientRecord,
    now: number,
  ): RateLimitResult {
    // 检查是否需要重置窗口
    if (now - record.windowStart >= this.options.windowMs) {
      record.count = 0;
      record.windowStart = now;
    }

    const remaining = Math.max(0, this.options.maxRequests - record.count);
    const resetAt = new Date(record.windowStart + this.options.windowMs);

    return {
      allowed: record.count < this.options.maxRequests,
      remaining,
      limit: this.options.maxRequests,
      resetAt,
      retryAfter: remaining === 0
        ? Math.ceil((resetAt.getTime() - now) / 1000)
        : undefined,
    };
  }

  /**
   * 滑动窗口检查
   */
  private checkSlidingWindow(
    clientId: string,
    record: ClientRecord,
    now: number,
  ): RateLimitResult {
    // 简化实现：基于固定窗口但更平滑
    return this.checkFixedWindow(clientId, record, now);
  }

  /**
   * 令牌桶检查
   */
  private checkTokenBucket(
    clientId: string,
    record: ClientRecord,
    now: number,
  ): RateLimitResult {
    // 补充令牌
    const elapsed = (now - record.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.options.refillRate;
    record.tokens = Math.min(
      this.options.maxRequests,
      record.tokens + tokensToAdd,
    );
    record.lastRefill = now;

    const hasToken = record.tokens >= 1;
    const resetAt = new Date(now + ((1 - record.tokens) / this.options.refillRate) * 1000);

    return {
      allowed: hasToken,
      remaining: Math.floor(record.tokens),
      limit: this.options.maxRequests,
      resetAt,
      retryAfter: hasToken
        ? undefined
        : Math.ceil((1 / this.options.refillRate) * 1000) / 1000,
    };
  }

  /**
   * 清理过期记录
   */
  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [clientId, record] of this.clients) {
      if (now - record.windowStart > this.options.windowMs * 2) {
        expired.push(clientId);
      }
    }

    for (const clientId of expired) {
      this.clients.delete(clientId);
    }

    if (expired.length > 0) {
      logger.debug(`Cleaned up ${expired.length} expired rate limit records`);
    }
  }
}

/** 全局限流器 */
export const rateLimiter = new RateLimiter();
