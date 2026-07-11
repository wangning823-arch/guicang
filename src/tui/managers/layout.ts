/**
 * 布局管理器
 * 管理面板布局和排列
 */

import type { Rect } from '../engine.js';

/** 面板配置 */
export interface PanelConfig {
  id: string;
  rect: Rect;
  visible: boolean;
  title: string;
  icon?: string;
}

/** 布局配置 */
export interface LayoutConfig {
  name: string;
  panels: PanelConfig[];
  statusbar?: boolean;
  toolbar?: boolean;
}

/** 预设布局 */
const PRESET_LAYOUTS: Record<string, LayoutConfig> = {
  // 默认布局：左侧聊天，右侧状态/指标/Token
  default: {
    name: 'default',
    statusbar: true,
    panels: [
      { id: 'chat', rect: { x: 1, y: 1, width: 55, height: 18 }, visible: true, title: '对话', icon: '💬' },
      { id: 'status', rect: { x: 57, y: 1, width: 23, height: 9 }, visible: true, title: '系统状态', icon: '📊' },
      { id: 'metrics', rect: { x: 57, y: 11, width: 23, height: 9 }, visible: true, title: '性能指标', icon: '⚡' },
      { id: 'tokens', rect: { x: 1, y: 20, width: 28, height: 4 }, visible: true, title: 'Token 统计', icon: '🎯' },
      { id: 'agents', rect: { x: 1, y: 24, width: 28, height: 1 }, visible: true, title: 'Agent 列表', icon: '🤖' },
      { id: 'tools', rect: { x: 30, y: 24, width: 26, height: 1 }, visible: true, title: '最近工具', icon: '🔧' },
      { id: 'logs', rect: { x: 57, y: 24, width: 23, height: 1 }, visible: true, title: '日志', icon: '📝' },
    ],
  },

  // 聚焦模式：全屏聊天
  focus: {
    name: 'focus',
    statusbar: true,
    panels: [
      { id: 'chat', rect: { x: 1, y: 1, width: 78, height: 24 }, visible: true, title: '对话', icon: '💬' },
    ],
  },

  // 监控模式：聊天+指标+日志
  monitor: {
    name: 'monitor',
    statusbar: true,
    panels: [
      { id: 'chat', rect: { x: 1, y: 1, width: 40, height: 24 }, visible: true, title: '对话', icon: '💬' },
      { id: 'metrics', rect: { x: 42, y: 1, width: 19, height: 12 }, visible: true, title: '性能指标', icon: '⚡' },
      { id: 'logs', rect: { x: 42, y: 14, width: 19, height: 11 }, visible: true, title: '日志', icon: '📝' },
      { id: 'status', rect: { x: 62, y: 1, width: 18, height: 12 }, visible: true, title: '系统状态', icon: '📊' },
      { id: 'tokens', rect: { x: 62, y: 14, width: 18, height: 11 }, visible: true, title: 'Token 统计', icon: '🎯' },
    ],
  },

  // Agent 模式：Agent 列表+聊天
  agents: {
    name: 'agents',
    statusbar: true,
    panels: [
      { id: 'agents', rect: { x: 1, y: 1, width: 35, height: 24 }, visible: true, title: 'Agent 列表', icon: '🤖' },
      { id: 'chat', rect: { x: 37, y: 1, width: 42, height: 24 }, visible: true, title: '对话', icon: '💬' },
    ],
  },
};

/** 布局管理器 */
export class LayoutManager {
  private currentLayout: LayoutConfig;
  private savedLayouts: Map<string, LayoutConfig> = new Map();
  private listeners: Array<(layout: LayoutConfig) => void> = [];

  constructor(initialLayout: string = 'default') {
    // 复制预设布局
    this.currentLayout = JSON.parse(JSON.stringify(PRESET_LAYOUTS[initialLayout] || PRESET_LAYOUTS.default));

    // 加载保存的布局
    for (const [name, layout] of Object.entries(PRESET_LAYOUTS)) {
      this.savedLayouts.set(name, JSON.parse(JSON.stringify(layout)));
    }
  }

  /** 获取当前布局 */
  getCurrentLayout(): LayoutConfig {
    return this.currentLayout;
  }

  /** 获取布局名称 */
  getLayoutName(): string {
    return this.currentLayout.name;
  }

  /** 获取所有面板配置 */
  getPanels(): PanelConfig[] {
    return this.currentLayout.panels;
  }

  /** 获取指定面板配置 */
  getPanel(id: string): PanelConfig | undefined {
    return this.currentLayout.panels.find(p => p.id === id);
  }

  /** 设置布局 */
  setLayout(name: string): void {
    const layout = this.savedLayouts.get(name);
    if (layout) {
      this.currentLayout = JSON.parse(JSON.stringify(layout));
      this.notifyListeners();
    }
  }

  /** 获取所有可用布局 */
  getAvailableLayouts(): string[] {
    return Array.from(this.savedLayouts.keys());
  }

  /** 保存当前布局 */
  saveLayout(name: string): void {
    this.savedLayouts.set(name, JSON.parse(JSON.stringify(this.currentLayout)));
  }

  /** 删除布局 */
  deleteLayout(name: string): boolean {
    if (PRESET_LAYOUTS[name]) {
      return false; // 不能删除预设布局
    }
    return this.savedLayouts.delete(name);
  }

  /** 重置为默认布局 */
  resetLayout(): void {
    this.setLayout('default');
  }

  /** 切换面板可见性 */
  togglePanel(id: string): void {
    const panel = this.getPanel(id);
    if (panel) {
      panel.visible = !panel.visible;
      this.notifyListeners();
    }
  }

  /** 显示面板 */
  showPanel(id: string): void {
    const panel = this.getPanel(id);
    if (panel && !panel.visible) {
      panel.visible = true;
      this.notifyListeners();
    }
  }

  /** 隐藏面板 */
  hidePanel(id: string): void {
    const panel = this.getPanel(id);
    if (panel && panel.visible) {
      panel.visible = false;
      this.notifyListeners();
    }
  }

  /** 最大化面板 */
  maximizePanel(id: string): void {
    const panel = this.getPanel(id);
    if (panel) {
      // 保存其他面板的状态
      for (const p of this.currentLayout.panels) {
        if (p.id !== id) {
          p.visible = false;
        }
      }
      panel.visible = true;
      panel.rect = { x: 1, y: 1, width: 78, height: 24 };
      this.notifyListeners();
    }
  }

  /** 恢复面板大小 */
  restorePanel(id: string): void {
    const savedLayout = this.savedLayouts.get(this.currentLayout.name);
    if (savedLayout) {
      const savedPanel = savedLayout.panels.find(p => p.id === id);
      if (savedPanel) {
        const panel = this.getPanel(id);
        if (panel) {
          panel.rect = { ...savedPanel.rect };
          // 恢复其他面板
          for (const p of savedLayout.panels) {
            const currentPanel = this.getPanel(p.id);
            if (currentPanel) {
              currentPanel.rect = { ...p.rect };
              currentPanel.visible = p.visible;
            }
          }
          this.notifyListeners();
        }
      }
    }
  }

  /** 分割面板 */
  splitPanel(direction: 'horizontal' | 'vertical', _ratio: number = 0.5): void {
    // 这里可以实现面板分割逻辑
    // 目前简化处理
  }

  /** 监听布局变化 */
  onLayoutChange(listener: (layout: LayoutConfig) => void): () => void {
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
      listener(this.currentLayout);
    }
  }
}
