/**
 * 上下文帮助组件
 * 根据当前焦点显示相关帮助
 */

import { TUIEngine, type KeyEvent, type Rect } from '../engine.js';
import { Colors, colorize, dim } from '../theme.js';
import { truncateString } from '../utils.js';

/** 帮助提示 */
export interface HelpTip {
  id: string;
  context: string;
  title: string;
  content: string;
  shortcut?: string;
  priority?: number;
}

/** 上下文帮助选项 */
export interface ContextHelpOptions {
  rect?: Rect;
  autoHide?: boolean;
  hideDelay?: number;
}

/** 上下文帮助组件 */
export class ContextHelp {
  private engine: TUIEngine;
  private rect?: Rect;
  private tips: HelpTip[] = [];
  private currentTip: HelpTip | null = null;
  private shownTips: Set<string> = new Set();
  private listeners: Array<(tip: HelpTip | null) => void> = [];

  constructor(engine: TUIEngine, options?: ContextHelpOptions) {
    this.engine = engine;
    this.rect = options?.rect;
  }

  /** 注册帮助提示 */
  registerTip(tip: HelpTip): void {
    this.tips.push(tip);
  }

  /** 批量注册帮助提示 */
  registerTips(tips: HelpTip[]): void {
    this.tips.push(...tips);
  }

  /** 显示上下文帮助 */
  showForContext(context: string): void {
    // 找到最相关的提示
    const relevantTips = this.tips
      .filter(tip => tip.context === context || tip.context === '*')
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    if (relevantTips.length > 0) {
      // 优先显示未显示过的提示
      const newTip = relevantTips.find(tip => !this.shownTips.has(tip.id));
      if (newTip) {
        this.showTip(newTip);
      } else if (relevantTips[0]) {
        this.showTip(relevantTips[0]);
      }
    }
  }

  /** 显示提示 */
  showTip(tip: HelpTip): void {
    this.currentTip = tip;
    this.shownTips.add(tip.id);
    this.notifyListeners(tip);
  }

  /** 隐藏提示 */
  hideTip(): void {
    this.currentTip = null;
    this.notifyListeners(null);
  }

  /** 显示工具提示 */
  showTooltip(content: string, _position?: { x: number; y: number }): void {
    const tip: HelpTip = {
      id: `tooltip_${Date.now()}`,
      context: 'tooltip',
      title: '',
      content,
    };
    this.currentTip = tip;
    this.notifyListeners(tip);
  }

  /** 隐藏工具提示 */
  hideTooltip(): void {
    this.hideTip();
  }

  /** 渲染帮助提示 */
  render(): void {
    if (!this.currentTip || !this.rect) return;

    const { x, y, width, height } = this.rect;
    const tip = this.currentTip;

    // 清空区域
    this.engine.fillRect(this.rect, ' ', Colors.white);
    this.engine.drawBox(this.rect, Colors.brightCyan);

    // 标题
    if (tip.title) {
      this.engine.putColorText(x + 2, y, colorize(` ${tip.title} `, `${Colors.bold}${Colors.brightCyan}`));
    }

    // 内容
    const lines = tip.content.split('\n');
    for (let i = 0; i < Math.min(lines.length, height - 3); i++) {
      const line = truncateString(lines[i], width - 4);
      this.engine.putColorText(x + 2, y + 1 + i, line);
    }

    // 快捷键提示
    if (tip.shortcut) {
      const shortcutText = `快捷键: ${tip.shortcut}`;
      this.engine.putColorText(x + 2, y + height - 2, dim(shortcutText));
    }

    // 关闭提示
    this.engine.putColorText(x + width - 10, y + height - 2, dim('按 ? 关闭'));
  }

  /** 处理按键 */
  handleKey(event: KeyEvent): boolean {
    if (event.name === '?' || (event.key === '?' && !event.ctrl)) {
      if (this.currentTip) {
        this.hideTip();
        return true;
      }
    }
    return false;
  }

  /** 监听提示变化 */
  onTipChange(listener: (tip: HelpTip | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /** 通知监听者 */
  private notifyListeners(tip: HelpTip | null): void {
    for (const listener of this.listeners) {
      listener(tip);
    }
  }

  /** 重置已显示的提示 */
  resetShownTips(): void {
    this.shownTips.clear();
  }

  /** 获取所有注册的提示 */
  getAllTips(): HelpTip[] {
    return [...this.tips];
  }
}

/** 预定义的帮助提示 */
export const DEFAULT_HELP_TIPS: HelpTip[] = [
  // 聊天面板
  {
    id: 'chat_input',
    context: 'chat',
    title: '聊天面板',
    content: '在此输入消息与 AI 对话\n支持多行输入（粘贴多行文本）',
    shortcut: 'Enter 发送',
    priority: 10,
  },
  {
    id: 'chat_history',
    context: 'chat',
    title: '历史消息',
    content: '使用上下箭头浏览历史消息',
    shortcut: '↑ ↓',
    priority: 5,
  },

  // 面板导航
  {
    id: 'panel_nav',
    context: 'panel',
    title: '面板导航',
    content: '使用 Tab 键在面板间切换\n使用 ? 键显示帮助',
    shortcut: 'Tab',
    priority: 10,
  },

  // 搜索
  {
    id: 'search',
    context: 'search',
    title: '搜索功能',
    content: '全局搜索聊天记录、日志和工具调用',
    shortcut: 'Ctrl+F',
    priority: 8,
  },

  // 布局
  {
    id: 'layout',
    context: 'layout',
    title: '布局管理',
    content: '切换不同的面板布局\n支持保存自定义布局',
    shortcut: 'F2',
    priority: 6,
  },

  // 会话
  {
    id: 'session',
    context: 'session',
    title: '会话管理',
    content: '创建和切换不同的会话\n支持会话导出和导入',
    shortcut: 'Ctrl+N',
    priority: 7,
  },

  // 主题
  {
    id: 'theme',
    context: 'theme',
    title: '主题切换',
    content: '切换深色/浅色主题',
    shortcut: 'Ctrl+T',
    priority: 4,
  },
];
