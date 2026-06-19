/**
 * LLM Provider 基类
 * 所有 provider 实现必须继承此类
 */

import type { Message, LLMResponse, ToolDefinition } from '../core/types.js';
import type { ProviderConfig } from '../config/schema.js';

export interface ProviderOptions {
  /** 是否启用流式输出 */
  stream?: boolean;
  /** 温度参数 */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
  /** 停止序列 */
  stop?: string[];
}

/**
 * Provider 抽象基类
 * 定义统一的 LLM 调用接口
 */
export abstract class BaseProvider {
  constructor(protected config: ProviderConfig) {}

  /** Provider 类型标识 */
  abstract get type(): string;

  /** 发送聊天请求 */
  abstract chat(
    messages: Message[],
    tools?: ToolDefinition[],
    options?: ProviderOptions,
  ): Promise<LLMResponse>;

  /** 流式聊天请求（可选实现） */
  // eslint-disable-next-line require-yield
  async *chatStream(
    _messages: Message[],
    _tools?: ToolDefinition[],
    _options?: ProviderOptions,
  ): AsyncGenerator<Partial<LLMResponse>> {
    throw new Error(`${this.type} does not support streaming`);
  }

  /** 验证配置是否有效 */
  abstract validate(): Promise<boolean>;

  /** 获取模型信息 */
  getModelInfo(): { type: string; model: string } {
    return {
      type: this.type,
      model: this.config.model,
    };
  }

  /** 构建请求头（子类可覆盖） */
  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  }
}
