/**
 * 工具重试和自愈机制
 * 支持指数退避重试和 fallback 工具
 */

import { Logger } from '../core/logger.js';
import type { ToolResult } from '../core/types.js';
import type { ToolContext } from './base.js';

const logger = new Logger('tool:retry');

/** 重试选项 */
export interface RetryOptions {
  /** 最大重试次数（默认 3） */
  maxRetries?: number;
  /** 初始退避时间毫秒（默认 1000） */
  backoffMs?: number;
  /** 退避倍数（默认 2） */
  backoffMultiplier?: number;
  /** 判断错误是否可重试（默认所有错误都重试） */
  retryOn?: (error: string) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  backoffMs: 1000,
  backoffMultiplier: 2,
  retryOn: () => true,
};

/**
 * 带重试的异步函数执行
 * 使用指数退避策略：1s → 2s → 4s
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < opts.maxRetries && opts.retryOn(lastError.message)) {
        const delay = opts.backoffMs * Math.pow(opts.backoffMultiplier, attempt);
        logger.warn(
          `Attempt ${attempt + 1} failed, retrying in ${delay}ms: ${lastError.message}`,
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * 带 fallback 的工具执行
 * 主工具失败后尝试 fallback 工具链
 */
export interface FallbackConfig {
  /** fallback 工具名称列表，按优先级排列 */
  fallbackTools: string[];
  /** fallback 工具的参数映射函数 */
  argsMapper?: (originalArgs: Record<string, unknown>, error: string) => Record<string, unknown>;
}

/**
 * 执行工具，失败时自动重试并尝试 fallback
 */
export async function executeWithRecovery(
  toolName: string,
  args: Record<string, unknown>,
  toolCallId: string,
  context: ToolContext,
  executeFn: (
    name: string,
    a: Record<string, unknown>,
    id: string,
    ctx: ToolContext,
  ) => Promise<ToolResult>,
  retryOptions?: RetryOptions,
  fallback?: FallbackConfig,
): Promise<ToolResult> {
  // 首先尝试带重试的主工具执行
  try {
    return await withRetry(
      () => executeFn(toolName, args, toolCallId, context),
      retryOptions,
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`Tool "${toolName}" failed after retries: ${errorMsg}`);

    // 如果没有 fallback 配置，返回错误
    if (!fallback || fallback.fallbackTools.length === 0) {
      return {
        toolCallId,
        success: false,
        content: '',
        error: `Tool "${toolName}" failed: ${errorMsg}`,
      };
    }

    // 尝试 fallback 工具
    for (const fallbackName of fallback.fallbackTools) {
      logger.info(`Trying fallback tool: ${fallbackName}`);
      const fallbackArgs = fallback.argsMapper
        ? fallback.argsMapper(args, errorMsg)
        : args;

      try {
        const result = await withRetry(
          () => executeFn(fallbackName, fallbackArgs, toolCallId, context),
          { ...retryOptions, maxRetries: 1 }, // fallback 只重试 1 次
        );

        if (result.success) {
          result.content = `[Fallback from ${toolName}] ${result.content}`;
          return result;
        }
      } catch (fallbackError) {
        const fbMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        logger.warn(`Fallback tool "${fallbackName}" also failed: ${fbMsg}`);
      }
    }

    // 所有 fallback 都失败了
    return {
      toolCallId,
      success: false,
      content: '',
      error: `Tool "${toolName}" and all fallbacks failed. Last error: ${errorMsg}`,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
