/**
 * Agent 核心循环
 * 基于 ReAct 模式的思考-行动-观察循环
 */

import type { Message, ToolCall, ToolResult, LLMResponse, AgentResult, AgentStatus } from './types.js';
import type { BaseProvider, ProviderOptions } from '../provider/base.js';
import type { ToolContext } from '../tool/base.js';
import { executeTool, getAllToolDefinitions } from '../tool/registry.js';
import { Logger } from './logger.js';

export interface AgentOptions {
  /** 最大循环次数（防止无限循环） */
  maxIterations?: number;
  /** 单次循环超时（毫秒） */
  iterationTimeout?: number;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 工具上下文 */
  toolContext?: Partial<ToolContext>;
  /** Provider 选项 */
  providerOptions?: ProviderOptions;
}

const DEFAULT_OPTIONS: Required<AgentOptions> = {
  maxIterations: 10,
  iterationTimeout: 60_000,
  systemPrompt: 'You are a helpful AI assistant. Use tools when needed to help the user.',
  toolContext: {},
  providerOptions: {},
};

/** 安全获取环境变量（过滤 undefined 值） */
function getSafeEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined),
  ) as Record<string, string>;
}

export class Agent {
  private logger = new Logger('agent');
  private status: AgentStatus = 'idle';

  constructor(
    private provider: BaseProvider,
    private options: AgentOptions = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /** 获取当前状态 */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * 核心执行循环（提取公共逻辑，消除 run/runWithHistory 重复）
   */
  private async executeLoop(
    messages: Message[],
    toolContext: ToolContext,
  ): Promise<AgentResult> {
    const allToolCalls: Array<ToolCall & { result?: ToolResult }> = [];
    const totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const toolDefs = getAllToolDefinitions();
    let iterations = 0;

    try {
      while (iterations < (this.options.maxIterations ?? DEFAULT_OPTIONS.maxIterations)) {
        iterations++;
        this.logger.debug(`Iteration ${iterations}/${this.options.maxIterations}`);

        // 调用 LLM
        this.status = 'thinking';
        const response: LLMResponse = await this.provider.chat(
          messages,
          toolDefs.length > 0 ? toolDefs : undefined,
          this.options.providerOptions,
        );

        // 累计 token 使用量
        if (response.usage) {
          totalUsage.promptTokens += response.usage.promptTokens;
          totalUsage.completionTokens += response.usage.completionTokens;
          totalUsage.totalTokens += response.usage.totalTokens;
        }

        // 如果没有工具调用，返回最终结果
        if (!response.toolCalls || response.toolCalls.length === 0) {
          messages.push(response.message);
          this.status = 'done';
          return {
            status: 'done',
            messages,
            toolCalls: allToolCalls,
            totalUsage,
          };
        }

        // 有工具调用，执行工具
        this.status = 'acting';
        messages.push(response.message);

        for (const toolCall of response.toolCalls) {
          this.logger.info(`Executing tool: ${toolCall.name}`, { args: toolCall.arguments });

          const result = await executeTool(
            toolCall.name,
            toolCall.arguments,
            toolCall.id,
            toolContext,
          );

          allToolCalls.push({ ...toolCall, result });

          // 将工具结果添加到消息
          messages.push({
            role: 'tool',
            content: result.success ? result.content : `Error: ${result.error}`,
            toolCallId: toolCall.id,
          });

          this.logger.debug(`Tool ${toolCall.name} result:`, {
            success: result.success,
            contentLength: result.content.length,
          });
        }

        this.status = 'observing';
      }

      // 达到最大迭代次数
      this.status = 'done';
      return {
        status: 'done',
        messages,
        toolCalls: allToolCalls,
        totalUsage,
        error: `Max iterations (${this.options.maxIterations}) reached`,
      };
    } catch (error) {
      this.status = 'error';
      return {
        status: 'error',
        messages,
        toolCalls: allToolCalls,
        totalUsage,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 运行 agent
   * @param userMessage 用户输入
   * @returns Agent 运行结果
   */
  async run(userMessage: string): Promise<AgentResult> {
    this.status = 'thinking';
    const messages: Message[] = [];

    // 添加系统提示
    if (this.options.systemPrompt) {
      messages.push({ role: 'system', content: this.options.systemPrompt });
    }

    // 添加用户消息
    messages.push({ role: 'user', content: userMessage });

    // 获取可用工具定义
    const toolContext: ToolContext = {
      cwd: process.cwd(),
      env: getSafeEnv(),
      log: (msg: string) => this.logger.debug(msg),
      ...this.options.toolContext,
    };

    return this.executeLoop(messages, toolContext);
  }

  /**
   * 运行 agent（带对话历史）
   */
  async runWithHistory(
    history: Message[],
    userMessage: string,
  ): Promise<AgentResult> {
    this.status = 'thinking';
    const messages: Message[] = [...history];

    // 添加系统提示（如果没有）
    if (this.options.systemPrompt && !messages.some((m) => m.role === 'system')) {
      messages.unshift({ role: 'system', content: this.options.systemPrompt });
    }

    // 添加用户消息
    messages.push({ role: 'user', content: userMessage });

    const toolContext: ToolContext = {
      cwd: process.cwd(),
      env: getSafeEnv(),
      log: (msg: string) => this.logger.debug(msg),
      ...this.options.toolContext,
    };

    return this.executeLoop(messages, toolContext);
  }
}
