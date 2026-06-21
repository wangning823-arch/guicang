/**
 * TUI 引擎
 * 基于 ANSI 转义序列的终端界面引擎
 */

import * as readline from 'node:readline';
import { Colors, colorize } from './theme.js';
import { getCharWidth } from './utils.js';

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

/** 缓冲区单元格（字符 + 颜色） */
interface Cell {
  char: string;
  color: string;
  wideContinuation?: boolean; // 标记宽字符的第二列
}

/** 渲染上下文 */
export interface RenderContext {
  buffer: Cell[][];
  width: number;
  height: number;
}

/** 创建空单元格 */
function emptyCell(): Cell {
  return { char: ' ', color: Colors.white };
}

/** TUI 引擎 */
export class TUIEngine {
  private width = 0;
  private height = 0;
  private buffer: Cell[][] = [];
  private prevBuffer: Cell[][] = [];
  private running = false;
  private keyHandlers = new Map<string, (event: KeyEvent) => void>();
  private panelHandlers: Array<(event: KeyEvent) => void> = [];
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

  /** 处理终端窗口大小变化 */
  handleResize(): void {
    this.updateSize();
    this.buffer = this.createBuffer();
    this.prevBuffer = this.createBuffer();
    this.render();
  }

  /** 创建空缓冲区 */
  private createBuffer(): Cell[][] {
    const buffer: Cell[][] = [];
    for (let y = 0; y < this.height; y++) {
      buffer.push(new Array(this.width).fill(null).map(() => emptyCell()));
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

    // 触发所有面板处理器（用于输入捕获）
    for (const panelHandler of this.panelHandlers) {
      panelHandler(event);
    }
  }

  /** 注册按键处理器 */
  onKey(name: string, handler: (event: KeyEvent) => void): void {
    this.keyHandlers.set(name, handler);
  }

  /** 注册面板处理器（用于输入捕获） */
  onPanelKey(handler: (event: KeyEvent) => void): void {
    this.panelHandlers.push(handler);
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
        this.buffer[y][x] = emptyCell();
      }
    }
  }

  /** 在指定位置写入字符 */
  putChar(x: number, y: number, char: string, color: string = Colors.white): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.buffer[y][x] = { char, color };
    }
  }

  /** 在指定位置写入文本 */
  putText(x: number, y: number, text: string, color: string = Colors.white): void {
    let currentX = x;

    for (const char of text) {
      const charWidth = getCharWidth(char);
      if (currentX >= 0 && currentX < this.width && y >= 0 && y < this.height) {
        this.buffer[y][currentX] = { char, color };
        // 宽字符：第二列标记为延续，不单独渲染
        if (charWidth === 2 && currentX + 1 < this.width) {
          this.buffer[y][currentX + 1] = { char: '', color, wideContinuation: true };
        }
      }
      currentX += charWidth;
    }
  }

  /**
   * 在指定位置写入带颜色的文本
   * 文本可以包含 ANSI 转义序列，颜色会正确解析和存储
   */
  putColorText(x: number, y: number, text: string, defaultColor: string = Colors.white): void {
    if (y < 0 || y >= this.height) return;

    let currentX = x;
    let currentColor = defaultColor;
    let i = 0;

    while (i < text.length) {
      const char = text[i];

      // 解析 ANSI 转义序列
      if (char === '\x1b' && i + 1 < text.length && text[i + 1] === '[') {
        // 找到 'm' 结束符
        let j = i + 2;
        while (j < text.length && text[j] !== 'm') j++;

        if (j < text.length && text[j] === 'm') {
          // 提取参数
          const params = text.slice(i + 2, j);
          if (params === '0' || params === '') {
            currentColor = defaultColor; // 重置
          } else {
            // 解析 SGR 参数
            const codes = params.split(';').map(Number);
            for (const code of codes) {
              if (code >= 30 && code <= 37) {
                const colorMap: Record<number, string> = {
                  30: Colors.black, 31: Colors.red, 32: Colors.green,
                  33: Colors.yellow, 34: Colors.blue, 35: Colors.magenta,
                  36: Colors.cyan, 37: Colors.white,
                };
                currentColor = colorMap[code] || defaultColor;
              } else if (code >= 90 && code <= 97) {
                const colorMap: Record<number, string> = {
                  90: Colors.darkGray, 91: Colors.brightRed, 92: Colors.brightGreen,
                  93: Colors.brightYellow, 94: Colors.brightBlue, 95: Colors.brightMagenta,
                  96: Colors.brightCyan, 97: Colors.brightWhite,
                };
                currentColor = colorMap[code] || defaultColor;
              } else if (code === 1) {
                // Bold - 保持当前颜色，但可以添加粗体样式
                // 由于我们存储的是 ANSI 序列，这里简单保持
              } else if (code === 2) {
                // Dim - 使用暗灰色
                currentColor = Colors.darkGray;
              } else if (code === 3) {
                // Italic - 保持当前颜色
              } else if (code === 4) {
                // Underline - 保持当前颜色
              } else if (code >= 40 && code <= 47) {
                // 背景色 - 保持当前前景色
              } else if (code >= 100 && code <= 107) {
                // 亮背景色 - 保持当前前景色
              }
            }
          }
          i = j + 1;
          continue;
        }
      }

      // 写入字符（带颜色）
      const charWidth = getCharWidth(char);
      if (currentX >= 0 && currentX < this.width) {
        this.buffer[y][currentX] = { char, color: currentColor };
        // 宽字符：第二列标记为延续
        if (charWidth === 2 && currentX + 1 < this.width) {
          this.buffer[y][currentX + 1] = { char: '', color: currentColor, wideContinuation: true };
        }
      }
      currentX += charWidth;
      i++;
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

  /** 绘制带背景色的矩形 */
  drawBoxWithBg(rect: Rect, borderColor: string, bgColor: string): void {
    const { x, y, width, height } = rect;

    // 填充背景
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (x + col >= 0 && x + col < this.width && y + row >= 0 && y + row < this.height) {
          this.buffer[y + row][x + col] = { char: ' ', color: bgColor };
        }
      }
    }

    // 绘制边框
    this.drawBox(rect, borderColor);
  }

  /** 填充区域 */
  fillRect(rect: Rect, char: string = ' ', color: string = Colors.white): void {
    const { x, y, width, height } = rect;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        this.putChar(x + col, y + row, char, color);
      }
    }
  }

  /** 清空区域 */
  clearRect(rect: Rect): void {
    this.fillRect(rect, ' ', Colors.white);
  }

  /** 渲染差异（只更新变化的字符） */
  private renderDiff(): void {
    const output: string[] = [];
    let lastColor = '';

    for (let y = 0; y < this.height; y++) {
      let runStart = -1;
      let runColor = '';

      for (let x = 0; x < this.width; x++) {
        const current = this.buffer[y][x];

        // 跳过宽字符的延续列
        if (current.wideContinuation) {
          continue;
        }

        const prev = this.prevBuffer[y]?.[x];

        // 比较字符和颜色
        if (current.char !== prev.char || current.color !== prev.color) {
          // 开始新的连续变化段
          if (runStart === -1) {
            runStart = x;
            runColor = current.color;
          }

          // 如果颜色变化，结束当前段并开始新段
          if (current.color !== runColor) {
            // 输出当前段
            this.flushRun(output, y, runStart, x - 1, runColor, lastColor);
            lastColor = runColor;
            runStart = x;
            runColor = current.color;
          }
        } else {
          // 结束连续变化段
          if (runStart !== -1) {
            this.flushRun(output, y, runStart, x - 1, runColor, lastColor);
            lastColor = runColor;
            runStart = -1;
          }
        }
      }

      // 结束行末的连续变化段
      if (runStart !== -1) {
        this.flushRun(output, y, runStart, this.width - 1, runColor, lastColor);
        lastColor = runColor;
      }
    }

    // 重置颜色
    if (lastColor !== Colors.reset) {
      output.push(Colors.reset);
    }

    if (output.length > 0) {
      process.stdout.write(output.join(''));
    }

    // 交换缓冲区（避免深拷贝）
    const temp = this.prevBuffer;
    this.prevBuffer = this.buffer;
    this.buffer = temp;

    // 清空当前缓冲区以便下次渲染
    this.clearBuffer();
  }

  /** 输出连续变化段 */
  private flushRun(
    output: string[],
    y: number,
    startX: number,
    endX: number,
    color: string,
    lastColor: string,
  ): void {
    // 颜色变化时插入颜色代码
    if (color !== lastColor) {
      output.push(color);
    }

    // 移动光标到起始位置
    output.push(`\x1b[${y + 1};${startX + 1}H`);

    // 输出连续字符
    for (let x = startX; x <= endX; x++) {
      const cell = this.buffer[y][x];
      if (!cell.wideContinuation) {
        output.push(cell.char);
      }
    }
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
