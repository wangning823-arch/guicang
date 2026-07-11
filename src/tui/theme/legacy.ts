/**
 * 旧版主题兼容层
 * 保持向后兼容，让现有代码继续工作
 */

import { FG, BG, STYLE, RESET } from './colors.js';

/** 旧版 Theme 对象（保持兼容） */
export const Theme = {
  // 主色调
  primary: FG.brightCyan,
  secondary: FG.brightMagenta,
  accent: FG.brightYellow,

  // 状态色
  success: FG.brightGreen,
  warning: FG.brightYellow,
  error: FG.brightRed,
  info: FG.brightBlue,

  // 文本色
  text: FG.brightWhite,
  textMuted: FG.brightBlack,
  textBright: FG.white,
  textDim: STYLE.dim,

  // 边框色
  border: FG.brightBlack,
  borderActive: FG.brightCyan,
  borderFocused: FG.brightYellow,

  // 背景色
  bg: BG.black,
  bgActive: BG.blue,
  bgHighlight: BG.cyan,

  // 面板标题
  panelTitle: FG.brightYellow,
  panelBorder: FG.brightBlack,

  // 面板特定颜色
  chatPanel: FG.brightCyan,
  statusPanel: FG.brightGreen,
  metricsPanel: FG.brightMagenta,
  tokensPanel: FG.brightBlue,

  // 日志级别
  logDebug: FG.brightBlack,
  logInfo: FG.brightCyan,
  logWarn: FG.brightYellow,
  logError: FG.brightRed,

  // 状态指示
  statusHealthy: FG.brightGreen,
  statusDegraded: FG.brightYellow,
  statusUnhealthy: FG.brightRed,
} as const;

/** 旧版 Colors 对象（保持兼容） */
export const Colors = {
  // 基础色
  black: FG.black,
  red: FG.red,
  green: FG.green,
  yellow: FG.yellow,
  blue: FG.blue,
  magenta: FG.magenta,
  cyan: FG.cyan,
  white: FG.white,

  // 亮色
  brightRed: FG.brightRed,
  brightGreen: FG.brightGreen,
  brightYellow: FG.brightYellow,
  brightBlue: FG.brightBlue,
  brightMagenta: FG.brightMagenta,
  brightCyan: FG.brightCyan,
  brightWhite: FG.brightWhite,

  // 灰色系
  gray: FG.brightBlack,
  darkGray: STYLE.dim,

  // 背景色
  bgBlack: BG.black,
  bgRed: BG.red,
  bgGreen: BG.green,
  bgYellow: BG.yellow,
  bgBlue: BG.blue,
  bgMagenta: BG.magenta,
  bgCyan: BG.cyan,
  bgWhite: BG.white,

  // 亮背景色
  bgBrightBlack: BG.brightBlack,
  bgBrightRed: BG.brightRed,
  bgBrightGreen: BG.brightGreen,
  bgBrightYellow: BG.brightYellow,
  bgBrightBlue: BG.brightBlue,
  bgBrightMagenta: BG.brightMagenta,
  bgBrightCyan: BG.brightCyan,
  bgBrightWhite: BG.brightWhite,

  // 样式
  bold: STYLE.bold,
  dim: STYLE.dim,
  italic: STYLE.italic,
  underline: STYLE.underline,
  blink: STYLE.blink,
  reverse: STYLE.reverse,
  strikethrough: STYLE.strikethrough,

  // 重置
  reset: RESET,
} as const;

/** 旧版工具函数（保持兼容） */
export function colorize(text: string, color: string): string {
  return `${color}${text}${RESET}`;
}

/** 旧版工具函数：加粗 */
export function bold(text: string): string {
  return colorize(text, STYLE.bold);
}

/** 旧版工具函数：暗淡 */
export function dim(text: string): string {
  return colorize(text, STYLE.dim);
}

/** 旧版工具函数：带背景色 */
export function withBg(text: string, bg: string): string {
  return `${bg}${text}${RESET}`;
}
