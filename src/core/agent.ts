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

/** 从 content 中提取纯文本（content 可能是 string 或 content blocks 数组） */
function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');
  }
  return '';
}

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
   * @param streamOverride 可选的流式回调，覆盖 this.options.streamCallback（用于并发请求隔离）
   */
  private async executeLoop(
    messages: Message[],
    toolContext: ToolContext,
    streamOverride?: StreamCallback,
  ): Promise<AgentResult> {
    const streamCallback = streamOverride ?? this.options.streamCallback;
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
        this.logger.info(`Iteration ${iterations}: calling LLM...`);

        // 通知前端进度
        if (streamCallback && iterations > 1) {
          streamCallback({
            type: 'text_delta',
            delta: `\n⏳ 思考中 (第${iterations}轮)...\n`,
          });
        }
        let response: LLMResponse;
        try {
          response = await this.provider.chat(
            messages,
            toolDefs.length > 0 ? toolDefs : undefined,
            this.options.providerOptions,
          );
        } catch (llmError) {
          const errorDetail = llmError instanceof Error ? llmError.message : String(llmError);
          this.logger.error(`LLM call failed: ${errorDetail}`);
          const errorMsg = `LLM 调用失败: ${errorDetail}`;
          if (streamCallback) {
            streamCallback({ type: 'text_delta', delta: `\n❌ ${errorMsg}\n` });
          }
          this.status = 'error';
          return {
            status: 'error',
            messages,
            toolCalls: allToolCalls,
            totalUsage,
            error: errorMsg,
          };
        }

        const textContent = extractText(response.message.content);
        this.logger.info(`LLM response: stopReason=${response.stopReason}, toolCalls=${response.toolCalls?.length ?? 0}, contentLen=${textContent.length}`);

        // 累计 token 使用量
        if (response.usage) {
          totalUsage.promptTokens += response.usage.promptTokens;
          totalUsage.completionTokens += response.usage.completionTokens;
          totalUsage.totalTokens += response.usage.totalTokens;
        }

        // 如果没有工具调用，返回最终结果
        if (!response.toolCalls || response.toolCalls.length === 0) {
          // 流式输出文本增量
          this.logger.info(`No tool calls, streaming text (${textContent.length} chars)`);
          if (streamCallback) {
            const streamText = textContent || '(模型返回了空内容)';
            const streamHandler = new StreamHandler(streamCallback);
            streamHandler.handleTextDelta(streamText);
            streamHandler.finish();
          }

          messages.push(response.message);

          // 检测是否因 max_tokens 截断，自动续写
          if (response.stopReason === 'max_tokens' && textContent) {
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
              textContent,
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

        // 通知前端正在执行工具（不流式输出原始 JSON 内容块）
        if (streamCallback) {
          const toolNames = response.toolCalls.map((tc) => tc.name).join(', ');
          streamCallback({
            type: 'text_delta',
            delta: `\n🔧 正在执行工具: ${toolNames}...\n`,
          });
        }

        messages.push(response.message);

        // 检测输出是否被 max_tokens 截断（即使有工具调用）
        // 当模型生成大型文件内容时，tool_use 的 input 可能被截断
        const isTruncatedWithTools = response.stopReason === 'max_tokens' && response.toolCalls.length > 0;

        // 额外检查：验证工具调用参数是否完整（防止部分截断的 tool_use 被执行）
        const hasIncompleteToolCalls = response.toolCalls.some((tc) => {
          void JSON.stringify(tc.arguments);  // intentional: keep for debugging
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

        // 检测是否创建了新文件而不是使用 append 模式
        // 如果检测到，添加警告提示
        if (!shouldSkipTools) {
          for (const toolCall of response.toolCalls) {
            if (toolCall.name === 'file_write') {
              const filePath = toolCall.arguments.path as string;
              const appendMode = toolCall.arguments.append as boolean;

              // 检查之前是否写过同类型文件（HTML/CSS/JS）
              if (filePath && !appendMode) {
                const prevFileWrites = allToolCalls.filter(
                  (tc) => tc.name === 'file_write' &&
                    (tc.arguments.path as string) !== filePath &&
                    /\.\w+$/.test(tc.arguments.path as string) &&
                    tc.arguments.path &&
                    (tc.arguments.path as string).split('.').pop() === filePath.split('.').pop()
                );

                if (prevFileWrites.length > 0) {
                  this.logger.warn(`Detected new file creation (${filePath}) instead of append mode`);
                  messages.push({
                    role: 'user',
                    content: `⚠️ 警告：你正在创建新文件 ${filePath}，但之前已经创建过同类型文件（${prevFileWrites[prevFileWrites.length - 1].arguments.path}）。请停止创建新文件！应该使用 append 模式继续写入之前的文件：file_write(path="${prevFileWrites[prevFileWrites.length - 1].arguments.path}", content="继续的内容...", append=true)。一个功能一个文件，用 append 分块生成！`,
                  });
                }
              }
            }
          }
        }

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

        // 检测 file_write 是否写入了不完整的 HTML 文件（被截断）
        // 如果是，自动提示 LLM 用 append 模式继续写入
        if (!shouldSkipTools) {
          const lastToolCall = response.toolCalls[response.toolCalls.length - 1];
          if (lastToolCall?.name === 'file_write') {
            const filePath = lastToolCall.arguments.path as string;
            const fileContent = lastToolCall.arguments.content as string;
            const appendMode = lastToolCall.arguments.append as boolean;

            // 检查是否是 HTML 文件且内容被截断（没有正确的闭合标签）
            if (filePath && typeof fileContent === 'string' && !appendMode) {
              const isHtml = /\.(html?|htm)$/i.test(filePath);
              const hasClosingHtml = /<\/html>/i.test(fileContent);
              const hasClosingBody = /<\/body>/i.test(fileContent);

              if (isHtml && (!hasClosingHtml || !hasClosingBody)) {
                this.logger.info(`File ${filePath} appears truncated (missing closing tags), prompting for append continuation`);
                messages.push({
                  role: 'user',
                  content: `文件 ${filePath} 写入成功但内容不完整（缺少闭合标签）。请使用 append 模式继续追加剩余内容：file_write(path="${filePath}", content="剩余的HTML内容...", append=true)。不要创建新文件，不要重写整个文件，只追加缺失的部分。`,
                });
              }
            }
          }
        }

        this.status = 'observing';
        this.logger.debug(`After tool execution: ${messages.length} messages in context`);

        // 通知前端工具执行完成
        if (streamCallback) {
          const successCount = results.filter((r) => r.success).length;
          const failCount = results.length - successCount;
          const summary = failCount > 0
            ? `✅ ${successCount} 成功, ❌ ${failCount} 失败`
            : `✅ ${successCount} 个工具执行成功`;
          streamCallback({
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
   * @param streamOverride 可选的流式回调，覆盖 this.options.streamCallback（用于并发请求隔离）
   */
  async runWithHistory(
    history: Message[],
    userMessage: string,
    streamOverride?: StreamCallback,
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

    return this.executeLoop(messages, toolContext, streamOverride);
  }
}
