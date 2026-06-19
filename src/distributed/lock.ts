/**
 * 分布式锁
 * 共享资源访问控制
 */

import { Logger } from '../core/logger.js';

const logger = new Logger('distributed:lock');

/** 锁选项 */
export interface LockOptions {
  /** 锁超时（毫秒） */
  timeout?: number;
  /** 获取锁超时（毫秒） */
  acquireTimeout?: number;
  /** 重试间隔（毫秒） */
  retryInterval?: number;
}

/** 锁信息 */
export interface LockInfo {
  id: string;
  resource: string;
  owner: string;
  acquiredAt: Date;
  expiresAt: Date;
}

/**
 * 分布式锁管理器
 */
export class DistributedLock {
  private locks = new Map<string, LockInfo>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * 获取锁
   */
  async acquire(
    resource: string,
    owner: string,
    options: LockOptions = {},
  ): Promise<LockInfo | null> {
    const timeout = options.timeout ?? 30000;
    const acquireTimeout = options.acquireTimeout ?? 5000;
    const retryInterval = options.retryInterval ?? 100;

    const startTime = Date.now();

    while (Date.now() - startTime < acquireTimeout) {
      // 检查锁是否已存在
      const existingLock = this.locks.get(resource);

      if (existingLock) {
        // 检查锁是否已过期
        if (Date.now() > existingLock.expiresAt.getTime()) {
          // 锁已过期，释放它
          this.release(resource);
        } else {
          // 锁存在且未过期，等待重试
          await this.sleep(retryInterval);
          continue;
        }
      }

      // 尝试获取锁
      const lockInfo: LockInfo = {
        id: this.generateId(),
        resource,
        owner,
        acquiredAt: new Date(),
        expiresAt: new Date(Date.now() + timeout),
      };

      this.locks.set(resource, lockInfo);

      // 设置自动释放定时器
      const timer = setTimeout(() => {
        logger.warn(`Lock expired: ${resource} (owner: ${owner})`);
        this.release(resource);
      }, timeout);

      this.timers.set(resource, timer);

      logger.debug(`Lock acquired: ${resource} by ${owner}`);
      return lockInfo;
    }

    logger.warn(`Failed to acquire lock: ${resource} (timeout: ${acquireTimeout}ms)`);
    return null;
  }

  /**
   * 释放锁
   */
  release(resource: string): boolean {
    const lock = this.locks.get(resource);
    if (!lock) return false;

    this.locks.delete(resource);

    // 清除定时器
    const timer = this.timers.get(resource);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(resource);
    }

    logger.debug(`Lock released: ${resource}`);
    return true;
  }

  /**
   * 检查锁是否存在
   */
  isLocked(resource: string): boolean {
    const lock = this.locks.get(resource);
    if (!lock) return false;

    // 检查是否过期
    if (Date.now() > lock.expiresAt.getTime()) {
      this.release(resource);
      return false;
    }

    return true;
  }

  /**
   * 检查是否持有锁
   */
  isOwnedBy(resource: string, owner: string): boolean {
    const lock = this.locks.get(resource);
    if (!lock) return false;
    return lock.owner === owner;
  }

  /**
   * 获取锁信息
   */
  getLock(resource: string): LockInfo | undefined {
    return this.locks.get(resource);
  }

  /**
   * 获取所有锁
   */
  getAllLocks(): LockInfo[] {
    return [...this.locks.values()];
  }

  /**
   * 强制释放锁（不管谁持有）
   */
  forceRelease(resource: string): boolean {
    return this.release(resource);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalLocks: number;
    lockedResources: string[];
  } {
    // 清理过期锁
    const now = Date.now();
    for (const [resource, lock] of this.locks) {
      if (now > lock.expiresAt.getTime()) {
        this.release(resource);
      }
    }

    return {
      totalLocks: this.locks.size,
      lockedResources: [...this.locks.keys()],
    };
  }

  /**
   * 清空所有锁
   */
  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.locks.clear();
    this.timers.clear();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2, 15);
  }
}

/** 全局分布式锁 */
export const distributedLock = new DistributedLock();
