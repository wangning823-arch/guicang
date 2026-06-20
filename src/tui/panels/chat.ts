/**
 * 对话面板
 * 交互式聊天界面
 */

import type { TUIEngine, KeyEvent } from '../engine.js';
import { Box as BoxComponent } from '../components/box.js';
import { colorize, Theme } from '../theme.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: string;
  }>;
}

export interface ChatPanelOptions {
  onSend?: (message: string) => void;
}

export class ChatPanel {
  private box: BoxComponent;
  private messages: ChatMessage[] = [];
  private inputBuffer = '';
  private cursorPos = 0;
  private options: ChatPanelOptions;
  private isActive = false;

  constructor(x: number, y: number, width: number, height: number, options: ChatPanelOptions = {}) {
    this.box = new BoxComponent(
      { x, y, width, height },
      { title: '💬 对话', border: true, active: false },
    );
    this.options = options;
  }

  /** 添加消息 */
  addMessage(message: ChatMessage): void {
    this.messages.push(message);

    // 格式化消息
    const timestamp = this.formatTime(message.timestamp);
    const roleIcon = message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : 'ℹ️';
    const roleColor = message.role === 'user' ? Theme.primary : Theme.secondary;

    // 添加消息头
    this.box.appendLine(
      colorize(`${roleIcon} ${timestamp}`, roleColor),
    );

    // 添加消息内容（自动换行）
    const maxLineLength = (this.box as unknown as { rect: { width: number } }).rect.width - 4;
    const lines = this.wrapText(message.content, maxLineLength);

    for (const line of lines) {
      this.box.appendLine(`  ${line}`);
    }

    // 添加工具调用信息
    if (message.toolCalls && message.toolCalls.length > 0) {
      for (const tool of message.toolCalls) {
        const toolIcon = tool.result ? '✅' : '⏳';
        this.box.appendLine(
          colorize(`    └─ ${toolIcon} 调用 ${tool.name}`, Theme.textMuted),
        );
      }
    }

    // 添加空行分隔
    this.box.appendLine('');
  }

  /** 包装文本 */
  private wrapText(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      if (paragraph.length <= maxWidth) {
        lines.push(paragraph);
      } else {
        // 简单换行
        let remaining = paragraph;
        while (remaining.length > maxWidth) {
          let breakPoint = maxWidth;
          // 尝试在空格处换行
          const spaceIndex = remaining.lastIndexOf(' ', maxWidth);
          if (spaceIndex > maxWidth * 0.5) {
            breakPoint = spaceIndex;
          }
          lines.push(remaining.slice(0, breakPoint));
          remaining = remaining.slice(breakPoint);
        }
        if (remaining) {
          lines.push(remaining);
        }
      }
    }

    return lines;
  }

  /** 格式化时间 */
  private formatTime(date: Date): string {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  /** 处理键盘输入 */
  handleKey(event: KeyEvent): void {
    if (!this.isActive) return;

    if (event.name === 'return') {
      // 发送消息
      if (this.inputBuffer.trim()) {
        this.options.onSend?.(this.inputBuffer);
        this.addMessage({
          role: 'user',
          content: this.inputBuffer,
          timestamp: new Date(),
        });
        this.inputBuffer = '';
        this.cursorPos = 0;
      }
    } else if (event.name === 'backspace') {
      // 删除字符
      if (this.cursorPos > 0) {
        this.inputBuffer = this.inputBuffer.slice(0, this.cursorPos - 1) + this.inputBuffer.slice(this.cursorPos);
        this.cursorPos--;
      }
    } else if (event.name === 'delete') {
      // 删除光标后的字符
      if (this.cursorPos < this.inputBuffer.length) {
        this.inputBuffer = this.inputBuffer.slice(0, this.cursorPos) + this.inputBuffer.slice(this.cursorPos + 1);
      }
    } else if (event.name === 'left') {
      // 光标左移
      if (this.cursorPos > 0) {
        this.cursorPos--;
      }
    } else if (event.name === 'right') {
      // 光标右移
      if (this.cursorPos < this.inputBuffer.length) {
        this.cursorPos++;
      }
    } else if (event.name === 'home') {
      // 光标移到行首
      this.cursorPos = 0;
    } else if (event.name === 'end') {
      // 光标移到行尾
      this.cursorPos = this.inputBuffer.length;
    } else if (event.name === 'up') {
      // 滚动历史
      this.box.scroll(-3);
    } else if (event.name === 'down') {
      // 滚动历史
      this.box.scroll(3);
    } else if (event.key && !event.ctrl && !event.meta && event.key.length === 1) {
      // 输入字符
      this.inputBuffer = this.inputBuffer.slice(0, this.cursorPos) + event.key + this.inputBuffer.slice(this.cursorPos);
      this.cursorPos++;
    }
  }

  /** 设置激活状态 */
  setActive(active: boolean): void {
    this.isActive = active;
    (this.box as unknown as { options: { active: boolean } }).options.active = active;
  }

  /** 渲染 */
  render(engine: TUIEngine): void {
    this.box.render(engine);

    // 渲染输入框
    const inputY = this.box.rect.y + this.box.rect.height - 1;
    const inputX = this.box.rect.x + 1;
    const inputWidth = this.box.rect.width - 2;

    // 清空输入行
    engine.fillRect({ x: inputX, y: inputY, width: inputWidth, height: 1 }, ' ');

    // 绘制输入提示
    const prompt = '> ';
    engine.putColorText(inputX, inputY, colorize(prompt, this.isActive ? Theme.accent : Theme.textMuted), Theme.accent);

    // 绘制输入内容
    const displayInput = this.inputBuffer.slice(0, inputWidth - prompt.length);
    engine.putColorText(inputX + prompt.length, inputY, displayInput, Theme.text);

    // 绘制光标
    if (this.isActive) {
      const cursorX = inputX + prompt.length + this.cursorPos;
      engine.putChar(cursorX, inputY, '█');
    }
  }

  /** 获取输入内容 */
  getInput(): string {
    return this.inputBuffer;
  }

  /** 清空输入 */
  clearInput(): void {
    this.inputBuffer = '';
    this.cursorPos = 0;
  }
}
