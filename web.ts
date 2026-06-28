/**
 * 归藏 Web 入口
 * 启动 Web 服务器（静态页面 + WebSocket 聊天）
 * 可选：同时启动 HTTP API Channel
 */

import { resolve } from 'node:path';
import {
  Agent,
  MimoProvider,
  registerTools,
  FileReadTool,
  FileWriteTool,
  ShellTool,
} from './src/index.js';
import { WebServer } from './src/web/server.js';
import { HTTPChannel } from './src/channel/http.js';
import { Logger } from './src/core/logger.js';

const logger = new Logger('web:main');

async function main() {
  const port = parseInt(process.env.WEB_PORT ?? '5000', 10);
  const apiPort = parseInt(process.env.API_PORT ?? '5001', 10);
  const enableAPI = process.env.ENABLE_API === 'true';

  // 1. 注册工具
  registerTools([
    new FileReadTool(),
    new FileWriteTool(),
    new ShellTool(),
  ]);
  logger.info('Tools registered');

  // 2. 创建 Provider
  const provider = new MimoProvider({
    type: 'mimo',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic',
    model: 'mimo-v2.5',
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
    timeout: 600000,
  });

  const isValid = await provider.validate();
  if (!isValid) {
    console.error('[ERR] API Key 无效。请设置 ANTHROPIC_AUTH_TOKEN 环境变量。');
    process.exit(1);
  }
  logger.info('Provider validated');

  // 3. 创建 Agent
  const agent = new Agent(provider, {
    maxIterations: 50,
    systemPrompt: `你是归藏 (Guicang)，一个强大的 AI 助手。
万物归藏，一念即达。

你可以使用以下工具：
- file_read: 读取文件内容
- file_write: 写入文件内容
- shell: 执行 shell 命令`,
  });

  // 4. 启动 Web 服务器（静态页面 + WebSocket）
  const web = new WebServer({
    port,
    host: '0.0.0.0',
    staticDir: resolve(import.meta.dirname, 'public'),
  });
  web.setAgent(agent);
  await web.start();

  logger.info(`Web UI: http://localhost:${port}`);
  logger.info(`WebSocket: ws://localhost:${port}`);

  // 5. 可选：启动 HTTP API Channel
  if (enableAPI) {
    const api = new HTTPChannel({ port: apiPort, host: '0.0.0.0' });
    api.setAgent(agent);
    await api.start();

    logger.info(`HTTP API: http://localhost:${apiPort}`);
    logger.info(`  POST /chat  { "message": "..." }`);
    logger.info(`  GET  /health`);
  }

  // 优雅退出
  const shutdown = async () => {
    logger.info('Shutting down...');
    await web.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`
╔══════════════════════════════════════════╗
║        归藏 (Guicang) Web Server         ║
╠══════════════════════════════════════════╣
║  Web UI:   http://localhost:${String(port).padEnd(13)}║
║  WebSocket: ws://localhost:${String(port).padEnd(14)}║${enableAPI ? `\n║  HTTP API: http://localhost:${String(apiPort).padEnd(13)}║` : ''}
╚══════════════════════════════════════════╝
`);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
