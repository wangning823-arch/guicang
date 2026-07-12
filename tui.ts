/**
 * 归藏 TUI 入口
 * 启动终端用户界面
 */

import { TUIEngine } from './src/tui/engine.js';
import { ChatPanel } from './src/tui/panels/chat.js';
import { StatusPanel } from './src/tui/panels/status.js';
import { MetricsPanel } from './src/tui/panels/metrics.js';
import { TokensPanel } from './src/tui/panels/tokens.js';
import { AgentsPanel } from './src/tui/panels/agents.js';
import { ToolsPanel } from './src/tui/panels/tools.js';
import { LogsPanel } from './src/tui/panels/logs.js';
import { HelpPanel } from './src/tui/panels/help.js';
import { Theme, colorize } from './src/tui/theme.js';
import { getStringWidth } from './src/tui/utils.js';

import {
  Agent,
  MimoProvider,
  registerTools,
  FileReadTool,
  FileWriteTool,
  ShellTool,
} from './src/index.js';

import { setLogOutput, type LogLevel, type LogEntry } from './src/core/logger.js';
import type { Message } from './src/core/types.js';

async function main() {
  // 注册工具
  registerTools([
    new FileReadTool(),
    new FileWriteTool(),
    new ShellTool(),
  ]);

  // 创建 Provider
  const provider = new MimoProvider({
    type: 'mimo',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic',
    model: 'mimo-v2.5',
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
    timeout: 120000,
  });

  // 验证配置
  const isValid = await provider.validate();
  if (!isValid) {
    console.error('[ERR] API Key 无效。请设置 ANTHROPIC_AUTH_TOKEN 环境变量。');
    process.exit(1);
  }

  // 创建 Agent
  const agent = new Agent(provider, {
    maxIterations: 10,
    systemPrompt: `你是归藏 (Guicang)，一个强大的 AI 助手。
万物归藏，一念即达。

你可以使用以下工具：
- file_read: 读取文件内容
- file_write: 写入文件内容
- shell: 执行 shell 命令

你可以通过 shell 工具调用 Python 来生成各种文件：
- 生成 PPT: 使用 python-pptx (from pptx import Presentation)
- 生成 Word: 使用 python-docx (from docx import Document)
- 生成 Excel: 使用 openpyxl (from openpyxl import Workbook)
- 生成 PDF: 使用 reportlab 或 fpdf
- 生成图片: 使用 Pillow (from PIL import Image)
- 数据分析: 使用 pandas, matplotlib
- 生成图表: 使用 matplotlib, plotly

当用户要求生成文档、报表、PPT、Word等时，用 shell 执行 Python 脚本来生成真正的文件，不要生成 HTML 替代品。

请用中文回复用户。`,
  });

  // 初始化 TUI 引擎
  const engine = new TUIEngine();
  await engine.init();

  const width = engine.getWidth();
  const height = engine.getHeight();

  // 计算布局
  const chatWidth = Math.floor(width * 0.55);
  const rightX = chatWidth + 2;
  const rightWidth = width - rightX - 1;
  const mainHeight = height - 4;
  const bottomY = height - 4;
  // 输入行位置：在聊天框内部，底部边框上方一行
  // Box 从 y=1 开始，高度 mainHeight-2，所以底部边框在 y=1+(mainHeight-2)-1 = mainHeight-2
  // 输入行应该在底部边框上方：mainHeight-3
  const inputY = mainHeight - 3;

  // 创建面板
  let isProcessing = false;
  const startTime = Date.now();
  let totalRequests = 0;
  let successRequests = 0;
  let failedRequests = 0;
  let totalLatency = 0;
  let chatHistory: Message[] = [];

  // 聊天面板高度减2：底部边框占1行，输入行占1行
  const chatPanel = new ChatPanel(1, 1, chatWidth, mainHeight - 2, {
    onSend: async (msg) => {
      if (isProcessing) return;

      isProcessing = true;
      chatPanel.setProcessing(true);
      const reqStart = Date.now();
      engine.render();

      try {
        const result = await agent.runWithHistory(chatHistory, msg);
        const reqLatency = Date.now() - reqStart;
        totalRequests++;
        successRequests++;
        totalLatency += reqLatency;

        // 更新状态面板
        statusPanel.updateData({
          uptime: Date.now() - startTime,
          agents: { total: 1, online: 1, busy: 0 },
        });

        // 更新性能面板
        metricsPanel.recordRequest(true);
        metricsPanel.recordLatency(reqLatency);
        if (result.totalUsage) {
          metricsPanel.recordTokens(result.totalUsage.promptTokens, result.totalUsage.completionTokens);
        }

        // 更新 Token 面板
        if (result.totalUsage) {
          tokensPanel.recordUsage(result.totalUsage.promptTokens, result.totalUsage.completionTokens);
        }
        tokensPanel.updateContext({
          messages: result.messages.length,
        });

        const lastAssistant = result.messages
          .filter((m) => m.role === 'assistant')
          .pop();

        if (lastAssistant) {
          chatPanel.addMessage({
            role: 'assistant',
            content: lastAssistant.content,
            timestamp: new Date(),
          });
        }

        // 保存对话历史（排除 system 消息，避免重复添加）
        chatHistory = result.messages.filter((m) => m.role !== 'system');
      } catch (error) {
        totalRequests++;
        failedRequests++;
        metricsPanel.recordRequest(false);
        chatPanel.addMessage({
          role: 'assistant',
          content: `[ERR] ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
        });
      } finally {
        isProcessing = false;
        chatPanel.setProcessing(false);
        engine.render();
      }
    },
  }, Theme.chatPanel, inputY);

  // 右侧面板
  const statusPanelHeight = 8;
  const metricsPanelHeight = 8;
  const tokensPanelHeight = mainHeight - statusPanelHeight - metricsPanelHeight - 4;

  const statusPanel = new StatusPanel(rightX, 1, rightWidth, statusPanelHeight, Theme.statusPanel);
  const metricsPanel = new MetricsPanel(rightX, statusPanelHeight + 2, rightWidth, metricsPanelHeight, Theme.metricsPanel);
  const tokensPanel = new TokensPanel(rightX, statusPanelHeight + metricsPanelHeight + 3, rightWidth, tokensPanelHeight, {}, Theme.tokensPanel);

  // 底部面板
  const bottomPanelWidth = Math.floor(width / 3);
  const agentsPanel = new AgentsPanel(1, bottomY, bottomPanelWidth, 3, Theme.success);
  const toolsPanel = new ToolsPanel(bottomPanelWidth + 1, bottomY, bottomPanelWidth, 3, {}, Theme.warning);
  const logsPanel = new LogsPanel(bottomPanelWidth * 2 + 2, bottomY, width - bottomPanelWidth * 2 - 2, 3, {}, Theme.info);

  // 重定向日志输出到 LogsPanel
  setLogOutput((level: LogLevel, entry: LogEntry) => {
    logsPanel.addEntry({
      level,
      module: entry.module || 'system',
      message: entry.message,
      timestamp: new Date(entry.timestamp),
    });
  });

  // 定时更新系统指标（每2秒）
  setInterval(() => {
    const mem = process.memoryUsage();
    statusPanel.updateData({
      uptime: Date.now() - startTime,
      memory: {
        used: mem.heapUsed,
        total: mem.heapTotal,
        heap: mem.heapUsed,
        heapTotal: mem.heapTotal,
      },
      agents: { total: 1, online: 1, busy: isProcessing ? 1 : 0 },
    });
    engine.render();
  }, 2000);

  // 帮助面板（居中）
  const helpWidth = Math.min(60, Math.floor(width * 0.8));
  const helpHeight = Math.min(20, Math.floor(height * 0.7));
  const helpX = Math.floor((width - helpWidth) / 2);
  const helpY = Math.floor((height - helpHeight) / 2);
  const helpPanel = new HelpPanel(helpX, helpY, helpWidth, helpHeight);

  // 添加欢迎消息
  chatPanel.addMessage({
    role: 'system',
    content: '欢迎使用归藏 TUI！\n\n我已准备就绪，可以帮你完成以下任务：\n- [F] 读取文件内容\n- [W] 写入文件\n- [S] 执行 Shell 命令\n\n试试输入一些指令吧！',
    timestamp: new Date(),
  });

  // 聊天面板始终激活（光标始终在输入行）
  chatPanel.setActive(true);
  let showHelp = false;

  // 所有键盘输入始终发送到聊天面板
  engine.onPanelKey((event) => {
    chatPanel.handleKey(event);
  });

  // 监听终端窗口大小变化
  process.stdout.on('resize', () => {
    engine.handleResize();
  });

  engine.onKey('q', () => {
    engine.stop();
    process.exit(0);
  });

  engine.onKey('escape', () => {
    engine.stop();
    process.exit(0);
  });

  engine.onKey('f1', () => {
    showHelp = !showHelp;
    engine.render();
  });

  engine.onKey('?', () => {
    showHelp = !showHelp;
    engine.render();
  });

  // 渲染回调
  engine.onRender(() => {
    engine.clearBuffer();

    // 渲染标题
    const title = '~~ 归藏 TUI -- 万物归藏，一念即达';
    const titleWidth = getStringWidth(title);
    const titleX = Math.floor((width - titleWidth) / 2);
    engine.putColorText(titleX, 0, colorize(title, Theme.accent), Theme.accent);

    // 渲染面板
    chatPanel.render(engine);
    statusPanel.render(engine);
    metricsPanel.render(engine);
    tokensPanel.render(engine);
    agentsPanel.render(engine);
    toolsPanel.render(engine);
    logsPanel.render(engine);

    if (showHelp) {
      helpPanel.render(engine);
    }

    // 渲染状态栏
    const statusBar = ' Tab:切换 | ?:帮助 | q:退出 | 输入消息按回车发送 ';
    const statusWidth = getStringWidth(statusBar);
    const statusX = Math.floor((width - statusWidth) / 2);
    engine.putColorText(statusX, height - 1, colorize(statusBar, Theme.textMuted), Theme.textMuted);
  });

  // 启动自动刷新
  engine.startAutoRefresh(100);
  engine.render();
}

main().catch((error) => {
  console.error('[ERR] TUI 启动失败:', error);
  process.exit(1);
});
