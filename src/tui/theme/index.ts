/**
 * 主题管理器
 * 管理主题切换和当前主题
 */

import { darkTokens, lightTokens } from './tokens.js';
import type { DesignTokens } from './tokens.js';

/** 主题名称 */
export type ThemeName = 'dark' | 'light';

/** 主题配置 */
interface ThemeConfig {
  name: ThemeName;
  tokens: DesignTokens;
}

/** 主题管理器 */
export class ThemeManager {
  private currentTheme: ThemeName;
  private themes: Map<ThemeName, ThemeConfig> = new Map();
  private listeners: Array<(theme: ThemeName) => void> = [];

  constructor(initialTheme: ThemeName = 'dark') {
    // 注册主题
    this.themes.set('dark', { name: 'dark', tokens: darkTokens });
    this.themes.set('light', { name: 'light', tokens: lightTokens });

    this.currentTheme = initialTheme;
  }

  /** 获取当前主题名称 */
  getName(): ThemeName {
    return this.currentTheme;
  }

  /** 获取当前主题令牌 */
  getTokens(): DesignTokens {
    return this.themes.get(this.currentTheme)!.tokens;
  }

  /** 获取指定主题的令牌 */
  getTokensByName(name: ThemeName): DesignTokens | undefined {
    return this.themes.get(name)?.tokens;
  }

  /** 切换主题 */
  setTheme(name: ThemeName): void {
    if (this.currentTheme !== name && this.themes.has(name)) {
      this.currentTheme = name;
      this.notifyListeners();
    }
  }

  /** 切换到下一个主题 */
  nextTheme(): void {
    const themes: ThemeName[] = ['dark', 'light'];
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    this.setTheme(themes[nextIndex]);
  }

  /** 获取所有可用主题 */
  getAvailableThemes(): ThemeName[] {
    return Array.from(this.themes.keys());
  }

  /** 注册新主题 */
  registerTheme(name: ThemeName, tokens: DesignTokens): void {
    this.themes.set(name, { name, tokens });
  }

  /** 监听主题变化 */
  onThemeChange(listener: (theme: ThemeName) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /** 通知监听者 */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentTheme);
    }
  }
}

/** 默认主题管理器实例 */
export const defaultThemeManager = new ThemeManager();

// 重新导出所有令牌和颜色
export { darkTokens, lightTokens } from './tokens.js';
export type { DesignTokens, BackgroundTokens, ForegroundTokens, BorderTokens, StatusTokens } from './tokens.js';
export { colorize, bold, dim, italic, underline, withBg } from './tokens.js';
export { FG, BG, STYLE, RESET, Palette256, fg256, bg256, fgRGB, bgRGB } from './colors.js';
