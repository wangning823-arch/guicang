/**
 * TUI 应用主程序
 * 管理所有面板和焦点切换
 */

import { TUIEngine, type KeyEvent } from './engine.js';
import { ChatPanel, type ChatMessage } from './panels/chat.js';
import { StatusPanel, type StatusPanelData } from './panels/status.js';
import { MetricsPanel, type MetricsPanelData } from './panels/metrics.js';
import { TokensPanel, type TokenUsageData } from './panels/tokens.js';
import { AgentsPanel, type AgentInfo } from './panels/agents.js';
import { ToolsPanel, type ToolCallEntry } from './panels/tools.js';
import { LogsPanel, type LogEntry } from './panels/logs.js';
import { HelpPanel } from './panels/help.js';
import { Theme, colorize } from './theme.js';

/** 面板类型 */
type PanelType = 'chat' | 'status' | 'metrics' | 'tokens' | 'agents' | 'tools' | 'logs';

/** 面板项 */
interface PanelItem {
  panel: ChatPanel | StatusPanel | MetricsPanel | TokensPanel | AgentsPanel | ToolsPanel | LogsPanel;
  rect: { x: number; y: number; width: number; height: number };
}

/** TUI 应用配置 */
export interface TUIAppOptions {
  onCommand?: (cmd: string, args: string[]) => void;
  onInput?: (text: string) => void;
}

export class TUIApp {
  private engine: TUIEngine;
  private panels: Record<PanelType, PanelItem> = {} as Record<PanelType, PanelItem>;
  private focusOrder: PanelType[] = ['chat', 'status', 'metrics', 'tokens', 'agents', 'tools', 'logs'];
  private focusIndex = 0;
  private helpPanel: HelpPanel;
  private options: TUIAppOptions;
  private statusBarY = 0;
  private confirmExit = false;

  constructor(options: TUIAppOptions = {}) {
    this.engine = new TUIEngine();
    this.options = options;
    this.helpPanel = new HelpPanel(10, 5, 60, 30);
  }

  /** 初始化 */
  async init(): Promise<void> {
    await this.engine.init();
    this.calculateLayout();

    // 注册键盘处理
    this.engine.onKey('f1', () => this.helpPanel.toggle());
    this.engine.onKey('f5', () => this.engine.render());
    this.engine.onKey('tab', () => this.cycleFocus(1));
    this.engine.onKey('escape', () => this.handleEscape());
    this.engine.onKey('q', (e) => this.handleQuit(e));

    // 注册面板键盘处理器
    this.engine.onPanelKey((event) => this.handleGlobalKey(event));

    // 启动自动刷新
    this.engine.startAutoRefresh(500);

    this.engine.render();
  }

  /** 计算布局 */
  private calculateLayout(): void {
    const width = this.engine.getWidth();
    const height = this.engine.getHeight();

    // 状态栏在最底部
    this.statusBarY = height - 1;

    // 左侧：Chat 面板（占 55% 宽度）
    const chatWidth = Math.floor(width * 0.55);
    const chatHeight = height - 1; // 减去状态栏

    this.panels.chat = {
      panel: new ChatPanel(0, 0, chatWidth, chatHeight, {
        onSend: (msg) => this.options.onInput?.(msg),
      }, Theme.chatPanel, chatHeight - 2),
      rect: { x: 0, y: 0, width: chatWidth, height: chatHeight },
    };

    // 右侧：多个面板（使用固定最小高度）
    const rightX = chatWidth;
    const rightWidth = width - chatWidth;
    const minPanelHeight = 6; // 最小面板高度
    const availableHeight = height - 1; // 减去状态栏

    // 计算每个面板的高度（确保至少有最小高度）
    const rightPanelHeight = Math.max(minPanelHeight, Math.floor(availableHeight / 6));

    this.panels.status = {
      panel: new StatusPanel(rightX, 0, rightWidth, rightPanelHeight),
      rect: { x: rightX, y: 0, width: rightWidth, height: rightPanelHeight },
    };

    this.panels.metrics = {
      panel: new MetricsPanel(rightX, rightPanelHeight, rightWidth, rightPanelHeight),
      rect: { x: rightX, y: rightPanelHeight, width: rightWidth, height: rightPanelHeight },
    };

    this.panels.tokens = {
      panel: new TokensPanel(rightX, rightPanelHeight * 2, rightWidth, rightPanelHeight),
      rect: { x: rightX, y: rightPanelHeight * 2, width: rightWidth, height: rightPanelHeight },
    };

    this.panels.agents = {
      panel: new AgentsPanel(rightX, rightPanelHeight * 3, rightWidth, rightPanelHeight),
      rect: { x: rightX, y: rightPanelHeight * 3, width: rightWidth, height: rightPanelHeight },
    };

    this.panels.tools = {
      panel: new ToolsPanel(rightX, rightPanelHeight * 4, rightWidth, rightPanelHeight),
      rect: { x: rightX, y: rightPanelHeight * 4, width: rightWidth, height: rightPanelHeight },
    };

    this.panels.logs = {
      panel: new LogsPanel(rightX, rightPanelHeight * 5, rightWidth, availableHeight - rightPanelHeight * 5),
      rect: { x: rightX, y: rightPanelHeight * 5, width: rightWidth, height: availableHeight - rightPanelHeight * 5 },
    };

    // 设置第一个面板为激活状态
    this.setActivePanel(this.focusOrder[this.focusIndex]);
  }

  /** 设置激活面板 */
  private setActivePanel(type: PanelType): void {
    // 取消所有面板的激活状态
    for (const key of Object.keys(this.panels) as PanelType[]) {
      const p = this.panels[key]?.panel;
      if (p instanceof ChatPanel) {
        p.setActive(false);
      }
    }

    // 设置当前面板为激活状态
    const current = this.panels[type]?.panel;
    if (current instanceof ChatPanel) {
      current.setActive(true);
    }
  }

  /** 循环切换焦点 */
  private cycleFocus(direction: number): void {
    this.focusIndex = (this.focusIndex + direction + this.focusOrder.length) % this.focusOrder.length;
    this.setActivePanel(this.focusOrder[this.focusIndex]);
    this.renderStatusBar();
    this.engine.render();
  }

  /** 处理 Escape 键 */
  private handleEscape(): void {
    if (this.helpPanel.isVisible()) {
      this.helpPanel.hide();
    } else {
      // 显示确认退出提示
      this.showExitConfirm();
    }
  }

  /** 显示退出确认 */
  private showExitConfirm(): void {
    this.confirmExit = true;
    this.engine.render();
  }

  /** 渲染退出确认对话框 */
  private renderExitConfirm(): void {
    if (!this.confirmExit) return;

    const width = this.engine.getWidth();
    const height = this.engine.getHeight();

    const dialogWidth = 40;
    const dialogHeight = 5;
    const dialogX = Math.floor((width - dialogWidth) / 2);
    const dialogY = Math.floor((height - dialogHeight) / 2);

    // 绘制背景
    this.engine.fillRect({ x: dialogX, y: dialogY, width: dialogWidth, height: dialogHeight }, ' ', Theme.bg);

    // 绘制边框
    this.engine.drawBox({ x: dialogX, y: dialogY, width: dialogWidth, height: dialogHeight }, Theme.warning);

    // 绘制标题
    this.engine.putColorText(
      dialogX + 2,
      dialogY,
      colorize(' 确认退出 ', Theme.warning),
      Theme.warning,
    );

    // 绘制内容
    this.engine.putColorText(
      dialogX + 2,
      dialogY + 2,
      colorize('确定要退出 TUI 吗？', Theme.text),
      Theme.text,
    );

    // 绘制按钮
    this.engine.putColorText(
      dialogX + 10,
      dialogY + 3,
      colorize('[Y] 确定  [N] 取消', Theme.primary),
      Theme.primary,
    );
  }

  /** 处理 Q 键退出 */
  private handleQuit(event: KeyEvent): void {
    // Q 键需要 Ctrl+Q 才能退出，避免误触
    if (event.ctrl) {
      this.engine.stop();
      process.exit(0);
    }
  }

  /** 处理全局按键 */
  private handleGlobalKey(event: KeyEvent): void {
    // 退出确认状态
    if (this.confirmExit) {
      if (event.name === 'y' || event.name === 'Y' || event.name === 'return') {
        this.engine.stop();
        process.exit(0);
      } else if (event.name === 'n' || event.name === 'N' || event.name === 'escape') {
        this.confirmExit = false;
        this.engine.render();
      }
      return;
    }

    // 帮助面板打开时，任何键都关闭帮助
    if (this.helpPanel.isVisible()) {
      if (event.name === 'f1' || event.name === 'escape' || event.name === 'q') {
        this.helpPanel.hide();
        this.engine.render();
      }
      return;
    }

    // 命令输入模式（当 Chat 面板激活时）
    if (this.focusOrder[this.focusIndex] === 'chat') {
      const chatPanel = this.panels.chat?.panel;
      if (chatPanel instanceof ChatPanel) {
        chatPanel.handleKey(event);
      }
    }
  }

  /** 渲染状态栏 */
  private renderStatusBar(): void {
    const width = this.engine.getWidth();
    const y = this.statusBarY;

    // 清空状态栏
    this.engine.fillRect({ x: 0, y, width, height: 1 }, ' ');

    // 显示当前焦点面板
    const focusText = ` 焦点: ${this.focusOrder[this.focusIndex].toUpperCase()} `;
    this.engine.putColorText(0, y, colorize(focusText, Theme.primary), Theme.primary);

    // 显示帮助提示
    const helpText = ' F1:帮助 Tab:切换 Ctrl+C:退出 ';
    this.engine.putColorText(width - helpText.length, y, colorize(helpText, Theme.textMuted), Theme.textMuted);
  }

  /** 更新状态数据 */
  updateStatus(data: StatusPanelData): void {
    const panel = this.panels.status?.panel;
    if (panel instanceof StatusPanel) {
      panel.updateData(data);
    }
  }

  /** 更新指标数据 */
  updateMetrics(data: MetricsPanelData): void {
    const panel = this.panels.metrics?.panel;
    if (panel instanceof MetricsPanel) {
      panel.updateData(data);
    }
  }

  /** 更新 Token 数据 */
  updateTokens(data: TokenUsageData): void {
    const panel = this.panels.tokens?.panel;
    if (panel instanceof TokensPanel) {
      panel.recordUsage(data.prompt, data.completion);
    }
  }

  /** 更新 Agent 列表 */
  updateAgents(agents: AgentInfo[]): void {
    const panel = this.panels.agents?.panel;
    if (panel instanceof AgentsPanel) {
      panel.updateAgents(agents);
    }
  }

  /** 添加工具调用记录 */
  addToolCall(entry: ToolCallEntry): void {
    const panel = this.panels.tools?.panel;
    if (panel instanceof ToolsPanel) {
      panel.addEntry(entry);
    }
  }

  /** 添加日志 */
  addLog(entry: LogEntry): void {
    const panel = this.panels.logs?.panel;
    if (panel instanceof LogsPanel) {
      panel.addEntry(entry);
    }
  }

  /** 添加聊天消息 */
  addMessage(message: ChatMessage): void {
    const panel = this.panels.chat?.panel;
    if (panel instanceof ChatPanel) {
      panel.addMessage(message);
    }
  }

  /** 清空聊天 */
  clearChat(): void {
    const panel = this.panels.chat?.panel;
    if (panel instanceof ChatPanel) {
      panel.clearHistory();
    }
  }

  /** 渲染 */
  render(): void {
    // 渲染所有面板
    for (const key of Object.keys(this.panels) as PanelType[]) {
      const { panel } = this.panels[key];
      panel.render(this.engine);
    }

    // 渲染焦点指示器
    this.renderFocusIndicator();

    // 渲染状态栏
    this.renderStatusBar();

    // 渲染帮助面板（覆盖在其他面板上）
    if (this.helpPanel.isVisible()) {
      this.helpPanel.render(this.engine);
    }

    // 渲染退出确认对话框（最顶层）
    this.renderExitConfirm();

    // 渲染差异
    this.engine.render();
  }

  /** 渲染焦点指示器 */
  private renderFocusIndicator(): void {
    const currentType = this.focusOrder[this.focusIndex];
    const current = this.panels[currentType];
    if (!current) return;

    const { rect } = current;
    const borderColor = Theme.borderFocused;

    // 绘制高亮边框
    this.engine.drawBox({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }, borderColor);

    // 在标题位置显示焦点标记
    const focusMarker = ' * ';
    this.engine.putColorText(rect.x + 2, rect.y, colorize(focusMarker, Theme.accent), Theme.accent);
  }

  /** 停止 */
  stop(): void {
    this.engine.stop();
  }
}
