/**
 * Box 组件
 * 带边框的容器组件
 */

import type { Rect } from '../engine.js';
import type { TUIEngine } from '../engine.js';
import { Colors, colorize, Theme } from '../theme.js';
import { truncateString } from '../utils.js';

export interface BoxOptions {
  title?: string;
  border?: boolean;
  borderColor?: string;
  active?: boolean;
  accentColor?: string; // 面板强调色
  inputMode?: boolean; // 是否为输入模式（ChatPanel使用）
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
      inputMode: false,
      ...options,
    };
  }

  /** 设置输入模式 */
  setInputMode(enabled: boolean): void {
    (this.options as { inputMode: boolean }).inputMode = enabled;
  }

  /** 获取内容区域高度 */
  private getContentHeight(): number {
    const { height } = this.rect;
    const { border, inputMode } = this.options;
    // 有边框时：高度 - 2（上下边框各占1行）
    // 如果是输入模式，再减1预留输入行空间
    const borderReduction = border ? 2 : 0;
    const inputReduction = inputMode ? 1 : 0;
    return height - borderReduction - inputReduction;
  }

  /** 设置内容 */
  setContent(lines: string[]): void {
    this.content = lines;
  }

  /** 追加内容 */
  appendLine(line: string): void {
    this.content.push(line);
    // 自动滚动到底部
    const maxVisible = this.getContentHeight();
    if (this.content.length > maxVisible) {
      this.scrollOffset = this.content.length - maxVisible;
    }
  }

  /** 滚动 */
  scroll(delta: number): void {
    const maxVisible = this.getContentHeight();
    const maxScroll = Math.max(0, this.content.length - maxVisible);
    this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset + delta));
  }

  /** 滚动到底部 */
  scrollToBottom(): void {
    const maxVisible = this.getContentHeight();
    this.scrollOffset = Math.max(0, this.content.length - maxVisible);
  }

  /** 渲染到引擎 */
  render(engine: TUIEngine): void {
    const { x, y, width } = this.rect;
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

    // 绘制内容
    const contentY = this.options.border ? y + 1 : y;
    const contentHeight = this.getContentHeight();
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
