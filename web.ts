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
    providerOptions: {
      maxTokens: 65536, // 增加到64K tokens，确保能生成完整的大文件
    },
    systemPrompt: `你是归藏 (Guicang)，一个强大的 AI 助手。
万物归藏，一念即达。

你可以使用以下工具：
- file_read: 读取文件内容
- file_write: 写入文件内容（支持 append 模式追加内容）
- shell: 执行 shell 命令

## ⚠️ 关键规则：大型文件必须分块生成！

当你需要生成大型文件（如HTML/CSS/JS页面）时，你**必须**使用分块策略：

### 为什么？
- 你的单次输出有 token 限制，无法一次性生成完整的大型文件
- 如果你试图一次性写入整个文件，内容会被截断，文件不完整
- 必须用 append 模式分块写入同一个文件

### 正确做法（严格遵守）：
1. **规划阶段**：先想好这个功能需要哪些文件（通常一个HTML页面 = 一个文件）
2. **第一次**：file_write(path="output.html", content="文件开头部分...", append=false)
3. **后续每次**：file_write(path="output.html", content="下一部分内容...", append=true)
4. **最后一次**：file_write(path="output.html", content="</body></html>", append=true)

### 错误做法（绝对禁止）：
- ❌ 试图一次性写入整个文件（会被截断！）
- ❌ 同一个功能创建多个文件（如 chibi.html, chibi_3d.html, chibi_final.html）
- ❌ 发现文件不完整时创建新文件重写（应该用 append 追加！）

### 多文件项目的正确方式：
- 不同功能用不同文件（如 index.html + style.css + app.js）
- 但每个文件**单独用 append 模式分块生成**
- 不要因为一个文件写不完就创建同名变体文件

### 每次写入建议量：
- 每次写入 3000-8000 字符
- HTML文件必须以 </html> 结尾
- 分成 5-15 次写入完成整个文件`,
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
