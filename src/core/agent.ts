/**
 * Agent 核心循环
 * 基于 ReAct 模式的思考-行动-观察循环
 */

import type { Message, ToolCall, ToolResult, LLMResponse, AgentResult, AgentStatus } from './types.js';
import type { BaseProvider, ProviderOptions } from '../provider/base.js';
import type { ToolContext } from '../tool/base.js';
import { executeTool, getAllToolDefinitions } from '../tool/registry.js';
import { Logger } from './logger.js';
import { ContextCompressor, type CompressorOptions } from './compressor.js';
import { SelfReflection, type ReflectionOptions } from './reflection.js';
import { StreamHandler, type StreamCallback } from './stream.js';

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
  /** 上下文压缩选项（不设置则禁用压缩） */
  compressor?: CompressorOptions;
  /** 自我反思选项（不设置则禁用反思） */
  reflection?: ReflectionOptions;
  /** 流式输出回调（实时接收文本增量） */
  streamCallback?: StreamCallback;
}

const DEFAULT_OPTIONS = {
  maxIterations: 30,
  iterationTimeout: 120_000,
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
  private compressor: ContextCompressor | null;
  private reflection: SelfReflection | null;

  constructor(
    private provider: BaseProvider,
    private options: AgentOptions = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.compressor = this.options.compressor
      ? new ContextCompressor(this.options.compressor)
      : null;
    this.reflection = this.options.reflection
      ? new SelfReflection(this.options.reflection)
      : null;
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

        // 上下文压缩（如果启用且消息过长）
        if (this.compressor && this.compressor.shouldCompress(messages)) {
          this.logger.info('Compressing conversation context...');
          messages = await this.compressor.compress(messages, this.provider);
        }

        // 调用 LLM
        this.status = 'thinking';
        this.logger.debug(`Sending ${messages.length} messages to LLM`);
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
          // 流式输出文本增量
          if (this.options.streamCallback && response.message.content) {
            const streamHandler = new StreamHandler(this.options.streamCallback);
            streamHandler.handleTextDelta(response.message.content);
            streamHandler.finish();
          }

          messages.push(response.message);

          // 检测是否因 max_tokens 截断，自动续写
          if (response.stopReason === 'max_tokens' && response.message.content) {
            this.logger.info('Response truncated (max_tokens), continuing...');
            messages.push({
              role: 'user',
              content: '请继续，从上次中断的地方接着输出。不要重复已有内容。',
            });
            this.status = 'observing';
            continue; // 回到循环顶部继续生成
          }

          // 自我反思（如果启用）
          if (this.reflection) {
            this.logger.info('Running self-reflection on final output...');
            const context = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
            const reflection = await this.reflection.evaluate(
              response.message.content,
              context,
              this.provider,
            );

            this.logger.info(`Reflection score: ${reflection.score}/100`);

            if (reflection.revisedContent) {
              // 使用修正后的输出
              messages[messages.length - 1] = {
                role: 'assistant',
                content: reflection.revisedContent,
              };
            }
          }

          this.status = 'done';
          return {
            status: 'done',
            messages,
            toolCalls: allToolCalls,
            totalUsage,
          };
        }

        // 有工具调用，并行执行所有工具
        this.status = 'acting';

        // 流式输出文本部分（如果有）
        if (this.options.streamCallback && response.message.content) {
          const streamHandler = new StreamHandler(this.options.streamCallback);
          streamHandler.handleTextDelta(response.message.content);
          streamHandler.finish();
        }

        messages.push(response.message);

        this.logger.info(`Executing ${response.toolCalls.length} tool(s) in parallel`);

        const results = await Promise.all(
          response.toolCalls.map((toolCall) => {
            this.logger.info(`Executing tool: ${toolCall.name}`, { args: toolCall.arguments });
            return executeTool(
              toolCall.name,
              toolCall.arguments,
              toolCall.id,
              toolContext,
            );
          }),
        );

        // 按顺序将结果添加到消息和记录中
        for (let i = 0; i < response.toolCalls.length; i++) {
          const toolCall = response.toolCalls[i];
          const result = results[i];
          allToolCalls.push({ ...toolCall, result });

          // 截断过大的工具结果，防止撑爆 LLM 上下文
          // 完整结果保留在 allToolCalls 中供调用者使用
          const MAX_TOOL_CONTENT = 2000;
          let toolContent = result.success ? result.content : `Error: ${result.error}`;
          if (toolContent.length > MAX_TOOL_CONTENT) {
            toolContent = toolContent.slice(0, MAX_TOOL_CONTENT) +
              `\n... [truncated, ${result.content.length} chars total]`;
          }

          messages.push({
            role: 'tool',
            content: toolContent,
            toolCallId: toolCall.id,
          });

          this.logger.debug(`Tool ${toolCall.name} result:`, {
            success: result.success,
            contentLength: result.content.length,
          });
        }

        this.status = 'observing';
        this.logger.debug(`After tool execution: ${messages.length} messages in context`);
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
