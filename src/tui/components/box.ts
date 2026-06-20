/**
 * Box 组件
 * 带边框的容器组件
 */

import type { Rect } from '../engine.js';
import type { TUIEngine } from '../engine.js';
import { Colors, colorize, Theme } from '../theme.js';

/**
 * 获取字符的显示宽度（统一版本）
 */
function getCharWidth(char: string): number {
  const code = char.codePointAt(0);
  if (!code) return 1;

  // ===== CJK 统一汉字及其扩展 =====
  if (
    (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK统一汉字
    (code >= 0x3400 && code <= 0x4DBF) ||   // CJK扩展A
    (code >= 0x20000 && code <= 0x2A6DF) || // CJK扩展B
    (code >= 0x2A700 && code <= 0x2B73F) || // CJK扩展C
    (code >= 0x2B740 && code <= 0x2B81F) || // CJK扩展D
    (code >= 0x2B820 && code <= 0x2CEAF) || // CJK扩展E
    (code >= 0x2CEB0 && code <= 0x2EBEF) || // CJK扩展F
    (code >= 0x30000 && code <= 0x3134F) || // CJK扩展G
    (code >= 0x31350 && code <= 0x323AF) || // CJK扩展H
    (code >= 0xF900 && code <= 0xFAFF) ||   // CJK兼容汉字
    (code >= 0x2F800 && code <= 0x2FA1F)    // CJK兼容补充
  ) {
    return 2;
  }

  // ===== CJK 标点和符号 =====
  if (
    (code >= 0x3000 && code <= 0x303F) ||   // CJK符号和标点
    (code >= 0xFF01 && code <= 0xFF60) ||   // 全角ASCII
    (code >= 0xFFE0 && code <= 0xFFE6) ||   // 全角货币
    (code >= 0xFE30 && code <= 0xFE4F) ||   // CJK兼容形式
    (code >= 0x3100 && code <= 0x312F) ||   // 注音符号
    (code >= 0x31A0 && code <= 0x31BF) ||   // 注音扩展
    (code >= 0x3200 && code <= 0x32FF)      // 封闭式CJK文字
  ) {
    return 2;
  }

  // ===== Emoji =====
  if (
    (code >= 0x1F300 && code <= 0x1F9FF) || // Emoji
    (code >= 0x1FA00 && code <= 0x1FA6F) || // Emoji扩展A
    (code >= 0x1FA70 && code <= 0x1FAFF) || // Emoji扩展B
    (code >= 0x1F600 && code <= 0x1F64F) || // 表情符号
    (code >= 0x1F680 && code <= 0x1F6FF) || // 交通和地图符号
    (code >= 0x1F1E0 && code <= 0x1F1FF) || // 旗帜符号
    (code >= 0x2600 && code <= 0x27BF) ||   // 杂项符号
    (code >= 0x2300 && code <= 0x23FF) ||   // 技术符号
    (code >= 0x2B50 && code <= 0x2B55) ||   // 星号和圆圈
    (code >= 0x203C && code <= 0x3299)      // CJK特殊符号
  ) {
    return 2;
  }

  // ===== 宽字符块元素 =====
  if (
    (code >= 0x2580 && code <= 0x259F) ||   // 块元素（含 █）
    (code >= 0x25A0 && code <= 0x25FF) ||   // 几何形状
    (code >= 0x2B00 && code <= 0x2BFF)      // 杂项符号和箭头
  ) {
    return 2;
  }

  return 1;
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
  accentColor?: string; // 面板强调色
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
      accentColor: Theme.primary,
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
    // 使用面板强调色作为边框色（不再仅限 active 状态）
    const borderColor = this.options.accentColor || this.options.borderColor || Theme.panelBorder;

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

        // 使用面板强调色写入标题
        engine.putColorText(titleX, titleY, colorize(titleText, this.options.accentColor || Theme.panelTitle), this.options.accentColor || Theme.panelTitle);
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
