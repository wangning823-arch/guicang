/**
 * TUI 主题系统测试
 */

import { describe, it, expect } from 'vitest';
import { ThemeManager } from '../src/tui/theme/index.js';
import { darkTokens, lightTokens } from '../src/tui/theme/tokens.js';
import { FG, BG, STYLE, RESET, fg256, bg256, fgRGB, bgRGB } from '../src/tui/theme/colors.js';
import { Colors, Theme, colorize, bold, dim, withBg } from '../src/tui/theme/legacy.js';

describe('ThemeManager', () => {
  it('should create with default theme', () => {
    const manager = new ThemeManager();
    expect(manager.getName()).toBe('dark');
  });

  it('should create with specified theme', () => {
    const manager = new ThemeManager('light');
    expect(manager.getName()).toBe('light');
  });

  it('should get tokens for current theme', () => {
    const manager = new ThemeManager();
    const tokens = manager.getTokens();
    expect(tokens).toBe(darkTokens);
  });

  it('should switch theme', () => {
    const manager = new ThemeManager();
    manager.setTheme('light');
    expect(manager.getName()).toBe('light');
    expect(manager.getTokens()).toBe(lightTokens);
  });

  it('should switch to next theme', () => {
    const manager = new ThemeManager();
    expect(manager.getName()).toBe('dark');
    manager.nextTheme();
    expect(manager.getName()).toBe('light');
    manager.nextTheme();
    expect(manager.getName()).toBe('dark');
  });

  it('should get available themes', () => {
    const manager = new ThemeManager();
    const themes = manager.getAvailableThemes();
    expect(themes).toContain('dark');
    expect(themes).toContain('light');
  });

  it('should notify listeners on theme change', () => {
    const manager = new ThemeManager();
    let notifiedTheme = '';
    manager.onThemeChange(theme => {
      notifiedTheme = theme;
    });
    manager.setTheme('light');
    expect(notifiedTheme).toBe('light');
  });
});

describe('Color Constants', () => {
  it('should have correct ANSI codes', () => {
    expect(FG.red).toBe('\x1b[31m');
    expect(FG.brightGreen).toBe('\x1b[92m');
    expect(BG.blue).toBe('\x1b[44m');
    expect(BG.brightCyan).toBe('\x1b[106m');
    expect(STYLE.bold).toBe('\x1b[1m');
    expect(STYLE.italic).toBe('\x1b[3m');
    expect(RESET).toBe('\x1b[0m');
  });

  it('should create 256 color codes', () => {
    expect(fg256(208)).toBe('\x1b[38;5;208m');
    expect(bg256(42)).toBe('\x1b[48;5;42m');
  });

  it('should create RGB color codes', () => {
    expect(fgRGB(255, 128, 0)).toBe('\x1b[38;2;255;128;0m');
    expect(bgRGB(0, 255, 128)).toBe('\x1b[48;2;0;255;128m');
  });
});

describe('Legacy Compatibility', () => {
  it('should have legacy Colors object', () => {
    expect(Colors.red).toBe('\x1b[31m');
    expect(Colors.bold).toBe('\x1b[1m');
    expect(Colors.reset).toBe('\x1b[0m');
  });

  it('should have legacy Theme object', () => {
    expect(Theme.primary).toBe(FG.brightCyan);
    expect(Theme.success).toBe(FG.brightGreen);
  });

  it('should colorize text', () => {
    const result = colorize('hello', FG.red);
    expect(result).toBe('\x1b[31mhello\x1b[0m');
  });

  it('should bold text', () => {
    const result = bold('hello');
    expect(result).toBe('\x1b[1mhello\x1b[0m');
  });

  it('should dim text', () => {
    const result = dim('hello');
    expect(result).toBe('\x1b[2mhello\x1b[0m');
  });

  it('should add background', () => {
    const result = withBg('hello', BG.blue);
    expect(result).toBe('\x1b[44mhello\x1b[0m');
  });
});

describe('Design Tokens', () => {
  it('should have dark theme tokens', () => {
    expect(darkTokens.bg.primary).toBe(BG.black);
    expect(darkTokens.fg.primary).toBe(FG.brightWhite);
    expect(darkTokens.border.focus).toBe(FG.brightCyan);
  });

  it('should have light theme tokens', () => {
    expect(lightTokens.bg.primary).toBe(BG.white);
    expect(lightTokens.fg.primary).toBe('\x1b[38;5;234m');
  });

  it('should have border styles', () => {
    expect(darkTokens.borderStyle.single.tl).toBe('┌');
    expect(darkTokens.borderStyle.double.tl).toBe('╔');
    expect(darkTokens.borderStyle.rounded.tl).toBe('╭');
    expect(darkTokens.borderStyle.thick.tl).toBe('┏');
  });

  it('should have status colors', () => {
    expect(darkTokens.status.success).toBe(FG.brightGreen);
    expect(darkTokens.status.warning).toBe(FG.brightYellow);
    expect(darkTokens.status.error).toBe(FG.brightRed);
  });

  it('should have log level colors', () => {
    expect(darkTokens.logLevel.debug).toBe(FG.brightBlack);
    expect(darkTokens.logLevel.info).toBe(FG.brightCyan);
    expect(darkTokens.logLevel.warn).toBe(FG.brightYellow);
    expect(darkTokens.logLevel.error).toBe(FG.brightRed);
  });
});
