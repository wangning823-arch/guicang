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

interface WorkflowDefinition {
  id: string;
  name: string;
  nodes: Array<{
    id: string;
    type: string;
    name: string;
    x: number;
    y: number;
    config?: Record<string, unknown>;
  }>;
  connections: Array<{ from: string; to: string }>;
  createdAt: string;
  updatedAt: string;
}

export class WebServer {
  private httpServer: Server | null = null;
  private wss: WebSocketServer | null = null;
  private agent: Agent | null = null;
  private clients = new Set<WebSocket>();
  private port: number;
  private host: string;
  private staticDir: string;
  private workflows = new Map<string, WorkflowDefinition>();
  /** 每个 WebSocket 连接的对话历史 */
  private clientHistories = new Map<WebSocket, import('../core/types.js').Message[]>();

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

  private async handleHTTPRequest(req: { url?: string; method?: string; on: (e: string, cb: (d: Buffer) => void) => void }, res: { setHeader: (k: string, v: string) => void; end: (data: string) => void; writeHead: (code: number, headers?: Record<string, string>) => void }) {
    const url = new URL(req.url ?? '/', `http://localhost`);
    const pathname = url.pathname;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end('');
      return;
    }

    // Workflow API routes
    if (pathname === '/api/workflows' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        workflows: [...this.workflows.values()].map((w) => ({
          id: w.id, name: w.name, createdAt: w.createdAt, updatedAt: w.updatedAt,
        })),
      }));
      return;
    }

    if (pathname === '/api/workflows' && req.method === 'POST') {
      const body = await this.readBody(req);
      const data = JSON.parse(body) as Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>;
      const id = 'wf-' + Date.now();
      const workflow: WorkflowDefinition = {
        ...data, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      this.workflows.set(id, workflow);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(workflow));
      return;
    }

    if (pathname.startsWith('/api/workflows/') && req.method === 'GET') {
      const id = pathname.split('/').pop()!;
      const workflow = this.workflows.get(id);
      if (!workflow) { res.writeHead(404); res.end('{"error":"Not found"}'); return; }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(workflow));
      return;
    }

    if (pathname.startsWith('/api/workflows/') && req.method === 'PUT') {
      const id = pathname.split('/').pop()!;
      const workflow = this.workflows.get(id);
      if (!workflow) { res.writeHead(404); res.end('{"error":"Not found"}'); return; }
      const body = await this.readBody(req);
      const data = JSON.parse(body) as Partial<WorkflowDefinition>;
      Object.assign(workflow, data, { updatedAt: new Date().toISOString() });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(workflow));
      return;
    }

    if (pathname.startsWith('/api/workflows/') && req.method === 'DELETE') {
      const id = pathname.split('/').pop()!;
      this.workflows.delete(id);
      res.setHeader('Content-Type', 'application/json');
      res.end('{"ok":true}');
      return;
    }

    // Static files
    let filePath = pathname === '/' ? '/index.html' : pathname;
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
      this.clientHistories.delete(ws);
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

        // 获取或初始化该连接的对话历史
        let history = this.clientHistories.get(ws) ?? [];

        // 临时设置 streamCallback 用于实时推送文本增量
        const originalOptions = (this.agent as any).options;
        const prevCallback = originalOptions.streamCallback;
        originalOptions.streamCallback = (event: { type: string; delta?: string }) => {
          if (event.type === 'text_delta' && event.delta) {
            try {
              ws.send(JSON.stringify({ type: 'delta', content: event.delta }));
            } catch { /* ignore send errors */ }
          }
        };

        let result;
        try {
          result = await this.agent.runWithHistory(history, channelMessage.content);
        } catch (agentError) {
          // Agent 执行出错，发送错误消息给前端
          const errorMsg = agentError instanceof Error ? agentError.message : String(agentError);
          logger.error('Agent execution failed', agentError);
          try {
            ws.send(JSON.stringify({
              type: 'delta',
              content: `\n\n❌ Agent 错误: ${errorMsg}\n`,
            }));
          } catch { /* ignore */ }
          originalOptions.streamCallback = prevCallback;
          ws.send(JSON.stringify({
            type: 'response',
            id: channelMessage.id,
            content: `❌ Agent 错误: ${errorMsg}`,
            toolCalls: 0,
            status: 'error',
          }));
          return;
        } finally {
          originalOptions.streamCallback = prevCallback;
        }

        // 更新对话历史
        if (result.messages.length > 0) {
          this.clientHistories.set(ws, result.messages);
        }

        const lastAssistant = result.messages
          .filter((m) => m.role === 'assistant')
          .pop();

        // content 可能是 string 或 content blocks 数组，提取纯文本
        const lastContent = lastAssistant?.content;
        const responseText = typeof lastContent === 'string'
          ? lastContent
          : Array.isArray(lastContent)
            ? lastContent.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
            : '';

        ws.send(JSON.stringify({
          type: 'response',
          id: channelMessage.id,
          content: responseText,
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

  private readBody(req: { on: (event: string, cb: (...args: unknown[]) => void) => void }): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk: unknown) => (data += String(chunk)));
      req.on('end', () => resolve(data));
      req.on('error', (e: unknown) => reject(e));
    });
  }

  /** 获取所有工作流 */
  getWorkflows(): WorkflowDefinition[] {
    return [...this.workflows.values()];
  }
}
