/**
 * Box 组件
 * 带边框的容器组件
 */

import type { Rect } from '../engine.js';
import type { TUIEngine } from '../engine.js';
import { Colors, colorize, Theme } from '../theme.js';

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
    (code >= 0x1F1E0 && code <= 0x1F1FF) ||
    (code >= 0x2702 && code <= 0x27B0) ||
    (code >= 0x24C2 && code <= 0x1F251)
  ) {
    return 2;
  }

  return 1;
}

/**
 * 计算字符串的显示宽度（跳过ANSI转义序列）
 */
function getStringDisplayWidth(str: string): number {
  let width = 0;
  let inEscape = false;

  for (const char of str) {
    if (char === '\x1b') {
      inEscape = true;
      continue;
    }
    if (inEscape) {
      if (char === 'm') {
        inEscape = false;
      }
      continue;
    }
    width += getCharWidth(char);
  }

  return width;
}

/**
 * 截断字符串到指定宽度（考虑多字节字符和ANSI转义序列）
 */
function truncateString(str: string, maxWidth: number): string {
  let width = 0;
  let result = '';
  let inEscape = false;

  for (const char of str) {
    // 处理ANSI转义序列
    if (char === '\x1b') {
      inEscape = true;
      result += char;
      continue;
    }
    if (inEscape) {
      result += char;
      if (char === 'm') {
        inEscape = false;
      }
      continue;
    }

    const charWidth = getCharWidth(char);
    if (width + charWidth > maxWidth) {
      break;
    }
    result += char;
    width += charWidth;
  }

  return result;
}

export interface BoxOptions {
  title?: string;
  border?: boolean;
  borderColor?: string;
  active?: boolean;
}

export class Box {
  readonly rect: Rect;
  readonly options: BoxOptions;
  private content: string[] = [];
  private scrollOffset = 0;

  constructor(rect: Rect, options: BoxOptions = {}) {
    this.rect = rect;
    this.options = {
      border: true,
      borderColor: Theme.panelBorder,
      ...options,
    };
  }

  /** 设置内容 */
  setContent(lines: string[]): void {
    this.content = lines;
  }

  /** 追加内容 */
  appendLine(line: string): void {
    this.content.push(line);
    // 自动滚动到底部（预留输入行空间）
    const maxVisible = this.rect.height - 3;
    if (this.content.length > maxVisible) {
      this.scrollOffset = this.content.length - maxVisible;
    }
  }

  /** 滚动 */
  scroll(delta: number): void {
    const maxVisible = this.rect.height - 3;
    const maxScroll = Math.max(0, this.content.length - maxVisible);
    this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset + delta));
  }

  /** 滚动到底部 */
  scrollToBottom(): void {
    const maxVisible = this.rect.height - 3;
    this.scrollOffset = Math.max(0, this.content.length - maxVisible);
  }

  /** 渲染到引擎 */
  render(engine: TUIEngine): void {
    const { x, y, width, height } = this.rect;
    const borderColor = this.options.active ? Theme.borderFocused : this.options.borderColor;

    if (this.options.border) {
      // 绘制边框
      engine.drawBox(this.rect, borderColor);

      // 绘制标题
      if (this.options.title) {
        const titleText = ` ${this.options.title} `;
        const titleX = x + 2;
        const titleY = y;

        // 清空标题区域背景
        for (let i = 0; i < titleText.length; i++) {
          engine.putChar(titleX + i, titleY, ' ');
        }

        // 写入标题
        engine.putColorText(titleX, titleY, colorize(titleText, Theme.panelTitle), Theme.panelTitle);
      }
    }

    // 绘制内容（预留输入行空间）
    const contentY = this.options.border ? y + 1 : y;
    const contentHeight = this.options.border ? height - 3 : height - 1; // 预留输入行
    const contentWidth = this.options.border ? width - 2 : width;

    const startIndex = this.scrollOffset;
    const endIndex = Math.min(this.content.length, startIndex + contentHeight);

    for (let i = startIndex; i < endIndex; i++) {
      const line = this.content[i];
      const lineY = contentY + (i - startIndex);

      // 截断过长的行（考虑多字节字符）
      const displayLine = truncateString(line, contentWidth);
      engine.putColorText(x + 1, lineY, displayLine, Colors.white);
    }
  }
}
