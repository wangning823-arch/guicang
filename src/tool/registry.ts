/**
 * 工具注册中心
 * 管理所有可用工具的注册和查找
 */

import type { ToolDefinition, ToolResult } from '../core/types.js';
import { BaseTool, type ToolContext } from './base.js';
import { executeWithRecovery, type RetryOptions, type FallbackConfig } from './retry.js';

/** 工具注册表 */
const toolRegistry = new Map<string, BaseTool>();

/**
 * 注册工具
 */
export function registerTool(tool: BaseTool): void {
  if (toolRegistry.has(tool.name)) {
    throw new Error(`Tool "${tool.name}" is already registered`);
  }
  toolRegistry.set(tool.name, tool);
}

/**
 * 批量注册工具
 */
export function registerTools(tools: BaseTool[]): void {
  for (const tool of tools) {
    registerTool(tool);
  }
}

/**
 * 获取工具实例
 */
export function getTool(name: string): BaseTool | undefined {
  return toolRegistry.get(name);
}

/**
 * 获取所有已注册工具的定义
 */
export function getAllToolDefinitions(): ToolDefinition[] {
  return [...toolRegistry.values()].map((t) => t.definition);
}

/**
 * 获取所有已注册工具名称
 */
export function getRegisteredToolNames(): string[] {
  return [...toolRegistry.keys()];
}

/**
 * 执行工具调用
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  toolCallId: string,
  context: ToolContext,
): Promise<ToolResult> {
  const tool = toolRegistry.get(name);
  if (!tool) {
    return {
      toolCallId,
      success: false,
      content: '',
      error: `Tool "${name}" not found. Available tools: ${getRegisteredToolNames().join(', ')}`,
    };
  }

  if (!tool.validateArgs(args)) {
    return {
      toolCallId,
      success: false,
      content: '',
      error: `Invalid arguments for tool "${name}"`,
    };
  }

  try {
    return await tool.execute(args, context);
  } catch (error) {
    return {
      toolCallId,
      success: false,
      content: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 内部执行函数（用于 retry 模块）
 */
async function internalExecuteTool(
  name: string,
  args: Record<string, unknown>,
  toolCallId: string,
  context: ToolContext,
): Promise<ToolResult> {
  return executeTool(name, args, toolCallId, context);
}

/**
 * 带重试和 fallback 的工具调用
 */
export async function executeToolWithRecovery(
  name: string,
  args: Record<string, unknown>,
  toolCallId: string,
  context: ToolContext,
  retryOptions?: RetryOptions,
  fallback?: FallbackConfig,
): Promise<ToolResult> {
  return executeWithRecovery(
    name,
    args,
    toolCallId,
    context,
    internalExecuteTool,
    retryOptions,
    fallback,
  );
}

/**
 * 清空注册表（测试用）
 */
export function clearRegistry(): void {
  toolRegistry.clear();
}
