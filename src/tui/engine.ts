/**
 * TUI 引擎
 * 基于 ANSI 转义序列的终端界面引擎
 */

import * as readline from 'node:readline';
import { Colors, colorize } from './theme.js';

/**
 * 获取字符的显示宽度（统一版本）
 * 中文字符和全角字符占2个宽度，其他占1个
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
    (code >= 0x3000 && code <= 0x303F) ||   // CJK符号和标点（。、！？等）
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
    let output = '';
    let lastColor = '';

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const current = this.buffer[y][x];

        // 跳过宽字符的延续列
        if (current.wideContinuation) {
          continue;
        }

        const prev = this.prevBuffer[y]?.[x];

        // 比较字符和颜色
        if (current.char !== prev.char || current.color !== prev.color) {
          // 颜色变化时插入颜色代码
          if (current.color !== lastColor) {
            output += current.color;
            lastColor = current.color;
          }
          // 移动光标并写入字符
          output += `\x1b[${y + 1};${x + 1}H${current.char}`;
        }
      }
    }

    // 重置颜色
    if (lastColor !== Colors.reset) {
      output += Colors.reset;
    }

    if (output) {
      process.stdout.write(output);
    }

    // 保存当前缓冲区（深拷贝）
    this.prevBuffer = this.buffer.map((row) =>
      row.map((cell) => ({ ...cell }))
    );
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
