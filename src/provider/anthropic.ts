/**
 * Anthropic Provider 实现
 * 支持 Claude 系列模型
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

export class AnthropicProvider extends BaseProvider {
  get type(): string {
    return 'anthropic';
  }

  async validate(): Promise<boolean> {
    const apiKey = this.config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return false;
    }
    // Anthropic 没有 models 端点，简单检查 API key 格式
    return apiKey.startsWith('sk-ant-');
  }

  protected override getHeaders(): Record<string, string> {
    const apiKey = this.config.apiKey ?? process.env.ANTHROPIC_API_KEY;
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
    const apiKey = this.config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable.');
    }

    // Anthropic 需要 system 消息单独传递
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

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeout ?? 60_000,
    );

    try {
      let lastError: Error | null = null;
      const maxRetries = this.config.maxRetries ?? 3;
      const mappedTools = tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (mappedTools) {
            body.tools = mappedTools;
          }

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
              throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
            }
            throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
          }

          const data = (await response.json()) as AnthropicResponse;
          return this.parseResponse(data);
        } catch (error) {
          lastError = error as Error;
          // 不重试中止/超时错误
          if (error instanceof Error && error.name === 'AbortError') {
            throw lastError;
          }
          // 不重试非 429 的 4xx 客户端错误
          if (lastError.message.includes('API error 4') && !lastError.message.includes('API error 429')) {
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
        // Tool 消息：合并连续的 tool results 到一个 user 消息
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
        // Assistant 消息：检查是否包含 content blocks（JSON 格式）
        const parsed = this.tryParseContentBlocks(msg.content);
        if (parsed) {
          // 有 content blocks（包含 tool_use），原样传递
          result.push({ role: 'assistant', content: parsed });
        } else {
          // 纯文本，直接传递
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
    // 这样后续 API 调用能正确匹配 tool_results
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
