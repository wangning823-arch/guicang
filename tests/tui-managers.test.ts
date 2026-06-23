/**
 * TUI 管理器测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LayoutManager } from '../src/tui/managers/layout.js';
import { SessionManager } from '../src/tui/managers/session.js';
import { SearchManager } from '../src/tui/managers/search.js';
import { ClipboardManager } from '../src/tui/managers/clipboard.js';
import { KeybindingManager } from '../src/tui/managers/keybinding.js';

describe('LayoutManager', () => {
  let manager: LayoutManager;

  beforeEach(() => {
    manager = new LayoutManager();
  });

  it('should create with default layout', () => {
    expect(manager.getLayoutName()).toBe('default');
  });

  it('should get panels', () => {
    const panels = manager.getPanels();
    expect(panels.length).toBeGreaterThan(0);
    expect(panels.find(p => p.id === 'chat')).toBeDefined();
  });

  it('should get specific panel', () => {
    const panel = manager.getPanel('chat');
    expect(panel).toBeDefined();
    expect(panel?.id).toBe('chat');
  });

  it('should switch layout', () => {
    manager.setLayout('focus');
    expect(manager.getLayoutName()).toBe('focus');
    const panels = manager.getPanels();
    expect(panels.length).toBe(1);
    expect(panels[0].id).toBe('chat');
  });

  it('should get available layouts', () => {
    const layouts = manager.getAvailableLayouts();
    expect(layouts).toContain('default');
    expect(layouts).toContain('focus');
    expect(layouts).toContain('monitor');
    expect(layouts).toContain('agents');
  });

  it('should toggle panel visibility', () => {
    const panel = manager.getPanel('chat');
    expect(panel?.visible).toBe(true);
    manager.togglePanel('chat');
    expect(panel?.visible).toBe(false);
    manager.togglePanel('chat');
    expect(panel?.visible).toBe(true);
  });

  it('should save and load custom layout', () => {
    manager.saveLayout('custom');
    const layouts = manager.getAvailableLayouts();
    expect(layouts).toContain('custom');
  });

  it('should reset layout', () => {
    manager.setLayout('focus');
    manager.resetLayout();
    expect(manager.getLayoutName()).toBe('default');
  });

  it('should notify listeners on layout change', () => {
    let notified = false;
    manager.onLayoutChange(() => {
      notified = true;
    });
    manager.setLayout('focus');
    expect(notified).toBe(true);
  });
});

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it('should create with default session', () => {
    const sessions = manager.getAllSessions();
    expect(sessions.length).toBe(1);
    expect(sessions[0].name).toBe('默认会话');
  });

  it('should create new session', () => {
    const session = manager.createSession('测试会话');
    expect(session.name).toBe('测试会话');
    expect(manager.getAllSessions().length).toBe(2);
  });

  it('should get current session', () => {
    const session = manager.getCurrentSession();
    expect(session).toBeDefined();
  });

  it('should switch session', () => {
    const session2 = manager.createSession('会话2');
    const success = manager.setCurrentSession(session2.id);
    expect(success).toBe(true);
    expect(manager.getCurrentSession()?.id).toBe(session2.id);
  });

  it('should delete session', () => {
    const session2 = manager.createSession('会话2');
    const success = manager.deleteSession(session2.id);
    expect(success).toBe(true);
    expect(manager.getAllSessions().length).toBe(1);
  });

  it('should not delete last session', () => {
    const sessions = manager.getAllSessions();
    const success = manager.deleteSession(sessions[0].id);
    expect(success).toBe(false);
  });

  it('should rename session', () => {
    const sessions = manager.getAllSessions();
    const success = manager.renameSession(sessions[0].id, '新名称');
    expect(success).toBe(true);
    expect(manager.getSession(sessions[0].id)?.name).toBe('新名称');
  });

  it('should search sessions', () => {
    manager.createSession('测试会话1');
    manager.createSession('测试会话2');
    const results = manager.searchSessions('测试');
    expect(results.length).toBe(2);
  });

  it('should export session as JSON', () => {
    const sessions = manager.getAllSessions();
    const json = manager.exportSession(sessions[0].id);
    expect(json).toBeDefined();
    expect(json).toContain('session_');
  });

  it('should export session as Markdown', () => {
    const sessions = manager.getAllSessions();
    const md = manager.exportSessionAsMarkdown(sessions[0].id);
    expect(md).toBeDefined();
    expect(md).toContain('# 默认会话');
  });

  it('should fork session', () => {
    const sessions = manager.getAllSessions();
    const forked = manager.forkSession(sessions[0].id);
    expect(forked).toBeDefined();
    expect(forked?.name).toContain('分叉');
  });
});

describe('SearchManager', () => {
  let manager: SearchManager;

  beforeEach(() => {
    manager = new SearchManager();
  });

  it('should search chat messages', () => {
    manager.updateChatMessages([
      { role: 'user', content: 'Hello world' },
      { role: 'assistant', content: 'Hi there' },
    ]);
    const results = manager.search('hello', 'chat');
    expect(results.length).toBe(1);
    expect(results[0].type).toBe('chat');
  });

  it('should search log entries', () => {
    manager.updateLogEntries([
      { level: 'info', message: 'Server started', module: 'server', timestamp: new Date() },
      { level: 'error', message: 'Connection failed', module: 'db', timestamp: new Date() },
    ]);
    const results = manager.search('server', 'logs');
    expect(results.length).toBe(1);
    expect(results[0].type).toBe('log');
  });

  it('should search across all scopes', () => {
    manager.updateChatMessages([{ role: 'user', content: 'test message' }]);
    manager.updateLogEntries([{ level: 'info', message: 'test log', module: 'app', timestamp: new Date() }]);
    const results = manager.search('test', 'all');
    expect(results.length).toBe(2);
  });

  it('should filter logs by level', () => {
    manager.updateLogEntries([
      { level: 'info', message: 'info1', module: 'app', timestamp: new Date() },
      { level: 'error', message: 'error1', module: 'app', timestamp: new Date() },
    ]);
    const filtered = manager.filterLogs({ levels: ['error'] });
    expect(filtered.length).toBe(1);
    expect(filtered[0].level).toBe('error');
  });

  it('should filter tools by status', () => {
    manager.updateToolCalls([
      { name: 'tool1', status: 'success', duration: 100, timestamp: new Date() },
      { name: 'tool2', status: 'failed', duration: 50, timestamp: new Date() },
    ]);
    const filtered = manager.filterTools({ status: 'success' });
    expect(filtered.length).toBe(1);
    expect(filtered[0].status).toBe('success');
  });
});

describe('ClipboardManager', () => {
  let manager: ClipboardManager;

  beforeEach(() => {
    manager = new ClipboardManager(5);
  });

  it('should yank text to internal buffer', () => {
    manager.yank('hello');
    expect(manager.getHistory()).toContain('hello');
  });

  it('should paste from internal buffer', () => {
    manager.yank('hello');
    const text = manager.pasteInternal();
    expect(text).toBe('hello');
  });

  it('should maintain history order', () => {
    manager.yank('a');
    manager.yank('b');
    manager.yank('c');
    const history = manager.getHistory();
    expect(history).toEqual(['a', 'b', 'c']);
  });

  it('should limit history size', () => {
    for (let i = 0; i < 10; i++) {
      manager.yank(`item${i}`);
    }
    const history = manager.getHistory();
    expect(history.length).toBe(5);
  });

  it('should remove duplicates', () => {
    manager.yank('a');
    manager.yank('b');
    manager.yank('a');
    const history = manager.getHistory();
    expect(history).toEqual(['b', 'a']);
  });

  it('should select from history', () => {
    manager.yank('a');
    manager.yank('b');
    manager.yank('c');
    const text = manager.selectFromHistory(0);
    expect(text).toBe('a');
    // 应该移到末尾
    expect(manager.getHistory()).toEqual(['b', 'c', 'a']);
  });

  it('should clear history', () => {
    manager.yank('a');
    manager.clearHistory();
    expect(manager.getHistory()).toEqual([]);
  });
});

describe('KeybindingManager', () => {
  let manager: KeybindingManager;

  beforeEach(() => {
    manager = new KeybindingManager();
  });

  it('should create with default preset', () => {
    expect(manager.getPreset()).toBe('default');
  });

  it('should get all bindings', () => {
    const bindings = manager.getAllBindings();
    expect(bindings.length).toBeGreaterThan(0);
  });

  it('should get help text', () => {
    const helpText = manager.getHelpText();
    expect(helpText.length).toBeGreaterThan(0);
    expect(helpText[0]).toContain('TAB');
  });

  it('should load vim preset', () => {
    manager.loadPreset('vim');
    expect(manager.getPreset()).toBe('vim');
    const bindings = manager.getAllBindings();
    expect(bindings.some(b => b.keys.includes('ctrl+h'))).toBe(true);
  });

  it('should load emacs preset', () => {
    manager.loadPreset('emacs');
    expect(manager.getPreset()).toBe('emacs');
  });

  it('should register custom binding', () => {
    manager.register(['ctrl+d'], 'quit', '自定义退出');
    const bindings = manager.getAllBindings();
    expect(bindings.some(b => b.action === 'quit' && b.keys.includes('ctrl+d'))).toBe(true);
  });

  it('should unregister binding', () => {
    manager.unregister('quit');
    const bindings = manager.getAllBindings();
    expect(bindings.filter(b => b.action === 'quit').length).toBe(0);
  });

  it('should check conflicts', () => {
    // 默认配置没有冲突
    const conflicts = manager.checkConflicts();
    expect(conflicts.length).toBe(0);
  });

  it('should handle key events', () => {
    let actionTriggered = '';
    manager.onAction('panel.next', () => {
      actionTriggered = 'panel.next';
    });

    const result = manager.handleKeyEvent({
      key: '\t',
      ctrl: false,
      meta: false,
      shift: false,
      name: 'tab',
    });

    expect(result).toBe('panel.next');
    expect(actionTriggered).toBe('panel.next');
  });

  it('should filter bindings by scope', () => {
    const chatBindings = manager.getBindingsForScope('chat');
    expect(chatBindings.some(b => b.action === 'chat.send')).toBe(true);
  });
});
