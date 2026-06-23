/**
 * Dracula 主题
 */

import { fg256, bg256 } from './colors.js';
import type { DesignTokens } from './tokens.js';

export const draculaTokens: DesignTokens = {
  bg: {
    primary: bg256(0),        // #282a36
    secondary: bg256(18),     // #21222c
    tertiary: bg256(19),      // #343746
    elevated: bg256(20),      // #44475a
    overlay: bg256(21),       // #f8f8f2
    success: bg256(72),       // #50fa7b
    warning: bg256(228),      // #f1fa8c
    error: bg256(167),        // #ff5555
    info: bg256(68),          // #8be9fd
  },
  fg: {
    primary: fg256(255),      // #f8f8f2
    secondary: fg256(254),    // #f8f8f2
    tertiary: fg256(253),     // #f8f8f2
    muted: fg256(243),        // #6272a4
    inverse: fg256(0),        // #282a36
    success: fg256(72),       // #50fa7b
    warning: fg256(228),      // #f1fa8c
    error: fg256(167),        // #ff5555
    info: fg256(68),          // #8be9fd
  },
  border: {
    default: fg256(243),      // #6272a4
    focus: fg256(141),        // #bd93f9
    muted: fg256(20),         // #44475a
    success: fg256(72),       // #50fa7b
    warning: fg256(228),      // #f1fa8c
    error: fg256(167),        // #ff5555
  },
  borderStyle: {
    single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
    thick: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
  },
  status: {
    success: fg256(72),       // #50fa7b
    warning: fg256(228),      // #f1fa8c
    error: fg256(167),        // #ff5555
    info: fg256(68),          // #8be9fd
    muted: fg256(243),        // #6272a4
  },
  logLevel: {
    debug: fg256(243),        // #6272a4
    info: fg256(68),          // #8be9fd
    warn: fg256(214),         // #ffb86c
    error: fg256(167),        // #ff5555
    fatal: `\x1b[1m${fg256(167)}`,
  },
  panel: {
    chat: fg256(141),         // #bd93f9
    status: fg256(72),        // #50fa7b
    metrics: fg256(170),      // #ff79c6
    tokens: fg256(214),       // #ffb86c
    agents: fg256(167),       // #ff5555
    tools: fg256(68),         // #8be9fd
    logs: fg256(243),         // #6272a4
    help: fg256(255),         // #f8f8f2
    history: fg256(170),      // #ff79c6
    config: fg256(72),        // #50fa7b
  },
  accent: {
    primary: fg256(141),      // #bd93f9
    secondary: fg256(170),    // #ff79c6
    hover: fg256(113),        // #8be9fd
    active: fg256(135),       // #50fa7b
  },
  shadow: {
    light: fg256(20),         // #44475a
    medium: fg256(19),        // #343746
    dark: fg256(18),          // #21222c
  },
};
