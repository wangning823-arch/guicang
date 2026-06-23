/**
 * TUI 颜色主题
 * ANSI 转义序列颜色定义
 *
 * 注意：此文件为向后兼容保留，新代码请使用 ./theme/ 模块
 */

// 重新导出旧版兼容层
export { Colors, Theme, colorize, bold, dim, withBg } from './theme/legacy.js';

// 重新导出新版主题系统
export { ThemeManager, defaultThemeManager } from './theme/index.js';
export { darkTokens, lightTokens } from './theme/tokens.js';
export type { DesignTokens, ThemeName } from './theme/index.js';
export { FG, BG, STYLE, RESET, Palette256, fg256, bg256, fgRGB, bgRGB } from './theme/colors.js';
