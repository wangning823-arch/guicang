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

import {
  Agent,
  MimoProvider,
  registerTools,
  FileReadTool,
  FileWriteTool,
  ShellTool,
} from './src/index.js';

import { setLogOutput, type LogLevel, type LogEntry } from './src/core/logger.js';

/**
 * 获取字符的显示宽度
 */
function getCharWidth(char: string): number {
  const code = char.codePointAt(0);
  if (!code) return 1;

  // CJK统一汉字
  if (
    (code >= 0x4E00 && code <= 0x9FFF) ||
    (code >= 0x3400 && code <= 0x4DBF) ||
    (code >= 0x20000 && code <= 0x2A6DF) ||
    (code >= 0xF900 && code <= 0xFAFF) ||
    (code >= 0x2F800 && code <= 0x2FA1F)
  ) {
    return 2;
  }

  // 全角字符
  if (
    (code >= 0xFF01 && code <= 0xFF60) ||
    (code >= 0xFFE0 && code <= 0xFFE6) ||
    (code >= 0x3000 && code <= 0x303F) ||
    (code >= 0xFE30 && code <= 0xFE4F)
  ) {
    return 2;
  }

  // Emoji和特殊符号
  if (
    (code >= 0x1F300 && code <= 0x1F9FF) ||
    (code >= 0x2600 && code <= 0x27BF) ||
    (code >= 0x1F600 && code <= 0x1F64F) ||
    (code >= 0x1F680 && code <= 0x1F6FF) ||
    (code >= 0x1F1E0 && code <= 0x1F1FF)
  ) {
    return 2;
  }

  return 1;
}

/**
 * 获取字符串的显示宽度
 */
function getStringWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    if (char === '\x1b') continue;
    width += getCharWidth(char);
  }
  return width;
}

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
  const inputY = height - 5; // 输入行：聊天框底部边框下方一行

  // 创建面板
  let isProcessing = false;
  const startTime = Date.now();
  let totalRequests = 0;
  let successRequests = 0;
  let failedRequests = 0;
  let totalLatency = 0;
  let chatHistory: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; toolCallId?: string }> = [];

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
