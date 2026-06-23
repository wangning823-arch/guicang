/**
 * Nord 主题
 */

import { fg256, bg256 } from './colors.js';
import type { DesignTokens } from './tokens.js';

export const nordTokens: DesignTokens = {
  bg: {
    primary: bg256(0),        // #2e3440
    secondary: bg256(18),     // #3b4252
    tertiary: bg256(19),      // #434c5e
    elevated: bg256(20),      // #4c566a
    overlay: bg256(21),       // #d8dee9
    success: bg256(72),       // #a3be8c
    warning: bg256(221),      // #ebcb8b
    error: bg256(167),        // #bf616a
    info: bg256(67),          // #81a1c1
  },
  fg: {
    primary: fg256(255),      // #eceff4
    secondary: fg256(254),    // #e5e9f0
    tertiary: fg256(253),     // #d8dee9
    muted: fg256(243),        // #4c566a
    inverse: fg256(0),        // #2e3440
    success: fg256(72),       // #a3be8c
    warning: fg256(221),      // #ebcb8b
    error: fg256(167),        // #bf616a
    info: fg256(67),          // #81a1c1
  },
  border: {
    default: fg256(243),      // #4c566a
    focus: fg256(75),         // #88c0d0
    muted: fg256(20),         // #4c566a
    success: fg256(72),       // #a3be8c
    warning: fg256(221),      // #ebcb8b
    error: fg256(167),        // #bf616a
  },
  borderStyle: {
    single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
    thick: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
  },
  status: {
    success: fg256(72),       // #a3be8c
    warning: fg256(221),      // #ebcb8b
    error: fg256(167),        // #bf616a
    info: fg256(75),          // #88c0d0
    muted: fg256(243),        // #4c566a
  },
  logLevel: {
    debug: fg256(243),        // #4c566a
    info: fg256(75),          // #88c0d0
    warn: fg256(214),         // #d08770
    error: fg256(167),        // #bf616a
    fatal: `\x1b[1m${fg256(167)}`,
  },
  panel: {
    chat: fg256(75),          // #88c0d0
    status: fg256(72),        // #a3be8c
    metrics: fg256(140),      // #b48ead
    tokens: fg256(139),       // #a3be8c
    agents: fg256(214),       // #d08770
    tools: fg256(75),         // #88c0d0
    logs: fg256(243),         // #4c566a
    help: fg256(255),         // #eceff4
    history: fg256(140),      // #b48ead
    config: fg256(72),        // #a3be8c
  },
  accent: {
    primary: fg256(75),       // #88c0d0
    secondary: fg256(140),    // #b48ead
    hover: fg256(109),        // #8fbcbb
    active: fg256(108),       // #88c0d0
  },
  shadow: {
    light: fg256(20),         // #4c566a
    medium: fg256(19),        // #434c5e
    dark: fg256(18),          // #3b4252
  },
};
