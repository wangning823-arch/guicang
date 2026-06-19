/**
 * HTTP API 渠道
 * 提供 REST API 接口与 Agent 交互
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { BaseChannel, type ChannelMessage } from './base.js';
import { Logger } from '../core/logger.js';

export interface HTTPChannelOptions {
  port?: number;
  host?: string;
}

export class HTTPChannel extends BaseChannel {
  readonly type = 'http';
  private server: Server | null = null;
  private logger = new Logger('channel:http');
  private port: number;
  private host: string;

  constructor(options: HTTPChannelOptions = {}) {
    super({ name: 'http' });
    this.port = options.port ?? 8080;
    this.host = options.host ?? '0.0.0.0';
  }

  async start(): Promise<void> {
    this.running = true;

    this.server = createServer((req, res) => {
      this.handleRequest(req, res).catch((error) => {
        this.logger.error('Request handling error', error);
        this.sendJSON(res, 500, { error: 'Internal server error' });
      });
    });

    return new Promise((resolve) => {
      this.server!.listen(this.port, this.host, () => {
        this.logger.info(`HTTP server listening on ${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  async send(message: string): Promise<void> {
    // HTTP 是被动的，send 在这里不做任何事
    this.logger.debug('HTTP send (no-op)', { message });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      this.sendJSON(res, 200, {});
      return;
    }

    // 路由
    if (url.pathname === '/health') {
      this.sendJSON(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
      return;
    }

    if (url.pathname === '/chat' && req.method === 'POST') {
      const body = await this.readBody(req);
      const { message } = JSON.parse(body) as { message: string };

      if (!message) {
        this.sendJSON(res, 400, { error: 'Missing "message" field' });
        return;
      }

      const channelMessage: ChannelMessage = {
        id: this.generateMessageId(),
        sender: 'api',
        content: message,
        timestamp: new Date(),
      };

      const result = await this.handleMessage(channelMessage);
      if (result) {
        const lastAssistant = result.messages
          .filter((m) => m.role === 'assistant')
          .pop();

        this.sendJSON(res, 200, {
          response: lastAssistant?.content ?? '',
          toolCalls: result.toolCalls.length,
          status: result.status,
        });
      } else {
        this.sendJSON(res, 500, { error: 'No agent response' });
      }
      return;
    }

    this.sendJSON(res, 404, { error: 'Not found' });
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  }

  private sendJSON(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}
