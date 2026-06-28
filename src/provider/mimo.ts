/**
 * Mimo Provider 实现
 * 支持 mimo-v2.5 模型（通过 Anthropic 兼容 API）
 */

import { BaseProvider, type ProviderOptions } from './base.js';
import type { Message, LLMResponse, ToolDefinition, ToolCall } from '../core/types.js';

/** Anthropic API 响应格式 */
interface AnthropicResponse {
  id: string;
  content: Array<
    | { type: 'text'; text: string }
    | {
        type: 'tool_use';
        id: string;
        name: string;
        input: Record<string, unknown>;
      }
  >;
  model: string;
  stop_reason: string | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class MimoProvider extends BaseProvider {
  get type(): string {
    return 'mimo';
  }

  async validate(): Promise<boolean> {
    const apiKey = this.config.apiKey ?? process.env.ANTHROPIC_AUTH_TOKEN;
    if (!apiKey) {
      return false;
    }
    return apiKey.startsWith('tp-');
  }

  protected override getHeaders(): Record<string, string> {
    const apiKey = this.config.apiKey ?? process.env.ANTHROPIC_AUTH_TOKEN;
    return {
      ...super.getHeaders(),
      'x-api-key': apiKey ?? '',
      'anthropic-version': '2023-06-01',
    };
  }

  async chat(
    messages: Message[],
    tools?: ToolDefinition[],
    options?: ProviderOptions,
  ): Promise<LLMResponse> {
    const apiKey = this.config.apiKey ?? process.env.ANTHROPIC_AUTH_TOKEN;
    if (!apiKey) {
      throw new Error('Mimo API key is required. Set ANTHROPIC_AUTH_TOKEN environment variable.');
    }

    // Mimo 使用 Anthropic 兼容 API
    const systemMsg = messages.find((m) => m.role === 'system');
    const nonSystemMsgs = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: options?.maxTokens ?? 32768,
      messages: this.buildMessages(nonSystemMsgs),
    };

    if (systemMsg) {
      body.system = systemMsg.content;
    }

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options?.stop) {
      body.stop_sequences = options.stop;
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    let controller = new AbortController();
    let timeout = setTimeout(
      () => controller.abort(),
      this.config.timeout ?? 60_000,
    );

    try {
      let lastError: Error | null = null;
      const maxRetries = this.config.maxRetries ?? 3;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // 每次重试重置 AbortController
        if (attempt > 0) {
          clearTimeout(timeout);
          controller = new AbortController();
          timeout = setTimeout(
            () => controller.abort(),
            this.config.timeout ?? 60_000,
          );
        }

        try {
          const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          // 不重试 4xx 客户端错误（除了 429 限流）
          if (!response.ok) {
            const errorBody = await response.text();
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              throw new Error(`Mimo API error ${response.status}: ${errorBody}`);
            }
            throw new Error(`Mimo API error ${response.status}: ${errorBody}`);
          }

          const data = (await response.json()) as AnthropicResponse;
          return this.parseResponse(data);
        } catch (error) {
          lastError = error as Error;
          // 不重试中止/超时错误
          if (error instanceof Error && error.name === 'AbortError') {
            throw lastError;
          }
          // 不重试 4xx 客户端错误
          if (lastError.message.includes('API error 4')) {
            throw lastError;
          }
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
          }
        }
      }

      throw lastError ?? new Error('Unknown error');
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * 构建 Anthropic API 消息格式
   * 关键：
   * 1. 同一轮的多个 tool_results 必须合并到一个 user 消息中
   * 2. assistant 消息必须包含完整的 content blocks（text + tool_use）
   */
  private buildMessages(messages: Message[]): Array<{ role: string; content: unknown }> {
    const result: Array<{ role: string; content: unknown }> = [];

    for (const msg of messages) {
      if (msg.role === 'tool') {
        const toolResult = {
          type: 'tool_result' as const,
          tool_use_id: msg.toolCallId ?? '',
          content: msg.content,
        };

        const lastMsg = result[result.length - 1];
        if (lastMsg && lastMsg.role === 'user' && Array.isArray(lastMsg.content)) {
          lastMsg.content.push(toolResult);
        } else {
          result.push({
            role: 'user',
            content: [toolResult],
          });
        }
      } else if (msg.role === 'assistant') {
        const parsed = this.tryParseContentBlocks(msg.content);
        if (parsed) {
          result.push({ role: 'assistant', content: parsed });
        } else {
          result.push({ role: 'assistant', content: msg.content });
        }
      } else {
        result.push({ role: msg.role, content: msg.content });
      }
    }

    return result;
  }

  /**
   * 尝试解析 content blocks JSON
   */
  private tryParseContentBlocks(content: string): Array<Record<string, unknown>> | null {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.type) {
        return parsed;
      }
    } catch {
      // 不是 JSON，是纯文本
    }
    return null;
  }

  private parseResponse(data: AnthropicResponse): LLMResponse {
    const textContent = data.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('');

    const toolCalls: ToolCall[] | undefined = data.content
      .filter((c) => c.type === 'tool_use')
      .map((c) => {
        const tc = c as {
          type: 'tool_use';
          id: string;
          name: string;
          input: Record<string, unknown>;
        };
        return {
          id: tc.id,
          name: tc.name,
          arguments: tc.input,
        };
      });

    // 保留完整的 content blocks（包含 text + tool_use）
    const contentBlocks = data.content.map((c) => {
      if (c.type === 'text') {
        return { type: 'text' as const, text: (c as { type: 'text'; text: string }).text };
      }
      const tc = c as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
      return { type: 'tool_use' as const, id: tc.id, name: tc.name, input: tc.input };
    });

    return {
      message: {
        role: 'assistant',
        content: contentBlocks.length === 1 && contentBlocks[0].type === 'text'
          ? textContent
          : JSON.stringify(contentBlocks),
      },
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
      stopReason: data.stop_reason ?? undefined,
    };
  }
}
