/**
 * WebSocket 渠道
 * 提供实时双向通信
 */

import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { BaseChannel, type ChannelMessage } from './base.js';
import { Logger } from '../core/logger.js';


export interface WebSocketChannelOptions {
  port?: number;
  host?: string;
}

interface WSMessage {
  type: 'chat' | 'ping' | 'history';
  id?: string;
  message?: string;
  data?: unknown;
}

export class WebSocketChannel extends BaseChannel {
  readonly type = 'websocket';
  private wss: WebSocketServer | null = null;
  private logger = new Logger('channel:websocket');
  private port: number;
  private host: string;
  private clients = new Set<WebSocket>();

  constructor(options: WebSocketChannelOptions = {}) {
    super({ name: 'websocket' });
    this.port = options.port ?? 8081;
    this.host = options.host ?? '0.0.0.0';
  }

  async start(): Promise<void> {
    this.running = true;

    this.wss = new WebSocketServer({
      port: this.port,
      host: this.host,
    });

    this.wss.on('connection', (ws) => {
      this.handleConnection(ws);
    });

    this.wss.on('error', (error) => {
      this.logger.error('WebSocket server error', error);
    });

    this.logger.info(`WebSocket server listening on ${this.host}:${this.port}`);
  }

  async stop(): Promise<void> {
    this.running = false;

    // 关闭所有客户端连接
    for (const client of this.clients) {
      client.close(1000, 'Server shutting down');
    }
    this.clients.clear();

    // 关闭服务器
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  async send(message: string): Promise<void> {
    const data = JSON.stringify({ type: 'message', content: message });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  private handleConnection(ws: WebSocket): void {
    this.clients.add(ws);
    this.logger.info('Client connected', { total: this.clients.size });

    // 发送欢迎消息
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to 归藏 (Guicang) WebSocket',
    }));

    ws.on('message', async (raw) => {
      await this.handleWSMessage(ws, raw);
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      this.logger.info('Client disconnected', { total: this.clients.size });
    });

    ws.on('error', (error) => {
      this.logger.error('WebSocket client error', error);
      this.clients.delete(ws);
    });
  }

  private async handleWSMessage(ws: WebSocket, raw: RawData): Promise<void> {
    try {
      const msg = JSON.parse(raw.toString()) as WSMessage;

      switch (msg.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        case 'chat': {
          if (!msg.message) {
            ws.send(JSON.stringify({ type: 'error', message: 'Missing message' }));
            return;
          }

          // 发送处理中状态
          ws.send(JSON.stringify({ type: 'processing', id: msg.id }));

          const channelMessage: ChannelMessage = {
            id: msg.id ?? this.generateMessageId(),
            sender: 'websocket',
            content: msg.message,
            timestamp: new Date(),
          };

          const result = await this.handleChannelMessage(channelMessage);

          if (result) {
            const lastAssistant = result.messages
              .filter((m) => m.role === 'assistant')
              .pop();

            ws.send(JSON.stringify({
              type: 'response',
              id: channelMessage.id,
              content: lastAssistant?.content ?? '',
              toolCalls: result.toolCalls.length,
              status: result.status,
            }));
          }
          break;
        }

        default:
          ws.send(JSON.stringify({ type: 'error', message: `Unknown type: ${msg.type}` }));
      }
    } catch (error) {
      this.logger.error('Failed to handle message', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }

  private async handleChannelMessage(message: ChannelMessage) {
    return this.handleMessage(message);
  }
}
