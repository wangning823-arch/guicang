/**
 * HTTP API 渠道
 * 提供 REST API 接口与 Agent 交互
 * 支持 SSE 流式输出
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
      // 设置 10 分钟超时，防止长任务连接断开
      req.setTimeout(600_000, () => {
        this.logger.warn('Request timed out');
        if (!res.headersSent) {
          this.sendJSON(res, 504, { error: 'Request timed out' });
        }
      });
      res.setTimeout(600_000, () => {
        this.logger.warn('Response timed out');
      });

      this.handleRequest(req, res).catch((error) => {
        this.logger.error('Request handling error', error);
        if (!res.headersSent) {
          this.sendJSON(res, 500, { error: 'Internal server error' });
        }
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

    // 普通 chat（非流式）
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

        const lastContent = lastAssistant?.content;
        const responseText = typeof lastContent === 'string'
          ? lastContent
          : Array.isArray(lastContent)
            ? lastContent.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
            : '';

        this.sendJSON(res, 200, {
          response: responseText,
          toolCalls: result.toolCalls.length,
          status: result.status,
        });
      } else {
        this.sendJSON(res, 500, { error: 'No agent response' });
      }
      return;
    }

    // 流式 chat（SSE）
    if (url.pathname === '/chat/stream' && req.method === 'POST') {
      const body = await this.readBody(req);
      const { message } = JSON.parse(body) as { message: string };

      if (!message) {
        this.sendJSON(res, 400, { error: 'Missing "message" field' });
        return;
      }

      // 设置 SSE 头
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      const channelMessage: ChannelMessage = {
        id: this.generateMessageId(),
        sender: 'api',
        content: message,
        timestamp: new Date(),
      };

      // 流式回调：实时推送文本增量
      const sendSSE = (data: unknown): void => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      sendSSE({ type: 'start', id: channelMessage.id });

      // Keepalive: 每 15 秒发送注释防止连接断开
      const keepalive = setInterval(() => {
        try { res.write(': keepalive\n\n'); } catch { /* ignore */ }
      }, 15_000);

      let result;
      try {
        result = await this.handleMessageWithStream(channelMessage, (event) => {
          if (event.type === 'text_delta' && event.delta) {
            sendSSE({ type: 'delta', content: event.delta });
          }
        });
      } finally {
        clearInterval(keepalive);
      }

      if (result) {
        const lastAssistant = result.messages
          .filter((m) => m.role === 'assistant')
          .pop();

        const lastContent = lastAssistant?.content;
        const responseText = typeof lastContent === 'string'
          ? lastContent
          : Array.isArray(lastContent)
            ? lastContent.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
            : '';

        sendSSE({
          type: 'done',
          id: channelMessage.id,
          content: responseText,
          toolCalls: result.toolCalls.length,
          status: result.status,
        });
      } else {
        sendSSE({ type: 'error', message: 'No agent response' });
      }

      res.end();
      return;
    }

    this.sendJSON(res, 404, { error: 'Not found' });
  }

  /** 带流式回调的消息处理 */
  private async handleMessageWithStream(
    message: ChannelMessage,
    streamCallback: (event: { type: string; delta?: string }) => void,
  ) {
    if (!this.agent) {
      throw new Error('No agent configured for this channel');
    }

    this.logger.debug(`Handling message (stream), history has ${this.conversationHistory.length} messages`);

    // 临时设置 streamCallback
    const originalOptions = (this.agent as any).options;
    const prevCallback = originalOptions.streamCallback;
    originalOptions.streamCallback = streamCallback;

    try {
      const result = await this.agent.runWithHistory(
        this.conversationHistory,
        message.content,
      );

      if (result.messages.length > 0) {
        this.conversationHistory = result.messages;

        if (this.conversationHistory.length > this.maxHistoryLength) {
          const systemMsg = this.conversationHistory.find((m) => m.role === 'system');
          const recentMessages = this.conversationHistory.slice(
            this.conversationHistory.length - this.maxHistoryLength + (systemMsg ? 1 : 0),
          );
          this.conversationHistory = systemMsg
            ? [systemMsg, ...recentMessages]
            : recentMessages;
        }
      }

      return result;
    } finally {
      originalOptions.streamCallback = prevCallback;
    }
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
