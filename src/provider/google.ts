/**
 * Google Gemini Provider 实现
 * 支持 Gemini 系列模型
 */

import { BaseProvider, type ProviderOptions } from './base.js';
import type { Message, LLMResponse, ToolDefinition, ToolCall } from '../core/types.js';

/** Google API 响应格式 */
interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<
        | { text: string }
        | { functionCall: { name: string; args: Record<string, unknown> } }
      >;
      role: string;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export class GoogleProvider extends BaseProvider {
  get type(): string {
    return 'google';
  }

  async validate(): Promise<boolean> {
    const apiKey = this.config.apiKey ?? process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return false;
    }
    try {
      const response = await fetch(
        `${this.config.baseUrl}/v1beta/models?key=${apiKey}`,
      );
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
    const apiKey = this.config.apiKey ?? process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key is required. Set GOOGLE_API_KEY environment variable.');
    }

    // 转换消息格式
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 4096,
      },
    };

    // 添加系统指令
    const systemMsg = messages.find((m) => m.role === 'system');
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    // 添加工具
    if (tools && tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeout ?? 60_000,
    );

    try {
      let lastError: Error | null = null;
      const maxRetries = this.config.maxRetries ?? 3;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const model = this.config.model;
          const url = `${this.config.baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

          const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Google API error ${response.status}: ${errorBody}`);
          }

          const data = (await response.json()) as GeminiResponse;
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

  private parseResponse(data: GeminiResponse): LLMResponse {
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('No candidates in response');
    }

    const parts = candidate.content?.parts ?? [];
    const textContent = parts
      .filter((p) => 'text' in p)
      .map((p) => (p as { text: string }).text)
      .join('');

    const toolCalls: ToolCall[] | undefined = parts
      .filter((p) => 'functionCall' in p)
      .map((p, idx) => {
        const fc = (p as { functionCall: { name: string; args: Record<string, unknown> } }).functionCall;
        return {
          id: `google_${Date.now()}_${idx}`,
          name: fc.name,
          arguments: fc.args,
        };
      });

    return {
      message: {
        role: 'assistant',
        content: textContent,
      },
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount,
            totalTokens: data.usageMetadata.totalTokenCount,
          }
        : undefined,
    };
  }
}
