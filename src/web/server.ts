/**
 * Web 服务器
 * 提供静态文件服务和 WebSocket 连接
 */

import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { Logger } from '../core/logger.js';
import type { Agent } from '../core/agent.js';
import type { ChannelMessage } from '../channel/base.js';

const logger = new Logger('web:server');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export interface WebServerOptions {
  port?: number;
  host?: string;
  staticDir?: string;
}

export class WebServer {
  private httpServer: Server | null = null;
  private wss: WebSocketServer | null = null;
  private agent: Agent | null = null;
  private clients = new Set<WebSocket>();
  private port: number;
  private host: string;
  private staticDir: string;

  constructor(options: WebServerOptions = {}) {
    this.port = options.port ?? 3000;
    this.host = options.host ?? '0.0.0.0';
    this.staticDir = options.staticDir ?? resolve(import.meta.dirname, '../../public');
  }

  setAgent(agent: Agent): void {
    this.agent = agent;
  }

  async start(): Promise<void> {
    // 创建 HTTP 服务器
    this.httpServer = createServer(async (req, res) => {
      await this.handleHTTPRequest(req, res);
    });

    // 创建 WebSocket 服务器
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on('connection', (ws) => {
      this.handleWebSocketConnection(ws);
    });

    return new Promise((resolve) => {
      this.httpServer!.listen(this.port, this.host, () => {
        logger.info(`Web server listening on http://${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    // 关闭所有 WebSocket 连接
    for (const client of this.clients) {
      client.close(1000, 'Server shutting down');
    }
    this.clients.clear();

    // 关闭 WebSocket 服务器
    this.wss?.close();

    // 关闭 HTTP 服务器
    return new Promise((resolve) => {
      this.httpServer?.close(() => resolve());
    });
  }

  private async handleHTTPRequest(req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (data: string) => void; writeHead: (code: number) => void }) {
    let filePath = req.url === '/' ? '/index.html' : req.url ?? '/index.html';
    filePath = resolve(this.staticDir, filePath.slice(1));

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        throw new Error('Not a file');
      }

      const content = await readFile(filePath, 'utf-8');
      const ext = extname(filePath);
      const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';

      res.setHeader('Content-Type', mimeType);
      res.end(content);
    } catch {
      // 文件不存在，返回 index.html（SPA 路由）
      try {
        const indexContent = await readFile(resolve(this.staticDir, 'index.html'), 'utf-8');
        res.setHeader('Content-Type', 'text/html');
        res.end(indexContent);
      } catch {
        res.writeHead(404);
        res.end('Not Found');
      }
    }
  }

  private handleWebSocketConnection(ws: WebSocket): void {
    this.clients.add(ws);
    logger.info('WebSocket client connected', { total: this.clients.size });

    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to 归藏 (Guicang)',
    }));

    ws.on('message', async (raw) => {
      await this.handleWebSocketMessage(ws, raw.toString());
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      logger.info('WebSocket client disconnected', { total: this.clients.size });
    });
  }

  private async handleWebSocketMessage(ws: WebSocket, raw: string): Promise<void> {
    try {
      const msg = JSON.parse(raw) as { type: string; message?: string; id?: string };

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        return;
      }

      if (msg.type === 'chat' && msg.message) {
        if (!this.agent) {
          ws.send(JSON.stringify({ type: 'error', message: 'No agent configured' }));
          return;
        }

        ws.send(JSON.stringify({ type: 'processing', id: msg.id }));

        const channelMessage: ChannelMessage = {
          id: msg.id ?? `msg_${Date.now()}`,
          sender: 'web',
          content: msg.message,
          timestamp: new Date(),
        };

        const result = await this.agent.run(channelMessage.content);

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
    } catch (error) {
      logger.error('Failed to handle message', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }
}
