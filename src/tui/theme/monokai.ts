/**
 * Monokai 主题
 */

import { fg256, bg256, FG, BG } from './colors.js';
import type { DesignTokens } from './tokens.js';

export const monokaiTokens: DesignTokens = {
  bg: {
    primary: bg256(234),      // #272822
    secondary: bg256(235),    // #2d2e27
    tertiary: bg256(236),     // #3e3d32
    elevated: bg256(237),     // #49483e
    overlay: bg256(238),      // #75715e
    success: bg256(112),      // #a6e22e
    warning: bg256(228),      // #e6db74
    error: bg256(167),        // #f92672
    info: bg256(81),          // #66d9ef
  },
  fg: {
    primary: fg256(252),      // #f8f8f2
    secondary: fg256(253),    // #f5f4f1
    tertiary: fg256(248),     // #f8f8f0
    muted: fg256(242),        // #75715e
    inverse: fg256(234),      // #272822
    success: fg256(112),      // #a6e22e
    warning: fg256(228),      // #e6db74
    error: fg256(167),        // #f92672
    info: fg256(81),          // #66d9ef
  },
  border: {
    default: fg256(242),      // #75715e
    focus: fg256(81),         // #66d9ef
    muted: fg256(237),        // #49483e
    success: fg256(112),      // #a6e22e
    warning: fg256(228),      // #e6db74
    error: fg256(167),        // #f92672
  },
  borderStyle: {
    single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
    thick: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
  },
  status: {
    success: fg256(112),      // #a6e22e
    warning: fg256(228),      // #e6db74
    error: fg256(167),        // #f92672
    info: fg256(81),          // #66d9ef
    muted: fg256(242),        // #75715e
  },
  logLevel: {
    debug: fg256(242),        // #75715e
    info: fg256(81),          // #66d9ef
    warn: fg256(228),         // #e6db74
    error: fg256(167),        // #f92672
    fatal: `\x1b[1m${fg256(167)}`,
  },
  panel: {
    chat: fg256(81),          // #66d9ef
    status: fg256(112),       // #a6e22e
    metrics: fg256(183),      // #ae81ff
    tokens: fg256(161),       // #fd971f
    agents: fg256(167),       // #f92672
    tools: fg256(81),         // #66d9ef
    logs: fg256(242),         // #75715e
    help: fg256(252),         // #f8f8f2
    history: fg256(183),      // #ae81ff
    config: fg256(112),       // #a6e22e
  },
  accent: {
    primary: fg256(81),       // #66d9ef
    secondary: fg256(183),    // #ae81ff
    hover: fg256(112),        // #a6e22e
    active: fg256(161),       // #fd971f
  },
  shadow: {
    light: fg256(237),        // #49483e
    medium: fg256(236),       // #3e3d32
    dark: fg256(235),         // #2d2e27
  },
};
