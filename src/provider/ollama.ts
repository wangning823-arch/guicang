/**
 * Ollama Provider 实现
 * 支持本地 Ollama 服务
 */

import { BaseProvider, type ProviderOptions } from './base.js';
import type { Message, LLMResponse, ToolDefinition, ToolCall } from '../core/types.js';

/** Ollama API 响应格式 */
interface OllamaResponse {
  model: string;
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

export class OllamaProvider extends BaseProvider {
  get type(): string {
    return 'ollama';
  }

  async validate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  protected override getHeaders(): Record<string, string> {
    return {
      ...super.getHeaders(),
    };
  }

  async chat(
    messages: Message[],
    tools?: ToolDefinition[],
    options?: ProviderOptions,
  ): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map((m) => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content,
      })),
      stream: false,
    };

    if (options?.temperature !== undefined) {
      body.options = { temperature: options.temperature };
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
      this.config.timeout ?? 120_000,
    );

    try {
      let lastError: Error | null = null;
      const maxRetries = this.config.maxRetries ?? 3;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(`${this.config.baseUrl}/api/chat`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Ollama API error ${response.status}: ${errorBody}`);
          }

          const data = (await response.json()) as OllamaResponse;
          return this.parseResponse(data);
        } catch (error) {
          lastError = error as Error;
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

  private parseResponse(data: OllamaResponse): LLMResponse {
    const toolCalls: ToolCall[] | undefined = data.message.tool_calls?.map((tc, idx) => ({
      id: `ollama_${Date.now()}_${idx}`,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));

    return {
      message: {
        role: 'assistant',
        content: data.message.content,
      },
      toolCalls,
      usage: data.eval_count
        ? {
            promptTokens: 0,
            completionTokens: data.eval_count,
            totalTokens: data.eval_count,
          }
        : undefined,
    };
  }
}
