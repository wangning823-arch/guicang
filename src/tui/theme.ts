/**
 * TUI 颜色主题
 * ANSI 转义序列颜色定义
 */

/** ANSI 颜色代码 */
export const Colors = {
  // 基础色
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // 亮色
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // 灰色系
  gray: '\x1b[90m',
  darkGray: '\x1b[2m',

  // 背景色
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',

  // 样式
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  strikethrough: '\x1b[9m',

  // 重置
  reset: '\x1b[0m',
} as const;

/** 主题配色方案 */
export const Theme = {
  // 主色调
  primary: Colors.cyan,
  secondary: Colors.magenta,
  accent: Colors.brightCyan,

  // 状态色
  success: Colors.green,
  warning: Colors.yellow,
  error: Colors.red,
  info: Colors.blue,

  // 文本色
  text: Colors.white,
  textMuted: Colors.gray,
  textBright: Colors.brightWhite,
  textDim: Colors.darkGray,

  // 边框色
  border: Colors.gray,
  borderActive: Colors.cyan,
  borderFocused: Colors.brightCyan,

  // 背景色
  bg: Colors.bgBlack,
  bgActive: Colors.bgBlue,
  bgHighlight: Colors.bgCyan,

  // 面板标题
  panelTitle: Colors.brightCyan,
  panelBorder: Colors.gray,

  // 日志级别
  logDebug: Colors.gray,
  logInfo: Colors.blue,
  logWarn: Colors.yellow,
  logError: Colors.red,

  // 状态指示
  statusHealthy: Colors.green,
  statusDegraded: Colors.yellow,
  statusUnhealthy: Colors.red,
} as const;

/** 工具函数：应用颜色 */
export function colorize(text: string, color: string): string {
  return `${color}${text}${Colors.reset}`;
}

/** 工具函数：加粗 */
export function bold(text: string): string {
  return colorize(text, Colors.bold);
}

/** 工具函数：暗淡 */
export function dim(text: string): string {
  return colorize(text, Colors.dim);
}

/** 工具函数：带背景色 */
export function withBg(text: string, bg: string): string {
  return `${bg}${text}${Colors.reset}`;
}
