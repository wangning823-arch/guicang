/**
 * TUI 颜色调色板
 * 定义所有可用的颜色常量
 */

/** ANSI 前景色 */
export const FG = {
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // 亮色
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
} as const;

/** ANSI 背景色 */
export const BG = {
  black: '\x1b[40m',
  red: '\x1b[41m',
  green: '\x1b[42m',
  yellow: '\x1b[43m',
  blue: '\x1b[44m',
  magenta: '\x1b[45m',
  cyan: '\x1b[46m',
  white: '\x1b[47m',

  // 亮色
  brightBlack: '\x1b[100m',
  brightRed: '\x1b[101m',
  brightGreen: '\x1b[102m',
  brightYellow: '\x1b[103m',
  brightBlue: '\x1b[104m',
  brightMagenta: '\x1b[105m',
  brightCyan: '\x1b[106m',
  brightWhite: '\x1b[107m',
} as const;

/** ANSI 样式 */
export const STYLE = {
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  strikethrough: '\x1b[9m',
} as const;

/** 重置 */
export const RESET = '\x1b[0m';

/** 256色支持 - 扩展调色板 */
export const Palette256 = {
  // 灰色渐变 (232-255)
  gray100: fg256(232),
  gray200: fg256(233),
  gray300: fg256(234),
  gray400: fg256(235),
  gray500: fg256(236),
  gray600: fg256(237),
  gray700: fg256(238),
  gray800: fg256(239),
  gray900: fg256(240),

  // 常用颜色
  orange: fg256(208),
  hotPink: fg256(199),
  lime: fg256(112),
  teal: fg256(30),
  coral: fg256(203),
  lavender: fg256(141),
  peach: fg256(215),
  skyBlue: fg256(117),
  mint: fg256(42),
  salmon: fg256(209),
  gold: fg256(220),
  purple: fg256(134),
} as const;

/** 创建256色前景色 */
export function fg256(color: number): string {
  return `\x1b[38;5;${color}m`;
}

/** 创建256色背景色 */
export function bg256(color: number): string {
  return `\x1b[48;5;${color}m`;
}

/** 创建RGB前景色 */
export function fgRGB(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

/** 创建RGB背景色 */
export function bgRGB(r: number, g: number, b: number): string {
  return `\x1b[48;2;${r};${g};${b}m`;
}
