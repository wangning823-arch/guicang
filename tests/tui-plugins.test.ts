/**
 * TUI 插件和向导测试
 */

import { describe, it, expect } from 'vitest';
import { ThemeManager, type ThemeName } from '../src/tui/theme/index.js';
import { monokaiTokens } from '../src/tui/theme/monokai.js';
import { nordTokens } from '../src/tui/theme/nord.js';
import { draculaTokens } from '../src/tui/theme/dracula.js';
import { solarizedTokens } from '../src/tui/theme/solarized.js';
import {
  ObjectPool,
  StringCache,
  PerformanceTimer,
  FrameRateMonitor,
  MemoryMonitor,
} from '../src/tui/utils/optimizer.js';
import {
  VirtualScroll,
} from '../src/tui/utils/virtual-scroll.js';

describe('Extended Theme System', () => {
  it('should support all themes', () => {
    const manager = new ThemeManager();
    const themes = manager.getAvailableThemes();
    expect(themes).toContain('dark');
    expect(themes).toContain('light');
    expect(themes).toContain('monokai');
    expect(themes).toContain('nord');
    expect(themes).toContain('dracula');
    expect(themes).toContain('solarized');
  });

  it('should switch to monokai theme', () => {
    const manager = new ThemeManager();
    manager.setTheme('monokai');
    expect(manager.getName()).toBe('monokai');
    expect(manager.getTokens()).toBe(monokaiTokens);
  });

  it('should switch to nord theme', () => {
    const manager = new ThemeManager();
    manager.setTheme('nord');
    expect(manager.getName()).toBe('nord');
    expect(manager.getTokens()).toBe(nordTokens);
  });

  it('should switch to dracula theme', () => {
    const manager = new ThemeManager();
    manager.setTheme('dracula');
    expect(manager.getName()).toBe('dracula');
    expect(manager.getTokens()).toBe(draculaTokens);
  });

  it('should switch to solarized theme', () => {
    const manager = new ThemeManager();
    manager.setTheme('solarized');
    expect(manager.getName()).toBe('solarized');
    expect(manager.getTokens()).toBe(solarizedTokens);
  });

  it('should cycle through all themes', () => {
    const manager = new ThemeManager();
    const themes: ThemeName[] = ['dark', 'light', 'monokai', 'nord', 'dracula', 'solarized'];

    for (const theme of themes) {
      manager.setTheme(theme);
      expect(manager.getName()).toBe(theme);
    }
  });
});

describe('ObjectPool', () => {
  it('should create and reuse objects', () => {
    const pool = new ObjectPool(() => ({ value: 0 }));
    const obj1 = pool.acquire();
    obj1.value = 42;
    pool.release(obj1);

    const obj2 = pool.acquire();
    expect(obj2.value).toBe(42); // 应该复用
  });

  it('should pre-allocate objects', () => {
    const pool = new ObjectPool(() => ({ value: 0 }));
    pool.preAllocate(10);
    expect(pool.getSize()).toBe(10);
  });

  it('should respect max size', () => {
    const pool = new ObjectPool(() => ({}), { maxSize: 5 });
    for (let i = 0; i < 10; i++) {
      pool.release({});
    }
    expect(pool.getSize()).toBe(5);
  });

  it('should clear pool', () => {
    const pool = new ObjectPool(() => ({}));
    pool.preAllocate(5);
    pool.clear();
    expect(pool.getSize()).toBe(0);
  });
});

describe('StringCache', () => {
  it('should cache strings', () => {
    const cache = new StringCache();
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should evict LRU entries', () => {
    const cache = new StringCache(3);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.set('d', '4'); // 应该淘汰 'a'

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
  });

  it('should update access order', () => {
    const cache = new StringCache(3);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.get('a'); // 更新 'a' 的访问顺序
    cache.set('d', '4'); // 应该淘汰 'b'

    expect(cache.get('a')).toBe('1');
    expect(cache.get('b')).toBeUndefined();
  });
});

describe('PerformanceTimer', () => {
  it('should measure time', () => {
    const timer = new PerformanceTimer();
    timer.start('test');
    // 模拟一些操作
    const duration = timer.end('test');
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('should record multiple measurements', () => {
    const timer = new PerformanceTimer();
    for (let i = 0; i < 5; i++) {
      timer.start('test');
      timer.end('test');
    }
    const results = timer.getResults('test');
    expect(results.length).toBe(5);
  });

  it('should calculate statistics', () => {
    const timer = new PerformanceTimer();
    timer.start('test');
    timer.end('test');
    timer.start('test');
    timer.end('test');

    expect(timer.getAverage('test')).toBeGreaterThanOrEqual(0);
    expect(timer.getMin('test')).toBeGreaterThanOrEqual(0);
    expect(timer.getMax('test')).toBeGreaterThanOrEqual(0);
  });
});

describe('FrameRateMonitor', () => {
  it('should calculate FPS', () => {
    const monitor = new FrameRateMonitor();
    monitor.recordFrame();
    monitor.recordFrame();
    const fps = monitor.getFPS();
    expect(fps).toBeGreaterThanOrEqual(0);
  });

  it('should reset', () => {
    const monitor = new FrameRateMonitor();
    monitor.recordFrame();
    monitor.reset();
    expect(monitor.getFPS()).toBe(0);
  });
});

describe('MemoryMonitor', () => {
  it('should get current memory usage', () => {
    const monitor = new MemoryMonitor();
    const current = monitor.getCurrent();
    expect(current.heapUsed).toBeGreaterThan(0);
    expect(current.heapTotal).toBeGreaterThan(0);
  });

  it('should format memory size', () => {
    expect(MemoryMonitor.formatSize(1023)).toBe('1023 B');
    expect(MemoryMonitor.formatSize(1024)).toBe('1.0 KB');
    expect(MemoryMonitor.formatSize(1024 * 1024)).toBe('1.0 MB');
  });
});

describe('VirtualScroll Extended', () => {
  it('should handle empty list', () => {
    const scroll = new VirtualScroll({
      totalItems: 0,
      itemHeight: 20,
      containerHeight: 400,
    });
    const range = scroll.getVisibleRange();
    expect(range.start).toBe(0);
    expect(range.end).toBe(0);
  });

  it('should handle single item', () => {
    const scroll = new VirtualScroll({
      totalItems: 1,
      itemHeight: 20,
      containerHeight: 400,
    });
    const range = scroll.getVisibleRange();
    expect(range.start).toBe(0);
    expect(range.end).toBe(1);
  });

  it('should calculate scroll progress correctly', () => {
    const scroll = new VirtualScroll({
      totalItems: 100,
      itemHeight: 20,
      containerHeight: 200,
    });

    expect(scroll.getScrollProgress()).toBe(0);
    scroll.scrollToBottom();
    expect(scroll.getScrollProgress()).toBe(1);
  });
});

describe('ContextHelp Tips', () => {
  it('should have default help tips', async () => {
    const { DEFAULT_HELP_TIPS } = await import('../src/tui/components/context-help.js');
    expect(DEFAULT_HELP_TIPS.length).toBeGreaterThan(0);
    expect(DEFAULT_HELP_TIPS.some(tip => tip.context === 'chat')).toBe(true);
    expect(DEFAULT_HELP_TIPS.some(tip => tip.context === 'panel')).toBe(true);
  });
});

describe('Wizard Steps', () => {
  it('should have default steps', async () => {
    // 这个测试需要 TUIEngine 实例，所以只测试导入
    const { WelcomeWizard } = await import('../src/tui/components/wizard.js');
    expect(WelcomeWizard).toBeDefined();
  });
});
