/**
 * Solarized 主题
 */

import { fg256, bg256 } from './colors.js';
import type { DesignTokens } from './tokens.js';

export const solarizedTokens: DesignTokens = {
  bg: {
    primary: bg256(235),      // #002b36 (base03)
    secondary: bg256(234),    // #073642 (base02)
    tertiary: bg256(236),     // #586e75 (base01)
    elevated: bg256(237),     // #657b83 (base00)
    overlay: bg256(252),      // #fdf6e3 (base3)
    success: bg256(71),       // #859900 (green)
    warning: bg256(228),      // #b58900 (yellow)
    error: bg256(167),        // #dc322f (red)
    info: bg256(33),          // #268bd2 (blue)
  },
  fg: {
    primary: fg256(252),      // #fdf6e3 (base3)
    secondary: fg256(251),    // #eee8d5 (base2)
    tertiary: fg256(250),     // #93a1a1 (base1)
    muted: fg256(243),        // #657b83 (base00)
    inverse: fg256(235),      // #002b36 (base03)
    success: fg256(71),       // #859900 (green)
    warning: fg256(228),      // #b58900 (yellow)
    error: fg256(167),        // #dc322f (red)
    info: fg256(33),          // #268bd2 (blue)
  },
  border: {
    default: fg256(243),      // #657b83 (base00)
    focus: fg256(33),         // #268bd2 (blue)
    muted: fg256(237),        // #586e75 (base01)
    success: fg256(71),       // #859900 (green)
    warning: fg256(228),      // #b58900 (yellow)
    error: fg256(167),        // #dc322f (red)
  },
  borderStyle: {
    single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
    thick: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
  },
  status: {
    success: fg256(71),       // #859900 (green)
    warning: fg256(228),      // #b58900 (yellow)
    error: fg256(167),        // #dc322f (red)
    info: fg256(33),          // #268bd2 (blue)
    muted: fg256(243),        // #657b83 (base00)
  },
  logLevel: {
    debug: fg256(243),        // #657b83 (base00)
    info: fg256(33),          // #268bd2 (blue)
    warn: fg256(228),         // #b58900 (yellow)
    error: fg256(167),        // #dc322f (red)
    fatal: `\x1b[1m${fg256(167)}`,
  },
  panel: {
    chat: fg256(33),          // #268bd2 (blue)
    status: fg256(71),        // #859900 (green)
    metrics: fg256(133),      // #6c71c4 (violet)
    tokens: fg256(139),       // #cb4b16 (orange)
    agents: fg256(167),       // #dc322f (red)
    tools: fg256(37),         // #2aa198 (cyan)
    logs: fg256(243),         // #657b83 (base00)
    help: fg256(252),         // #fdf6e3 (base3)
    history: fg256(133),      // #6c71c4 (violet)
    config: fg256(71),        // #859900 (green)
  },
  accent: {
    primary: fg256(33),       // #268bd2 (blue)
    secondary: fg256(133),    // #6c71c4 (violet)
    hover: fg256(37),         // #2aa198 (cyan)
    active: fg256(33),        // #268bd2 (blue)
  },
  shadow: {
    light: fg256(237),        // #586e75 (base01)
    medium: fg256(236),       // #657b83 (base00)
    dark: fg256(235),         // #002b36 (base03)
  },
};
