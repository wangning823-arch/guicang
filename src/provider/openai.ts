/**
 * OpenAI Provider 实现
 * 支持 GPT-4o, GPT-4, GPT-3.5-turbo 等模型
 */

import { BaseProvider, type ProviderOptions } from './base.js';
import type { Message, LLMResponse, ToolDefinition, ToolCall } from '../core/types.js';

/** OpenAI API 响应格式 */
interface OpenAIResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIProvider extends BaseProvider {
  get type(): string {
    return 'openai';
  }

  async validate(): Promise<boolean> {
    const apiKey = this.config.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return false;
    }
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  protected override getHeaders(): Record<string, string> {
    const apiKey = this.config.apiKey ?? process.env.OPENAI_API_KEY;
    return {
      ...super.getHeaders(),
      Authorization: `Bearer ${apiKey}`,
    };
  }

  async chat(
    messages: Message[],
    tools?: ToolDefinition[],
    options?: ProviderOptions,
  ): Promise<LLMResponse> {
    const apiKey = this.config.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
    }

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
      })),
      temperature: options?.temperature ?? 0.7,
    };

    if (options?.maxTokens) {
      body.max_tokens = options.maxTokens;
    }

    if (options?.stop) {
      body.stop = options.stop;
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
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
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (mappedTools) {
            body.tools = mappedTools;
          }

          const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          // 不重试 4xx 客户端错误（除了 429 限流）
          if (!response.ok) {
            const errorBody = await response.text();
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
            }
            throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
          }

          const data = (await response.json()) as OpenAIResponse;
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

  private parseResponse(data: OpenAIResponse): LLMResponse {
    const choice = data.choices[0];
    if (!choice) {
      throw new Error('No choices in response');
    }

    const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: this.safeParseJSON(tc.function.arguments),
    }));

    return {
      message: {
        role: 'assistant',
        content: choice.message.content ?? '',
      },
      toolCalls,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  private safeParseJSON(text: string): Record<string, unknown> {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
