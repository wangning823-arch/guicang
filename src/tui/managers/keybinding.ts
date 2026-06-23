/**
 * 快捷键管理器
 * 管理键盘快捷键绑定
 */

import type { KeyEvent } from '../engine.js';

/** 动作类型 */
export type Action =
  | 'panel.next' | 'panel.prev' | 'panel.focus'
  | 'chat.send' | 'chat.clear' | 'chat.history'
  | 'search.open' | 'search.next' | 'search.prev'
  | 'session.new' | 'session.switch' | 'session.list'
  | 'copy' | 'paste' | 'cut'
  | 'undo' | 'redo'
  | 'bookmark.add' | 'bookmark.list'
  | 'help.toggle' | 'help.keys'
  | 'theme.switch'
  | 'layout.save' | 'layout.load' | 'layout.reset'
  | 'quit';

/** 快捷键绑定 */
export interface KeyBinding {
  keys: string[];
  action: Action;
  description: string;
  scope?: string;
}

/** 快捷键预设 */
export type KeybindingPreset = 'default' | 'vim' | 'emacs';

/** 默认快捷键配置 */
const DEFAULT_BINDINGS: KeyBinding[] = [
  // 面板导航
  { keys: ['tab'], action: 'panel.next', description: '切换到下一个面板' },
  { keys: ['shift+tab'], action: 'panel.prev', description: '切换到上一个面板' },

  // 聊天
  { keys: ['return'], action: 'chat.send', description: '发送消息', scope: 'chat' },
  { keys: ['ctrl+u'], action: 'chat.clear', description: '清空输入', scope: 'chat' },
  { keys: ['up'], action: 'chat.history', description: '历史消息', scope: 'chat' },

  // 搜索
  { keys: ['ctrl+f'], action: 'search.open', description: '打开搜索' },
  { keys: ['ctrl+g'], action: 'search.next', description: '下一个结果' },
  { keys: ['ctrl+shift+g'], action: 'search.prev', description: '上一个结果' },

  // 会话
  { keys: ['ctrl+n'], action: 'session.new', description: '新建会话' },
  { keys: ['ctrl+o'], action: 'session.switch', description: '切换会话' },
  { keys: ['ctrl+l'], action: 'session.list', description: '会话列表' },

  // 剪贴板
  { keys: ['ctrl+c'], action: 'copy', description: '复制' },
  { keys: ['ctrl+v'], action: 'paste', description: '粘贴' },
  { keys: ['ctrl+x'], action: 'cut', description: '剪切' },

  // 撤销/重做
  { keys: ['ctrl+z'], action: 'undo', description: '撤销' },
  { keys: ['ctrl+y'], action: 'redo', description: '重做' },

  // 书签
  { keys: ['ctrl+b'], action: 'bookmark.add', description: '添加书签' },
  { keys: ['ctrl+shift+b'], action: 'bookmark.list', description: '书签列表' },

  // 帮助
  { keys: ['f1'], action: 'help.toggle', description: '帮助' },
  { keys: ['?'], action: 'help.keys', description: '快捷键帮助' },

  // 主题
  { keys: ['ctrl+t'], action: 'theme.switch', description: '切换主题' },

  // 布局
  { keys: ['f2'], action: 'layout.load', description: '加载布局' },
  { keys: ['ctrl+s'], action: 'layout.save', description: '保存布局' },
  { keys: ['ctrl+r'], action: 'layout.reset', description: '重置布局' },

  // 退出
  { keys: ['ctrl+q'], action: 'quit', description: '退出' },
  { keys: ['q'], action: 'quit', description: '退出', scope: 'panel' },
];

/** Vim 快捷键配置 */
const VIM_BINDINGS: KeyBinding[] = [
  // 面板导航 (hjkl)
  { keys: ['ctrl+h'], action: 'panel.prev', description: '上一个面板' },
  { keys: ['ctrl+l'], action: 'panel.next', description: '下一个面板' },

  // 聊天
  { keys: ['i'], action: 'panel.focus', description: '进入插入模式', scope: 'chat' },
  { keys: ['escape'], action: 'panel.prev', description: '退出插入模式' },

  // 搜索
  { keys: ['/'], action: 'search.open', description: '搜索' },
  { keys: ['n'], action: 'search.next', description: '下一个结果' },
  { keys: ['N'], action: 'search.prev', description: '上一个结果' },

  // 其他保持默认
  ...DEFAULT_BINDINGS.filter(b =>
    !['tab', 'shift+tab', 'ctrl+f', 'ctrl+g', 'ctrl+shift+g'].includes(b.keys[0])
  ),
];

/** Emacs 快捷键配置 */
const EMACS_BINDINGS: KeyBinding[] = [
  // 面板导航
  { keys: ['alt+n'], action: 'panel.next', description: '下一个面板' },
  { keys: ['alt+p'], action: 'panel.prev', description: '上一个面板' },

  // 搜索
  { keys: ['ctrl+s'], action: 'search.open', description: '搜索' },
  { keys: ['ctrl+r'], action: 'search.open', description: '反向搜索' },

  // 其他保持默认
  ...DEFAULT_BINDINGS.filter(b =>
    !['ctrl+f', 'ctrl+s', 'ctrl+r'].includes(b.keys[0])
  ),
];

/** 快捷键管理器 */
export class KeybindingManager {
  private bindings: KeyBinding[] = [];
  private preset: KeybindingPreset = 'default';
  private customBindings: KeyBinding[] = [];
  private listeners: Map<Action, Array<(event: KeyEvent) => void>> = new Map();

  constructor(preset: KeybindingPreset = 'default') {
    this.preset = preset;
    this.loadPreset(preset);
  }

  /** 加载预设 */
  loadPreset(preset: KeybindingPreset): void {
    this.preset = preset;
    switch (preset) {
      case 'vim':
        this.bindings = [...VIM_BINDINGS];
        break;
      case 'emacs':
        this.bindings = [...EMACS_BINDINGS];
        break;
      default:
        this.bindings = [...DEFAULT_BINDINGS];
    }
    // 添加自定义绑定
    this.bindings.push(...this.customBindings);
  }

  /** 获取当前预设 */
  getPreset(): KeybindingPreset {
    return this.preset;
  }

  /** 注册自定义快捷键 */
  register(keys: string[], action: Action, description: string, scope?: string): void {
    const binding: KeyBinding = { keys, action, description, scope };
    this.customBindings.push(binding);
    this.bindings.push(binding);
  }

  /** 注销快捷键 */
  unregister(action: string): void {
    this.bindings = this.bindings.filter(b => b.action !== action);
    this.customBindings = this.customBindings.filter(b => b.action !== action);
  }

  /** 获取所有快捷键 */
  getAllBindings(): KeyBinding[] {
    return [...this.bindings];
  }

  /** 获取指定作用域的快捷键 */
  getBindingsForScope(scope: string): KeyBinding[] {
    return this.bindings.filter(b => !b.scope || b.scope === scope);
  }

  /** 获取快捷键帮助文本 */
  getHelpText(): string[] {
    return this.bindings.map(b => {
      const keys = b.keys.map(k => k.toUpperCase()).join(' + ');
      return `${keys.padEnd(20)} ${b.description}`;
    });
  }

  /** 检测按键并触发动作 */
  handleKeyEvent(event: KeyEvent, currentScope?: string): Action | null {
    // 构建按键字符串
    const keyParts: string[] = [];
    if (event.ctrl) keyParts.push('ctrl');
    if (event.meta) keyParts.push('alt');
    if (event.shift) keyParts.push('shift');
    keyParts.push(event.name);

    const keyString = keyParts.join('+');

    // 查找匹配的绑定
    for (const binding of this.bindings) {
      // 检查作用域
      if (binding.scope && binding.scope !== currentScope) {
        continue;
      }

      // 检查按键
      if (binding.keys.includes(keyString)) {
        this.triggerAction(binding.action, event);
        return binding.action;
      }
    }

    return null;
  }

  /** 触发动作 */
  private triggerAction(action: Action, event: KeyEvent): void {
    const handlers = this.listeners.get(action);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }
  }

  /** 监听动作 */
  onAction(action: Action, handler: (event: KeyEvent) => void): () => void {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, []);
    }
    this.listeners.get(action)!.push(handler);

    return () => {
      const handlers = this.listeners.get(action);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /** 冲突检测 */
  checkConflicts(): Array<{ keys: string[]; actions: Action[] }> {
    const conflicts: Array<{ keys: string[]; actions: Action[] }> = [];
    const keyMap = new Map<string, Action[]>();

    for (const binding of this.bindings) {
      for (const key of binding.keys) {
        const existing = keyMap.get(key) || [];
        existing.push(binding.action);
        keyMap.set(key, existing);
      }
    }

    for (const [keys, actions] of keyMap) {
      if (actions.length > 1) {
        conflicts.push({ keys: [keys], actions });
      }
    }

    return conflicts;
  }
}
