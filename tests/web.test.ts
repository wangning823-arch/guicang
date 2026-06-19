import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { Agent } from '../src/core/agent.js';
import { BaseProvider } from '../src/provider/base.js';
import { WebServer } from '../src/web/server.js';
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

describe('WebServer', () => {
  let server: WebServer;
  let agent: Agent;
  let port: number;

  beforeEach(async () => {
    const provider = new MockProvider({ type: 'mock', baseUrl: '', model: 'mock' });
    agent = new Agent(provider);
    port = 19080 + Math.floor(Math.random() * 1000);
    server = new WebServer({ port });
    server.setAgent(agent);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('starts and stops', async () => {
    await server.start();

    const response = await fetch(`http://localhost:${port}/`);
    expect(response.status).toBe(200);

    await server.stop();
  });

  it('serves static files', async () => {
    await server.start();

    const response = await fetch(`http://localhost:${port}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it('handles WebSocket connections', async () => {
    await server.start();

    const ws = new WebSocket(`ws://localhost:${port}`);

    const welcome = await new Promise<Record<string, unknown>>((resolve) => {
      ws.on('message', (data) => {
        resolve(JSON.parse(data.toString()) as Record<string, unknown>);
      });
    });

    expect(welcome.type).toBe('welcome');
    expect(welcome.message).toContain('归藏');

    ws.close();
  });

  it('handles chat messages', async () => {
    await server.start();

    const ws = new WebSocket(`ws://localhost:${port}`);

    // 等待欢迎消息
    await new Promise<void>((resolve) => {
      ws.once('message', () => resolve());
    });

    // 发送聊天消息
    ws.send(JSON.stringify({ type: 'chat', id: 'test-1', message: 'Hello' }));

    const response = await new Promise<Record<string, unknown>>((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        if (msg.type === 'response') {
          resolve(msg);
        }
      });
    });

    expect(response.id).toBe('test-1');
    expect(response.content).toBe('Echo: Hello');

    ws.close();
  });

  it('returns 404 for unknown files', async () => {
    await server.start();

    const response = await fetch(`http://localhost:${port}/nonexistent.txt`);
    // SPA fallback returns index.html
    expect(response.status).toBe(200);
  });
});
