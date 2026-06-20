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
  private isProcessing = false;

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

    // 清理消息内容（去除 markdown 格式）
    const cleanContent = this.stripMarkdown(message.content);

    // 添加消息内容（自动换行）
    const maxLineLength = (this.box as unknown as { rect: { width: number } }).rect.width - 4;
    const lines = this.wrapText(cleanContent, maxLineLength);

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

  /** 清理 markdown 格式 */
  private stripMarkdown(text: string): string {
    return text
      // 移除粗体标记
      .replace(/\*\*(.*?)\*\*/g, '$1')
      // 移除斜体标记
      .replace(/\*(.*?)\*/g, '$1')
      // 移除代码块
      .replace(/```[\s\S]*?```/g, (match) => {
        return match.replace(/```\w*\n?/g, '').replace(/```/g, '');
      })
      // 移除行内代码
      .replace(/`(.*?)`/g, '$1')
      // 移除链接
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // 移除标题标记
      .replace(/^#{1,6}\s+/gm, '')
      // 移除列表标记
      .replace(/^[\s]*[-*+]\s+/gm, '• ')
      .replace(/^[\s]*\d+\.\s+/gm, '  ')
      // 移除引用标记
      .replace(/^>\s+/gm, '')
      // 移除水平线
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // 移除多余的空行
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /** 包装文本 */
  private wrapText(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      // 计算段落的显示宽度
      let lineWidth = 0;
      for (const char of paragraph) {
        lineWidth += this.getCharWidth(char);
      }

      if (lineWidth <= maxWidth) {
        lines.push(paragraph);
      } else {
        // 按字符宽度换行
        let currentLine = '';
        let currentWidth = 0;

        for (const char of paragraph) {
          const charWidth = this.getCharWidth(char);

          if (currentWidth + charWidth > maxWidth) {
            // 尝试在空格处换行
            const lastSpace = currentLine.lastIndexOf(' ');
            if (lastSpace > 0 && currentWidth > maxWidth * 0.5) {
              lines.push(currentLine.slice(0, lastSpace));
              currentLine = currentLine.slice(lastSpace + 1);
              currentWidth = 0;
              // 重新计算当前行宽度
              for (const c of currentLine) {
                currentWidth += this.getCharWidth(c);
              }
            } else {
              lines.push(currentLine);
              currentLine = '';
              currentWidth = 0;
            }
          }

          currentLine += char;
          currentWidth += charWidth;
        }

        if (currentLine) {
          lines.push(currentLine);
        }
      }
    }

    return lines;
  }

  /** 获取字符显示宽度 */
  private getCharWidth(char: string): number {
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

  /** 获取字符串显示宽度 */
  private getStringWidth(str: string): number {
    let width = 0;
    for (const char of str) {
      width += this.getCharWidth(char);
    }
    return width;
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

  /** 设置处理状态 */
  setProcessing(processing: boolean): void {
    this.isProcessing = processing;
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

    if (this.isProcessing) {
      // 显示处理中状态
      const loadingText = '⏳ 正在思考...';
      engine.putColorText(inputX, inputY, colorize(loadingText, Theme.warning), Theme.warning);
    } else {
      // 绘制输入提示
      const prompt = '> ';
      const promptWidth = this.getStringWidth(prompt);
      engine.putColorText(inputX, inputY, colorize(prompt, this.isActive ? Theme.accent : Theme.textMuted), Theme.accent);

      // 计算可用宽度（减去提示符宽度）
      const availableWidth = inputWidth - promptWidth;

      // 截取输入内容到可用宽度
      let displayInput = '';
      let currentWidth = 0;
      for (const char of this.inputBuffer) {
        const charWidth = this.getCharWidth(char);
        if (currentWidth + charWidth > availableWidth) break;
        displayInput += char;
        currentWidth += charWidth;
      }

      // 绘制输入内容
      engine.putColorText(inputX + promptWidth, inputY, displayInput, Theme.text);

      // 绘制光标（计算光标的显示位置）
      if (this.isActive) {
        let cursorWidth = 0;
        for (let i = 0; i < this.cursorPos && i < this.inputBuffer.length; i++) {
          cursorWidth += this.getCharWidth(this.inputBuffer[i]);
        }
        const cursorX = inputX + promptWidth + cursorWidth;
        engine.putChar(cursorX, inputY, '█');
      }
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
