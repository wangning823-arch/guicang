/**
 * Azure OpenAI Provider 实现
 * 支持 Azure 部署的 OpenAI 模型
 */

import { BaseProvider, type ProviderOptions } from './base.js';
import type { Message, LLMResponse, ToolDefinition, ToolCall } from '../core/types.js';

/** Azure API 响应格式 */
interface AzureResponse {
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

export interface AzureProviderConfig {
  type: 'azure';
  baseUrl: string;
  model: string;
  apiKey?: string;
  /** Azure 资源名称 */
  resourceName?: string;
  /** API 版本 */
  apiVersion?: string;
  /** 部署名称 */
  deploymentName?: string;
  timeout?: number;
  maxRetries?: number;
}

export class AzureProvider extends BaseProvider {
  private resourceName: string;
  private apiVersion: string;
  private deploymentName: string;

  constructor(config: AzureProviderConfig) {
    super(config);
    this.resourceName = config.resourceName ?? '';
    this.apiVersion = config.apiVersion ?? '2024-02-15-preview';
    this.deploymentName = config.deploymentName ?? config.model;
  }

  get type(): string {
    return 'azure';
  }

  private getEndpoint(): string {
    if (this.resourceName) {
      return `https://${this.resourceName}.openai.azure.com`;
    }
    return this.config.baseUrl;
  }

  async validate(): Promise<boolean> {
    const apiKey = this.config.apiKey ?? process.env.AZURE_OPENAI_API_KEY;
    if (!apiKey) {
      return false;
    }
    try {
      const endpoint = this.getEndpoint();
      const response = await fetch(
        `${endpoint}/openai/deployments/${this.deploymentName}/completions?api-version=${this.apiVersion}`,
        {
          headers: { 'api-key': apiKey },
        },
      );
      // 401 表示 key 无效但端点存在
      return response.status === 401 || response.ok;
    } catch {
      return false;
    }
  }

  protected override getHeaders(): Record<string, string> {
    const apiKey = this.config.apiKey ?? process.env.AZURE_OPENAI_API_KEY;
    return {
      ...super.getHeaders(),
      'api-key': apiKey ?? '',
    };
  }

  async chat(
    messages: Message[],
    tools?: ToolDefinition[],
    options?: ProviderOptions,
  ): Promise<LLMResponse> {
    const apiKey = this.config.apiKey ?? process.env.AZURE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Azure API key is required. Set AZURE_OPENAI_API_KEY environment variable.');
    }

    const body: Record<string, unknown> = {
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

    const endpoint = this.getEndpoint();
    const url = `${endpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;

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
          const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Azure API error ${response.status}: ${errorBody}`);
          }

          const data = (await response.json()) as AzureResponse;
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

  private parseResponse(data: AzureResponse): LLMResponse {
    const choice = data.choices[0];
    if (!choice) {
      throw new Error('No choices in response');
    }

    const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
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
}
