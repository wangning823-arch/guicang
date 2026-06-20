/**
 * Box 组件
 * 带边框的容器组件
 */

import type { Rect } from '../engine.js';
import type { TUIEngine } from '../engine.js';
import { Colors, colorize, Theme } from '../theme.js';

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
    // 自动滚动到底部
    const maxVisible = this.rect.height - 2;
    if (this.content.length > maxVisible) {
      this.scrollOffset = this.content.length - maxVisible;
    }
  }

  /** 滚动 */
  scroll(delta: number): void {
    const maxVisible = this.rect.height - 2;
    const maxScroll = Math.max(0, this.content.length - maxVisible);
    this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset + delta));
  }

  /** 滚动到底部 */
  scrollToBottom(): void {
    const maxVisible = this.rect.height - 2;
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

    // 绘制内容
    const contentY = this.options.border ? y + 1 : y;
    const contentHeight = this.options.border ? height - 2 : height;
    const contentWidth = this.options.border ? width - 2 : width;

    const startIndex = this.scrollOffset;
    const endIndex = Math.min(this.content.length, startIndex + contentHeight);

    for (let i = startIndex; i < endIndex; i++) {
      const line = this.content[i];
      const lineY = contentY + (i - startIndex);

      // 截断过长的行
      const displayLine = line.slice(0, contentWidth);
      engine.putColorText(x + 1, lineY, displayLine, Colors.white);
    }
  }
}
