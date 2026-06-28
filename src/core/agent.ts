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

        // 通知前端进度
        if (this.options.streamCallback && iterations > 1) {
          this.options.streamCallback({
            type: 'text_delta',
            delta: `\n⏳ 思考中 (第${iterations}轮)...\n`,
          });
        }
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
              content: '你的输出被截断了。请从上次中断的地方直接继续输出剩余内容，不要重复已经输出的部分，不要加任何前缀说明。',
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

        // 通知前端正在执行工具
        if (this.options.streamCallback) {
          const toolNames = response.toolCalls.map((tc) => tc.name).join(', ');
          this.options.streamCallback({
            type: 'text_delta',
            delta: `\n\n🔧 正在执行工具: ${toolNames}...\n`,
          });
        }

        messages.push(response.message);

        // 检测输出是否被 max_tokens 截断（即使有工具调用）
        // 当模型生成大型文件内容时，tool_use 的 input 可能被截断
        const isTruncatedWithTools = response.stopReason === 'max_tokens' && response.toolCalls.length > 0;

        // 额外检查：验证工具调用参数是否完整（防止部分截断的 tool_use 被执行）
        const hasIncompleteToolCalls = response.toolCalls.some((tc) => {
          const argsStr = JSON.stringify(tc.arguments);
          // 检查参数是否异常短（可能是截断的）或明显不完整
          if (tc.name === 'file_write') {
            const content = tc.arguments.content as string;
            if (typeof content === 'string' && content.length === 0) return true;
          }
          return false;
        });

        const shouldSkipTools = isTruncatedWithTools || hasIncompleteToolCalls;

        if (shouldSkipTools) {
          this.logger.warn(`Output may be truncated (stopReason=${response.stopReason}, incompleteArgs=${hasIncompleteToolCalls}) — skipping ${response.toolCalls.length} tool call(s)`);
        }

        const results = await Promise.all(
          response.toolCalls.map((toolCall) => {
            if (shouldSkipTools) {
              // 截断时跳过执行，返回错误提示
              this.logger.info(`Skipping truncated tool call: ${toolCall.name}`);
              return Promise.resolve({
                toolCallId: toolCall.id,
                success: false,
                content: '',
                error: 'Output was truncated by token limit. Content was incomplete.',
              });
            }
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

        // 如果工具调用被截断，告诉模型继续生成完整内容
        if (shouldSkipTools) {
          this.logger.info('Adding continuation prompt for truncated output');
          messages.push({
            role: 'user',
            content: '你的输出被 token 限制截断了，工具调用的内容不完整，已跳过执行。请重新生成完整的工具调用。如果内容太长无法一次输出，请将内容分成多个较小的部分，分别调用 file_write（使用 append 模式）来完成。',
          });
        }

        this.status = 'observing';
        this.logger.debug(`After tool execution: ${messages.length} messages in context`);

        // 通知前端工具执行完成
        if (this.options.streamCallback) {
          const successCount = results.filter((r) => r.success).length;
          const failCount = results.length - successCount;
          const summary = failCount > 0
            ? `✅ ${successCount} 成功, ❌ ${failCount} 失败`
            : `✅ ${successCount} 个工具执行成功`;
          this.options.streamCallback({
            type: 'text_delta',
            delta: `\n${summary}\n`,
          });
        }
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
