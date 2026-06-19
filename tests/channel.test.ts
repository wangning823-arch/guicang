import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Agent } from '../src/core/agent.js';
import { BaseProvider } from '../src/provider/base.js';
import { HTTPChannel } from '../src/channel/http.js';
import type { Message, LLMResponse, ToolDefinition } from '../src/core/types.js';
import type { ProviderOptions } from '../src/provider/base.js';

/** Mock provider */
class MockProvider extends BaseProvider {
  get type(): string { return 'mock'; }

  async chat(
    messages: Message[],
    _tools?: ToolDefinition[],
    _options?: ProviderOptions,
  ): Promise<LLMResponse> {
    const lastMsg = messages[messages.length - 1];
    return {
      message: {
        role: 'assistant',
        content: `Echo: ${lastMsg.content}`,
      },
    };
  }

  async validate(): Promise<boolean> {
    return true;
  }
}

describe('HTTPChannel', () => {
  let channel: HTTPChannel;
  let agent: Agent;

  beforeEach(async () => {
    const provider = new MockProvider({ type: 'mock', baseUrl: '', model: 'mock' });
    agent = new Agent(provider);
    channel = new HTTPChannel({ port: 0 }); // 随机端口
    channel.setAgent(agent);
  });

  afterEach(async () => {
    if (channel.isRunning()) {
      await channel.stop();
    }
  });

  it('starts and stops', async () => {
    await channel.start();
    expect(channel.isRunning()).toBe(true);

    await channel.stop();
    expect(channel.isRunning()).toBe(false);
  });

  it('has correct type', () => {
    expect(channel.type).toBe('http');
  });

  it('responds to health check', async () => {
    await channel.start();

    // 获取实际端口
    const address = (channel as unknown as { server: { address: () => { port: number } } })
      .server.address();
    const port = address?.port ?? 8080;

    const response = await fetch(`http://localhost:${port}/health`);
    const data = await response.json() as { status: string };

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
  });

  it('responds to chat request', async () => {
    await channel.start();

    const address = (channel as unknown as { server: { address: () => { port: number } } })
      .server.address();
    const port = address?.port ?? 8080;

    const response = await fetch(`http://localhost:${port}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    });
    const data = await response.json() as { response: string; status: string };

    expect(response.status).toBe(200);
    expect(data.response).toBe('Echo: Hello');
    expect(data.status).toBe('done');
  });

  it('returns 404 for unknown routes', async () => {
    await channel.start();

    const address = (channel as unknown as { server: { address: () => { port: number } } })
      .server.address();
    const port = address?.port ?? 8080;

    const response = await fetch(`http://localhost:${port}/unknown`);
    expect(response.status).toBe(404);
  });

  it('returns 400 for missing message', async () => {
    await channel.start();

    const address = (channel as unknown as { server: { address: () => { port: number } } })
      .server.address();
    const port = address?.port ?? 8080;

    const response = await fetch(`http://localhost:${port}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });
});
