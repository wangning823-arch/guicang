/**
 * 配置面板
 * 显示和管理应用配置
 */

import { TUIEngine, type KeyEvent, type Rect } from '../engine.js';
import { Colors, Theme, colorize, dim, bold } from '../theme.js';
import { Box } from '../components/box.js';
import { getStringWidth, truncateString } from '../utils.js';

/** 配置项 */
export interface ConfigItem {
  key: string;
  label: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  options?: string[];
  description?: string;
}

/** 配置面板选项 */
export interface ConfigPanelOptions {
  rect: Rect;
  items?: ConfigItem[];
}

/** 配置面板 */
export class ConfigPanel {
  private engine: TUIEngine;
  private box: Box;
  private items: ConfigItem[] = [];
  private selectedIndex: number = 0;
  private isEditing: boolean = false;
  private editBuffer: string = '';

  constructor(engine: TUIEngine, options: ConfigPanelOptions) {
    this.engine = engine;
    this.box = new Box({
      title: '⚙️ 配置',
      rect: options.rect,
      accentColor: Colors.brightGreen,
    });

    if (options.items) {
      this.items = options.items;
    } else {
      this.items = this.getDefaultItems();
    }
  }

  /** 获取默认配置项 */
  private getDefaultItems(): ConfigItem[] {
    return [
      { key: 'theme', label: '主题', value: 'dark', type: 'select', options: ['dark', 'light'], description: '界面主题' },
      { key: 'keybinding', label: '快捷键', value: 'default', type: 'select', options: ['default', 'vim', 'emacs'], description: '快捷键预设' },
      { key: 'model', label: '模型', value: 'mimo-v2.5', type: 'string', description: 'AI 模型' },
      { key: 'maxTokens', label: '最大 Token', value: '4096', type: 'number', description: '最大输出 Token 数' },
      { key: 'temperature', label: '温度', value: '0.7', type: 'number', description: '生成温度' },
      { key: 'showLineNumbers', label: '显示行号', value: 'true', type: 'boolean', description: '代码块显示行号' },
      { key: 'autoScroll', label: '自动滚动', value: 'true', type: 'boolean', description: '新消息自动滚动' },
    ];
  }

  /** 设置配置项 */
  setItems(items: ConfigItem[]): void {
    this.items = items;
  }

  /** 渲染面板 */
  render(): void {
    const { rect } = this.box.getRect() as { rect: Rect };
    const contentHeight = rect.height - 2;
    const contentWidth = rect.width - 2;

    const lines: string[] = [];

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const isSelected = i === this.selectedIndex;
      const isEditing = isSelected && this.isEditing;

      const label = truncateString(item.label, 15);
      let value = item.value;

      if (isEditing) {
        value = colorize(this.editBuffer + '█', Colors.brightCyan);
      } else if (item.type === 'boolean') {
        value = item.value === 'true'
          ? colorize('✓ 启用', Colors.brightGreen)
          : colorize('✗ 禁用', Colors.brightRed);
      } else if (item.type === 'select' && item.options) {
        const currentIndex = item.options.indexOf(item.value);
        value = `${item.value} (${currentIndex + 1}/${item.options.length})`;
      }

      let line = '';
      if (isSelected) {
        line = colorize(` ▸ ${label}`, Colors.brightWhite);
        line += colorize(`: `, Colors.brightBlack);
        line += value;
      } else {
        line = `   ${colorize(label, Colors.white)}`;
        line += dim(`: `);
        line += value;
      }

      // 添加描述
      if (item.description && isSelected) {
        line += dim(` - ${item.description}`);
      }

      lines.push(truncateString(line, contentWidth));
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
    if (this.isEditing) {
      return this.handleEditKey(event);
    }

    if (event.name === 'up') {
      this.selectPrev();
      return true;
    }
    if (event.name === 'down') {
      this.selectNext();
      return true;
    }
    if (event.name === 'return' || event.name === 'space') {
      this.startEdit();
      return true;
    }
    if (event.name === 'escape') {
      return false; // 让上层处理
    }

    return false;
  }

  /** 处理编辑模式按键 */
  private handleEditKey(event: KeyEvent): boolean {
    const item = this.items[this.selectedIndex];
    if (!item) return false;

    if (event.name === 'return') {
      this.applyEdit();
      return true;
    }
    if (event.name === 'escape') {
      this.cancelEdit();
      return true;
    }

    if (item.type === 'select') {
      return this.handleSelectEdit(event);
    }

    if (event.name === 'backspace') {
      this.editBuffer = this.editBuffer.slice(0, -1);
      return true;
    }

    if (event.key && !event.ctrl && !event.meta) {
      this.editBuffer += event.key;
      return true;
    }

    return false;
  }

  /** 处理选择类型编辑 */
  private handleSelectEdit(event: KeyEvent): boolean {
    const item = this.items[this.selectedIndex];
    if (!item || !item.options) return false;

    const currentIndex = item.options.indexOf(item.value);

    if (event.name === 'left' || event.name === 'up') {
      const newIndex = (currentIndex - 1 + item.options.length) % item.options.length;
      item.value = item.options[newIndex];
      return true;
    }
    if (event.name === 'right' || event.name === 'down') {
      const newIndex = (currentIndex + 1) % item.options.length;
      item.value = item.options[newIndex];
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
    if (this.selectedIndex < this.items.length - 1) {
      this.selectedIndex++;
    }
  }

  /** 开始编辑 */
  startEdit(): void {
    const item = this.items[this.selectedIndex];
    if (!item) return;

    if (item.type === 'boolean') {
      // 切换布尔值
      item.value = item.value === 'true' ? 'false' : 'true';
      return;
    }

    if (item.type === 'select') {
      // 循环选择
      if (item.options) {
        const currentIndex = item.options.indexOf(item.value);
        const newIndex = (currentIndex + 1) % item.options.length;
        item.value = item.options[newIndex];
      }
      return;
    }

    this.isEditing = true;
    this.editBuffer = item.value;
  }

  /** 应用编辑 */
  private applyEdit(): void {
    const item = this.items[this.selectedIndex];
    if (!item) return;

    if (item.type === 'number') {
      const num = parseFloat(this.editBuffer);
      if (!isNaN(num)) {
        item.value = String(num);
      }
    } else {
      item.value = this.editBuffer;
    }

    this.isEditing = false;
    this.editBuffer = '';
  }

  /** 取消编辑 */
  private cancelEdit(): void {
    this.isEditing = false;
    this.editBuffer = '';
  }

  /** 获取配置项 */
  getItem(key: string): ConfigItem | undefined {
    return this.items.find(i => i.key === key);
  }

  /** 获取配置值 */
  getValue(key: string): string | undefined {
    return this.getItem(key)?.value;
  }

  /** 设置配置值 */
  setValue(key: string, value: string): void {
    const item = this.getItem(key);
    if (item) {
      item.value = value;
    }
  }

  /** 获取所有配置 */
  getAll(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const item of this.items) {
      result[item.key] = item.value;
    }
    return result;
  }

  /** 是否正在编辑 */
  isCurrentlyEditing(): boolean {
    return this.isEditing;
  }
}
