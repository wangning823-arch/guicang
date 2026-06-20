/**
 * TUI 引擎
 * 基于 ANSI 转义序列的终端界面引擎
 */

import * as readline from 'node:readline';
import { Colors, colorize } from './theme.js';

/** 绘图坐标 */
export interface Position {
  x: number;
  y: number;
}

/** 绘图区域 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 键盘事件 */
export interface KeyEvent {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  name: string;
}

/** 渲染上下文 */
export interface RenderContext {
  buffer: string[][];
  width: number;
  height: number;
}

/** TUI 引擎 */
export class TUIEngine {
  private width = 0;
  private height = 0;
  private buffer: string[][] = [];
  private prevBuffer: string[][] = [];
  private running = false;
  private keyHandlers = new Map<string, (event: KeyEvent) => void>();
  private renderCallbacks: Array<() => void> = [];
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private rl: readline.Interface | null = null;

  /** 初始化引擎 */
  async init(): Promise<void> {
    // 获取终端尺寸
    this.updateSize();

    // 初始化缓冲区
    this.buffer = this.createBuffer();
    this.prevBuffer = this.createBuffer();

    // 隐藏光标，清屏
    process.stdout.write(Colors.reset);
    process.stdout.write('\x1b[?25l'); // 隐藏光标
    process.stdout.write('\x1b[2J');   // 清屏
    process.stdout.write('\x1b[H');    // 光标回到左上角

    // 设置键盘读取
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // 监听键盘
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.on('keypress', (str, event) => {
      if (event) {
        this.handleKeyPress({
          key: str ?? '',
          ctrl: event.ctrl ?? false,
          meta: event.meta ?? false,
          shift: event.shift ?? false,
          name: event.name ?? '',
        });
      }
    });

    // 监听窗口大小变化
    process.stdout.on('resize', () => {
      this.updateSize();
      this.buffer = this.createBuffer();
      this.prevBuffer = this.createBuffer();
      this.render();
    });

    this.running = true;
  }

  /** 更新终端尺寸 */
  private updateSize(): void {
    this.width = process.stdout.columns ?? 80;
    this.height = process.stdout.rows ?? 24;
  }

  /** 创建空缓冲区 */
  private createBuffer(): string[][] {
    const buffer: string[][] = [];
    for (let y = 0; y < this.height; y++) {
      buffer.push(new Array(this.width).fill(' '));
    }
    return buffer;
  }

  /** 处理按键 */
  private handleKeyPress(event: KeyEvent): void {
    // 全局快捷键
    if (event.ctrl && event.name === 'c') {
      this.stop();
      process.exit(0);
    }

    // 触发注册的处理器
    const handler = this.keyHandlers.get(event.name);
    if (handler) {
      handler(event);
    }
  }

  /** 注册按键处理器 */
  onKey(name: string, handler: (event: KeyEvent) => void): void {
    this.keyHandlers.set(name, handler);
  }

  /** 注册渲染回调 */
  onRender(callback: () => void): void {
    this.renderCallbacks.push(callback);
  }

  /** 启动自动刷新 */
  startAutoRefresh(intervalMs: number): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.refreshInterval = setInterval(() => {
      this.render();
    }, intervalMs);
  }

  /** 清空缓冲区 */
  clearBuffer(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.buffer[y][x] = ' ';
      }
    }
  }

  /** 在指定位置写入字符 */
  putChar(x: number, y: number, char: string): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.buffer[y][x] = char;
    }
  }

  /** 在指定位置写入文本 */
  putText(x: number, y: number, text: string): void {
    let currentX = x;

    // 简单处理：逐字符写入（不含 ANSI 转义）
    for (let i = 0; i < text.length; i++) {
      if (currentX < this.width && y >= 0 && y < this.height) {
        this.buffer[y][currentX] = text[i];
        currentX++;
      }
    }
  }

  /** 在指定位置写入带颜色的文本 */
  putColorText(x: number, y: number, text: string, _color: string): void {
    if (y < 0 || y >= this.height) return;

    let currentX = x;
    let inEscape = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

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

      if (currentX >= 0 && currentX < this.width) {
        this.buffer[y][currentX] = char;
        currentX++;
      }
    }
  }

  /** 绘制矩形边框 */
  drawBox(rect: Rect, color: string = Colors.gray): void {
    const { x, y, width, height } = rect;

    if (height < 2 || width < 2) return;

    // 顶部
    this.putColorText(x, y, colorize('┌' + '─'.repeat(width - 2) + '┐', color), color);

    // 中间
    for (let i = 1; i < height - 1; i++) {
      this.putColorText(x, y + i, colorize('│', color), color);
      this.putColorText(x + width - 1, y + i, colorize('│', color), color);
    }

    // 底部
    this.putColorText(x, y + height - 1, colorize('└' + '─'.repeat(width - 2) + '┘', color), color);
  }

  /** 填充区域 */
  fillRect(rect: Rect, char: string = ' '): void {
    const { x, y, width, height } = rect;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        this.putChar(x + col, y + row, char);
      }
    }
  }

  /** 清空区域 */
  clearRect(rect: Rect): void {
    this.fillRect(rect, ' ');
  }

  /** 渲染差异（只更新变化的字符） */
  private renderDiff(): void {
    let output = '';

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const current = this.buffer[y][x];
        const prev = this.prevBuffer[y]?.[x];

        if (current !== prev) {
          // 移动光标并写入字符
          output += `\x1b[${y + 1};${x + 1}H${current}`;
        }
      }
    }

    if (output) {
      process.stdout.write(output);
    }

    // 保存当前缓冲区
    this.prevBuffer = this.buffer.map((row) => [...row]);
  }

  /** 完整重绘 */
  render(): void {
    // 触发渲染回调
    for (const callback of this.renderCallbacks) {
      callback();
    }

    // 渲染差异
    this.renderDiff();
  }

  /** 获取渲染上下文 */
  getContext(): RenderContext {
    return {
      buffer: this.buffer,
      width: this.width,
      height: this.height,
    };
  }

  /** 获取终端宽度 */
  getWidth(): number {
    return this.width;
  }

  /** 获取终端高度 */
  getHeight(): number {
    return this.height;
  }

  /** 停止引擎 */
  stop(): void {
    this.running = false;

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    // 恢复终端状态
    process.stdout.write(Colors.reset);
    process.stdout.write('\x1b[?25h'); // 显示光标
    process.stdout.write('\x1b[2J');   // 清屏
    process.stdout.write('\x1b[H');    // 光标回到左上角

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }
}
