/**
 * 状态栏组件
 * 显示应用状态信息
 */

import { TUIEngine, type Rect } from '../engine.js';
import { Colors, Theme, colorize, dim } from '../theme.js';
import { getStringWidth, truncateString } from '../utils.js';

/** 状态栏选项 */
export interface StatusBarOptions {
  x: number;
  y: number;
  width: number;
  items?: StatusBarItem[];
  separator?: string;
  backgroundColor?: string;
}

/** 状态栏项目 */
export interface StatusBarItem {
  id: string;
  text: string;
  color?: string;
  icon?: string;
  position?: 'left' | 'center' | 'right';
  tooltip?: string;
}

/** 状态栏组件 */
export class StatusBar {
  private engine: TUIEngine;
  private options: Required<StatusBarOptions>;
  private items: StatusBarItem[] = [];

  constructor(engine: TUIEngine, options: StatusBarOptions) {
    this.engine = engine;
    this.options = {
      separator: dim(' │ '),
      backgroundColor: Colors.bgBrightBlack,
      items: [],
      ...options,
    };
    this.items = this.options.items;
  }

  /** 设置项目 */
  setItems(items: StatusBarItem[]): void {
    this.items = items;
  }

  /** 更新单个项目 */
  updateItem(id: string, updates: Partial<StatusBarItem>): void {
    const item = this.items.find(i => i.id === id);
    if (item) {
      Object.assign(item, updates);
    }
  }

  /** 添加项目 */
  addItem(item: StatusBarItem): void {
    this.items.push(item);
  }

  /** 移除项目 */
  removeItem(id: string): void {
    this.items = this.items.filter(i => i.id !== id);
  }

  /** 渲染状态栏 */
  render(): void {
    const { x, y, width, separator, backgroundColor } = this.options;

    // 填充背景
    const bgLine = ' '.repeat(width);
    this.engine.putColorText(x, y, `${backgroundColor}${bgLine}${Colors.reset}`);

    // 分组项目
    const leftItems = this.items.filter(i => i.position === 'left' || !i.position);
    const centerItems = this.items.filter(i => i.position === 'center');
    const rightItems = this.items.filter(i => i.position === 'right');

    // 渲染左侧项目
    let currentX = x;
    for (let i = 0; i < leftItems.length; i++) {
      const item = leftItems[i];
      const text = this.formatItem(item);
      const textWidth = getStringWidth(text);

      if (currentX + textWidth <= x + width) {
        this.engine.putColorText(currentX, y, text);
        currentX += textWidth;
      }

      // 添加分隔符
      if (i < leftItems.length - 1) {
        const sepWidth = getStringWidth(separator);
        if (currentX + sepWidth <= x + width) {
          this.engine.putColorText(currentX, y, separator);
          currentX += sepWidth;
        }
      }
    }

    // 渲染右侧项目
    const rightTexts = rightItems.map(item => this.formatItem(item));
    const rightTotalWidth = rightTexts.reduce((sum, text) => sum + getStringWidth(text), 0)
      + (rightTexts.length > 0 ? (rightTexts.length - 1) * getStringWidth(separator) : 0);

    let rightX = x + width - rightTotalWidth;
    for (let i = 0; i < rightTexts.length; i++) {
      if (rightX >= currentX) {
        this.engine.putColorText(rightX, y, rightTexts[i]);
      }
      rightX += getStringWidth(rightTexts[i]);

      if (i < rightTexts.length - 1) {
        rightX += getStringWidth(separator);
      }
    }

    // 渲染居中项目
    if (centerItems.length > 0) {
      const centerTexts = centerItems.map(item => this.formatItem(item));
      const centerTotalWidth = centerTexts.reduce((sum, text) => sum + getStringWidth(text), 0)
        + (centerTexts.length > 1 ? (centerTexts.length - 1) * getStringWidth(separator) : 0);

      const centerX = x + Math.floor((width - centerTotalWidth) / 2);
      if (centerX > currentX && centerX + centerTotalWidth < rightX) {
        let cx = centerX;
        for (const text of centerTexts) {
          this.engine.putColorText(cx, y, text);
          cx += getStringWidth(text);
          if (centerTexts.indexOf(text) < centerTexts.length - 1) {
            cx += getStringWidth(separator);
          }
        }
      }
    }
  }

  /** 格式化项目 */
  private formatItem(item: StatusBarItem): string {
    let text = '';
    if (item.icon) {
      text += `${item.icon} `;
    }
    text += item.text;
    if (item.color) {
      text = colorize(text, item.color);
    }
    return text;
  }
}
