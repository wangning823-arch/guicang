/**
 * 历史面板
 * 显示和管理会话历史
 */

import { TUIEngine, type KeyEvent, type Rect } from '../engine.js';
import { Colors, Theme, colorize, dim, bold } from '../theme.js';
import { Box } from '../components/box.js';
import { getStringWidth, truncateString } from '../utils.js';
import { SessionManager, type SessionInfo } from '../managers/session.js';

/** 历史面板选项 */
export interface HistoryPanelOptions {
  rect: Rect;
  sessionManager: SessionManager;
}

/** 历史面板 */
export class HistoryPanel {
  private engine: TUIEngine;
  private box: Box;
  private sessionManager: SessionManager;
  private selectedIndex: number = 0;
  private sessions: SessionInfo[] = [];

  constructor(engine: TUIEngine, options: HistoryPanelOptions) {
    this.engine = engine;
    this.sessionManager = options.sessionManager;
    this.box = new Box({
      title: '📋 会话历史',
      rect: options.rect,
      accentColor: Colors.brightMagenta,
    });

    this.refreshSessions();
  }

  /** 刷新会话列表 */
  refreshSessions(): void {
    this.sessions = this.sessionManager.getSessionInfos();
    // 按更新时间倒序
    this.sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /** 渲染面板 */
  render(): void {
    const { rect } = this.box.getRect() as { rect: Rect };
    const contentHeight = rect.height - 2;
    const contentWidth = rect.width - 2;

    const lines: string[] = [];

    if (this.sessions.length === 0) {
      lines.push(dim('  暂无会话历史'));
    } else {
      for (let i = 0; i < this.sessions.length; i++) {
        const session = this.sessions[i];
        const isSelected = i === this.selectedIndex;

        const name = truncateString(session.name, contentWidth - 15);
        const date = session.updatedAt.toLocaleDateString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
        });
        const time = session.updatedAt.toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const msgCount = `${session.messageCount}条消息`;

        let line = '';
        if (isSelected) {
          line = colorize(` ▸ ${name}`, Colors.brightWhite);
          line += colorize(` ${date} ${time}`, Colors.brightBlack);
          line += colorize(` (${msgCount})`, Colors.brightMagenta);
        } else {
          line = `   ${colorize(name, Colors.white)}`;
          line += dim(` ${date} ${time}`);
          line += dim(` (${msgCount})`);
        }

        lines.push(line);
      }
    }

    // 填充剩余空间
    while (lines.length < contentHeight) {
      lines.push('');
    }

    this.box.setContent(lines.slice(0, contentHeight));
    this.box.render();
  }

  /** 处理按键 */
  handleKey(event: KeyEvent): boolean {
    if (event.name === 'up') {
      this.selectPrev();
      return true;
    }
    if (event.name === 'down') {
      this.selectNext();
      return true;
    }
    if (event.name === 'return') {
      this.selectCurrent();
      return true;
    }
    return false;
  }

  /** 选择上一个 */
  selectPrev(): void {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
    }
  }

  /** 选择下一个 */
  selectNext(): void {
    if (this.selectedIndex < this.sessions.length - 1) {
      this.selectedIndex++;
    }
  }

  /** 选择当前项 */
  selectCurrent(): SessionInfo | null {
    if (this.sessions.length > 0 && this.selectedIndex < this.sessions.length) {
      const session = this.sessions[this.selectedIndex];
      this.sessionManager.setCurrentSession(session.id);
      return session;
    }
    return null;
  }

  /** 获取选中的会话 */
  getSelectedSession(): SessionInfo | null {
    if (this.sessions.length > 0 && this.selectedIndex < this.sessions.length) {
      return this.sessions[this.selectedIndex];
    }
    return null;
  }

  /** 设置选中索引 */
  setSelectedIndex(index: number): void {
    if (index >= 0 && index < this.sessions.length) {
      this.selectedIndex = index;
    }
  }

  /** 获取会话数量 */
  getSessionCount(): number {
    return this.sessions.length;
  }
}
