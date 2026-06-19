import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../src/core/agent.js';
import { BaseProvider, type ProviderOptions } from '../src/provider/base.js';
import { registerTools, clearRegistry } from '../src/tool/registry.js';
import { FileReadTool, FileWriteTool, ShellTool } from '../src/tool/index.js';
import type { Message, LLMResponse, ToolDefinition } from '../src/core/types.js';

/** Mock provider 用于测试 */
class MockProvider extends BaseProvider {
  private responses: LLMResponse[] = [];
  private callCount = 0;

  get type(): string {
    return 'mock';
  }

  /** 设置模拟响应序列 */
  setResponses(responses: LLMResponse[]): void {
    this.responses = responses;
    this.callCount = 0;
  }

  async chat(
    _messages: Message[],
    _tools?: ToolDefinition[],
    _options?: ProviderOptions,
  ): Promise<LLMResponse> {
    const response = this.responses[this.callCount];
    this.callCount++;
    if (!response) {
      throw new Error('No more mock responses');
    }
    return response;
  }

  async validate(): Promise<boolean> {
    return true;
  }
}

describe('Agent', () => {
  let mockProvider: MockProvider;

  beforeEach(() => {
    clearRegistry();
    mockProvider = new MockProvider({ type: 'mock', baseUrl: '', model: 'mock' });
  });

  it('returns simple text response', async () => {
    mockProvider.setResponses([
      {
        message: { role: 'assistant', content: 'Hello! How can I help?' },
      },
    ]);

    const agent = new Agent(mockProvider, {
      systemPrompt: 'You are a test assistant.',
    });

    const result = await agent.run('Hi');

    expect(result.status).toBe('done');
    expect(result.messages).toHaveLength(3); // system + user + assistant
    expect(result.messages[2].content).toBe('Hello! How can I help?');
    expect(result.toolCalls).toHaveLength(0);
  });

  it('executes tool calls', async () => {
    registerTools([new FileWriteTool(), new FileReadTool()]);

    // 第一次返回工具调用
    // 第二次返回最终文本
    mockProvider.setResponses([
      {
        message: {
          role: 'assistant',
          content: '',
        },
        toolCalls: [
          {
            id: 'call_1',
            name: 'file_write',
            arguments: { path: 'test.txt', content: 'hello', _toolCallId: 'call_1' },
          },
        ],
      },
      {
        message: { role: 'assistant', content: 'File written successfully.' },
      },
    ]);

    const agent = new Agent(mockProvider, { maxIterations: 5 });
    const result = await agent.run('Write hello to test.txt');

    expect(result.status).toBe('done');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('file_write');
    expect(result.toolCalls[0].result?.success).toBe(true);
  });

  it('handles tool execution errors', async () => {
    registerTools([new FileReadTool()]);

    mockProvider.setResponses([
      {
        message: { role: 'assistant', content: '' },
        toolCalls: [
          {
            id: 'call_1',
            name: 'file_read',
            arguments: { path: 'nonexistent.txt', _toolCallId: 'call_1' },
          },
        ],
      },
      {
        message: { role: 'assistant', content: 'The file was not found.' },
      },
    ]);

    const agent = new Agent(mockProvider, { maxIterations: 5 });
    const result = await agent.run('Read nonexistent.txt');

    expect(result.status).toBe('done');
    expect(result.toolCalls[0].result?.success).toBe(false);
  });

  it('respects max iterations limit', async () => {
    registerTools([new ShellTool()]);

    // 每次都返回工具调用，永不停止
    const infiniteToolCalls: LLMResponse = {
      message: { role: 'assistant', content: '' },
      toolCalls: [
        {
          id: 'call_1',
          name: 'shell',
          arguments: { command: 'echo loop', _toolCallId: 'call_1' },
        },
      ],
    };

    mockProvider.setResponses([
      infiniteToolCalls,
      infiniteToolCalls,
      infiniteToolCalls,
      infiniteToolCalls,
      infiniteToolCalls,
    ]);

    const agent = new Agent(mockProvider, { maxIterations: 3 });
    const result = await agent.run('loop forever');

    expect(result.status).toBe('done');
    expect(result.error).toContain('Max iterations');
  });

  it('handles provider errors', async () => {
    mockProvider.setResponses([]);

    // Force an error
    mockProvider['responses'] = [];
    mockProvider['callCount'] = 0;

    const agent = new Agent(mockProvider, { maxIterations: 3 });
    const result = await agent.run('trigger error');

    expect(result.status).toBe('error');
    expect(result.error).toContain('No more mock responses');
  });

  it('tracks status during execution', async () => {
    const statusHistory: string[] = [];
    const agent = new Agent(mockProvider, {
      systemPrompt: 'test',
    });

    mockProvider.setResponses([
      { message: { role: 'assistant', content: 'done' } },
    ]);

    // Check status before
    statusHistory.push(agent.getStatus());

    await agent.run('test');

    // Status should end at done
    expect(agent.getStatus()).toBe('done');
  });

  it('accumulates token usage', async () => {
    mockProvider.setResponses([
      {
        message: { role: 'assistant', content: 'Hello' },
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      },
    ]);

    const agent = new Agent(mockProvider);
    const result = await agent.run('Hi');

    expect(result.totalUsage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
  });
});
