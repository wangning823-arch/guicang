/**
 * TUI 插件系统
 * 支持插件扩展 TUI 功能
 */

import type { ThemeManager } from '../theme/index.js';
import type { KeybindingManager, Action } from '../managers/keybinding.js';

/** 插件上下文 */
export interface PluginContext {
  themeManager: ThemeManager;
  keybindingManager: KeybindingManager;
  registerPanel: (id: string, panel: any) => void;
  registerKeybinding: (keys: string[], action: Action, description: string) => void;
  getLogger: () => any;
}

/** 插件接口 */
export interface TUIPlugin {
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件描述 */
  description?: string;
  /** 插件作者 */
  author?: string;

  /** 安装插件 */
  install: (context: PluginContext) => void | Promise<void>;
  /** 卸载插件 */
  uninstall?: () => void | Promise<void>;

  /** 插件激活 */
  activate?: () => void | Promise<void>;
  /** 插件停用 */
  deactivate?: () => void | Promise<void>;
}

/** 插件信息 */
export interface PluginInfo {
  name: string;
  version: string;
  description?: string;
  author?: string;
  enabled: boolean;
  installed: boolean;
}

/** 插件管理器 */
export class PluginManager {
  private plugins: Map<string, TUIPlugin> = new Map();
  private enabled: Set<string> = new Set();
  private context: PluginContext;
  private listeners: Array<(event: string, plugin: string) => void> = [];

  constructor(context: PluginContext) {
    this.context = context;
  }

  /** 注册插件 */
  register(plugin: TUIPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`);
    }
    this.plugins.set(plugin.name, plugin);
    this.enabled.add(plugin.name);
    this.notifyListeners('registered', plugin.name);
  }

  /** 卸载插件 */
  async unregister(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return false;
    }

    // 调用卸载钩子
    if (plugin.uninstall) {
      await plugin.uninstall();
    }

    this.plugins.delete(name);
    this.enabled.delete(name);
    this.notifyListeners('unregistered', name);
    return true;
  }

  /** 启用插件 */
  async enable(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return false;
    }

    if (!this.enabled.has(name)) {
      this.enabled.add(name);
      if (plugin.activate) {
        await plugin.activate();
      }
      this.notifyListeners('enabled', name);
    }

    return true;
  }

  /** 禁用插件 */
  async disable(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return false;
    }

    if (this.enabled.has(name)) {
      this.enabled.delete(name);
      if (plugin.deactivate) {
        await plugin.deactivate();
      }
      this.notifyListeners('disabled', name);
    }

    return true;
  }

  /** 获取插件 */
  getPlugin(name: string): TUIPlugin | undefined {
    return this.plugins.get(name);
  }

  /** 获取所有插件信息 */
  getAllPlugins(): PluginInfo[] {
    return Array.from(this.plugins.values()).map(p => ({
      name: p.name,
      version: p.version,
      description: p.description,
      author: p.author,
      enabled: this.enabled.has(p.name),
      installed: true,
    }));
  }

  /** 获取已启用的插件 */
  getEnabledPlugins(): TUIPlugin[] {
    return Array.from(this.plugins.values()).filter(p => this.enabled.has(p.name));
  }

  /** 检查插件是否启用 */
  isEnabled(name: string): boolean {
    return this.enabled.has(name);
  }

  /** 检查插件是否已注册 */
  isRegistered(name: string): boolean {
    return this.plugins.has(name);
  }

  /** 安装并激活所有插件 */
  async installAll(): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (this.enabled.has(name)) {
        try {
          await plugin.install(this.context);
          if (plugin.activate) {
            await plugin.activate();
          }
        } catch (error) {
          console.error(`Failed to install plugin "${name}":`, error);
        }
      }
    }
  }

  /** 监听插件事件 */
  onEvent(listener: (event: string, plugin: string) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /** 通知监听者 */
  private notifyListeners(event: string, plugin: string): void {
    for (const listener of this.listeners) {
      listener(event, plugin);
    }
  }
}

/** 示例插件：主题切换增强 */
export const themeSwitcherPlugin: TUIPlugin = {
  name: 'theme-switcher',
  version: '1.0.0',
  description: '增强的主题切换功能，支持快捷键切换主题',
  author: 'guicang',

  install: (context) => {
    // 注册快捷键
    context.registerKeybinding(['ctrl+t'], 'theme.switch', '切换主题');
  },

  activate: () => {
    console.log('Theme switcher plugin activated');
  },

  deactivate: () => {
    console.log('Theme switcher plugin deactivated');
  },
};

/** 示例插件：开发调试工具 */
export const devToolsPlugin: TUIPlugin = {
  name: 'dev-tools',
  version: '1.0.0',
  description: '开发调试工具，显示性能指标和调试信息',
  author: 'guicang',

  install: (_context) => {
    // 注册调试面板
    // 这里可以添加调试面板的注册逻辑
  },

  activate: () => {
    console.log('Dev tools plugin activated');
  },

  deactivate: () => {
    console.log('Dev tools plugin deactivated');
  },
};
