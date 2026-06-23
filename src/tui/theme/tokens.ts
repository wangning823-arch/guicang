/**
 * 设计令牌 (Design Tokens)
 * 语义化的颜色和样式定义
 */

import { FG, BG, STYLE, RESET } from './colors.js';

/** 背景色令牌 */
export interface BackgroundTokens {
  primary: string;
  secondary: string;
  tertiary: string;
  elevated: string;
  overlay: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

/** 前景色令牌 */
export interface ForegroundTokens {
  primary: string;
  secondary: string;
  tertiary: string;
  muted: string;
  inverse: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

/** 边框色令牌 */
export interface BorderTokens {
  default: string;
  focus: string;
  muted: string;
  success: string;
  warning: string;
  error: string;
}

/** 边框样式 */
export interface BorderStyleTokens {
  single: { tl: string; tr: string; bl: string; br: string; h: string; v: string };
  double: { tl: string; tr: string; bl: string; br: string; h: string; v: string };
  rounded: { tl: string; tr: string; bl: string; br: string; h: string; v: string };
  thick: { tl: string; tr: string; bl: string; br: string; h: string; v: string };
}

/** 状态色令牌 */
export interface StatusTokens {
  success: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
}

/** 日志级别色 */
export interface LogLevelTokens {
  debug: string;
  info: string;
  warn: string;
  error: string;
  fatal: string;
}

/** 面板色令牌 */
export interface PanelTokens {
  chat: string;
  status: string;
  metrics: string;
  tokens: string;
  agents: string;
  tools: string;
  logs: string;
  help: string;
  history: string;
  config: string;
}

/** 完整的设计令牌 */
export interface DesignTokens {
  bg: BackgroundTokens;
  fg: ForegroundTokens;
  border: BorderTokens;
  borderStyle: BorderStyleTokens;
  status: StatusTokens;
  logLevel: LogLevelTokens;
  panel: PanelTokens;
  accent: {
    primary: string;
    secondary: string;
    hover: string;
    active: string;
  };
  shadow: {
    light: string;
    medium: string;
    dark: string;
  };
}

/** 默认深色主题令牌 */
export const darkTokens: DesignTokens = {
  bg: {
    primary: BG.black,
    secondary: BG.brightBlack,
    tertiary: `\x1b[48;5;236m`,
    elevated: `\x1b[48;5;238m`,
    overlay: `\x1b[48;5;240m`,
    success: BG.green,
    warning: BG.yellow,
    error: BG.red,
    info: BG.blue,
  },
  fg: {
    primary: FG.brightWhite,
    secondary: FG.white,
    tertiary: FG.brightBlack,
    muted: FG.black,
    inverse: FG.black,
    success: FG.brightGreen,
    warning: FG.brightYellow,
    error: FG.brightRed,
    info: FG.brightBlue,
  },
  border: {
    default: FG.brightBlack,
    focus: FG.brightCyan,
    muted: `\x1b[38;5;238m`,
    success: FG.green,
    warning: FG.yellow,
    error: FG.red,
  },
  borderStyle: {
    single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
    thick: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
  },
  status: {
    success: FG.brightGreen,
    warning: FG.brightYellow,
    error: FG.brightRed,
    info: FG.brightBlue,
    muted: FG.black,
  },
  logLevel: {
    debug: FG.brightBlack,
    info: FG.brightCyan,
    warn: FG.brightYellow,
    error: FG.brightRed,
    fatal: `\x1b[1m\x1b[91m`,
  },
  panel: {
    chat: FG.brightCyan,
    status: FG.brightGreen,
    metrics: FG.brightMagenta,
    tokens: FG.brightBlue,
    agents: FG.brightYellow,
    tools: FG.brightCyan,
    logs: FG.brightBlack,
    help: FG.white,
    history: FG.brightMagenta,
    config: FG.brightGreen,
  },
  accent: {
    primary: FG.brightCyan,
    secondary: FG.brightMagenta,
    hover: `\x1b[38;5;117m`,
    active: `\x1b[38;5;75m`,
  },
  shadow: {
    light: `\x1b[38;5;236m`,
    medium: `\x1b[38;5;234m`,
    dark: `\x1b[38;5;232m`,
  },
};

/** 浅色主题令牌 */
export const lightTokens: DesignTokens = {
  bg: {
    primary: BG.white,
    secondary: `\x1b[48;5;254m`,
    tertiary: `\x1b[48;5;252m`,
    elevated: `\x1b[48;5;250m`,
    overlay: `\x1b[48;5;248m`,
    success: `\x1b[48;5;157m`,
    warning: `\x1b[48;5;228m`,
    error: `\x1b[48;5;224m`,
    info: `\x1b[48;5;189m`,
  },
  fg: {
    primary: `\x1b[38;5;234m`,
    secondary: `\x1b[38;5;240m`,
    tertiary: `\x1b[38;5;248m`,
    muted: `\x1b[38;5;250m`,
    inverse: FG.white,
    success: `\x1b[38;5;28m`,
    warning: `\x1b[38;5;136m`,
    error: `\x1b[38;5;124m`,
    info: `\x1b[38;5;26m`,
  },
  border: {
    default: `\x1b[38;5;250m`,
    focus: `\x1b[38;5;32m`,
    muted: `\x1b[38;5;252m`,
    success: `\x1b[38;5;35m`,
    warning: `\x1b[38;5;172m`,
    error: `\x1b[38;5;167m`,
  },
  borderStyle: {
    single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
    thick: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
  },
  status: {
    success: `\x1b[38;5;28m`,
    warning: `\x1b[38;5;136m`,
    error: `\x1b[38;5;124m`,
    info: `\x1b[38;5;26m`,
    muted: `\x1b[38;5;250m`,
  },
  logLevel: {
    debug: `\x1b[38;5;250m`,
    info: `\x1b[38;5;26m`,
    warn: `\x1b[38;5;136m`,
    error: `\x1b[38;5;124m`,
    fatal: `\x1b[1m\x1b[38;5;88m`,
  },
  panel: {
    chat: `\x1b[38;5;32m`,
    status: `\x1b[38;5;28m`,
    metrics: `\x1b[38;5;127m`,
    tokens: `\x1b[38;5;26m`,
    agents: `\x1b[38;5;136m`,
    tools: `\x1b[38;5;32m`,
    logs: `\x1b[38;5;240m`,
    help: `\x1b[38;5;234m`,
    history: `\x1b[38;5;127m`,
    config: `\x1b[38;5;28m`,
  },
  accent: {
    primary: `\x1b[38;5;32m`,
    secondary: `\x1b[38;5;127m`,
    hover: `\x1b[38;5;38m`,
    active: `\x1b[38;5;44m`,
  },
  shadow: {
    light: `\x1b[38;5;252m`,
    medium: `\x1b[38;5;250m`,
    dark: `\x1b[38;5;248m`,
  },
};

/** 工具函数：应用颜色 */
export function colorize(text: string, color: string): string {
  return `${color}${text}${RESET}`;
}

/** 工具函数：加粗 */
export function bold(text: string): string {
  return `${STYLE.bold}${text}${RESET}`;
}

/** 工具函数：暗淡 */
export function dim(text: string): string {
  return `${STYLE.dim}${text}${RESET}`;
}

/** 工具函数：斜体 */
export function italic(text: string): string {
  return `${STYLE.italic}${text}${RESET}`;
}

/** 工具函数：下划线 */
export function underline(text: string): string {
  return `${STYLE.underline}${text}${RESET}`;
}

/** 工具函数：带背景色 */
export function withBg(text: string, bg: string): string {
  return `${bg}${text}${RESET}`;
}
