import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { Agent } from '../src/core/agent.js';
import { BaseProvider } from '../src/provider/base.js';
import { WebSocketChannel } from '../src/channel/websocket.js';
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

describe('WebSocketChannel', () => {
  let channel: WebSocketChannel;
  let agent: Agent;
  let port: number;

  beforeEach(async () => {
    const provider = new MockProvider({ type: 'mock', baseUrl: '', model: 'mock' });
    agent = new Agent(provider);
    // 使用随机可用端口
    port = 18080 + Math.floor(Math.random() * 1000);
    channel = new WebSocketChannel({ port });
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
    expect(channel.type).toBe('websocket');
  });

  it('accepts connections and sends welcome', async () => {
    await channel.start();

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
    await channel.start();

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
    expect(response.status).toBe('done');

    ws.close();
  });

  it('handles ping messages', async () => {
    await channel.start();

    const ws = new WebSocket(`ws://localhost:${port}`);

    // 等待欢迎消息
    await new Promise<void>((resolve) => {
      ws.once('message', () => resolve());
    });

    ws.send(JSON.stringify({ type: 'ping' }));

    const pong = await new Promise<Record<string, unknown>>((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        if (msg.type === 'pong') {
          resolve(msg);
        }
      });
    });

    expect(pong.type).toBe('pong');
    expect(pong.timestamp).toBeDefined();

    ws.close();
  });

  it('returns error for unknown message type', async () => {
    await channel.start();

    const ws = new WebSocket(`ws://localhost:${port}`);

    // 等待欢迎消息
    await new Promise<void>((resolve) => {
      ws.once('message', () => resolve());
    });

    ws.send(JSON.stringify({ type: 'unknown' }));

    const error = await new Promise<Record<string, unknown>>((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        if (msg.type === 'error') {
          resolve(msg);
        }
      });
    });

    expect(error.type).toBe('error');
    expect(error.message).toContain('Unknown type');

    ws.close();
  });
});
