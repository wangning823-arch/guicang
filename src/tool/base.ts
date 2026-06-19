/**
 * 工具基类
 * 所有内置和自定义工具必须继承此类
 */

import type { ToolDefinition, ToolResult } from '../core/types.js';

export interface ToolContext {
  /** 工作目录 */
  cwd: string;
  /** 环境变量 */
  env: Record<string, string>;
  /** 日志函数 */
  log: (message: string) => void;
}

/**
 * 工具抽象基类
 */
export abstract class BaseTool {
  /** 工具定义 */
  abstract readonly definition: ToolDefinition;

  /** 执行工具 */
  abstract execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult>;

  /** 工具名称 */
  get name(): string {
    return this.definition.name;
  }

  /** 工具描述 */
  get description(): string {
    return this.definition.description;
  }

  /** 验证参数（子类可覆盖以添加自定义验证） */
  validateArgs(args: Record<string, unknown>): boolean {
    const required = (this.definition.parameters.required as string[]) ?? [];
    return required.every((key) => key in args);
  }

  /** 创建成功结果 */
  protected success(content: string, toolCallId: string): ToolResult {
    return { toolCallId, success: true, content };
  }

  /** 创建失败结果 */
  protected error(message: string, toolCallId: string): ToolResult {
    return { toolCallId, success: false, content: '', error: message };
  }
}
