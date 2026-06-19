/**
 * 自定义仪表盘
 * 可配置的状态监控面板
 */

import { Logger } from '../core/logger.js';

const logger = new Logger('dashboard');

/** 面板类型 */
export type PanelType = 'status' | 'metrics' | 'logs' | 'tasks' | 'agents' | 'custom';

/** 面板配置 */
export interface PanelConfig {
  id: string;
  type: PanelType;
  title: string;
  position: { x: number; y: number; w: number; h: number };
  refreshInterval?: number;
  config?: Record<string, unknown>;
}

/** 面板数据 */
export interface PanelData {
  panelId: string;
  timestamp: Date;
  data: unknown;
}

/**
 * 仪表盘管理器
 */
export class Dashboard {
  private panels = new Map<string, PanelConfig>();
  private data = new Map<string, PanelData>();
  private refreshCallbacks = new Map<string, () => Promise<unknown>>();

  /**
   * 添加面板
   */
  addPanel(config: PanelConfig): void {
    this.panels.set(config.id, config);
    logger.info(`Panel added: ${config.title}`);
  }

  /**
   * 移除面板
   */
  removePanel(id: string): boolean {
    const result = this.panels.delete(id);
    this.data.delete(id);
    this.refreshCallbacks.delete(id);
    return result;
  }

  /**
   * 获取面板配置
   */
  getPanel(id: string): PanelConfig | undefined {
    return this.panels.get(id);
  }

  /**
   * 获取所有面板
   */
  getAllPanels(): PanelConfig[] {
    return [...this.panels.values()];
  }

  /**
   * 更新面板配置
   */
  updatePanel(id: string, updates: Partial<PanelConfig>): boolean {
    const panel = this.panels.get(id);
    if (!panel) return false;

    Object.assign(panel, updates);
    return true;
  }

  /**
   * 设置数据刷新回调
   */
  setRefreshCallback(panelId: string, callback: () => Promise<unknown>): void {
    this.refreshCallbacks.set(panelId, callback);
  }

  /**
   * 刷新面板数据
   */
  async refreshPanel(panelId: string): Promise<PanelData | null> {
    const callback = this.refreshCallbacks.get(panelId);
    if (!callback) return null;

    try {
      const data = await callback();
      const panelData: PanelData = {
        panelId,
        timestamp: new Date(),
        data,
      };

      this.data.set(panelId, panelData);
      return panelData;
    } catch (error) {
      logger.error(`Failed to refresh panel ${panelId}`, error);
      return null;
    }
  }

  /**
   * 刷新所有面板
   */
  async refreshAll(): Promise<PanelData[]> {
    const results: PanelData[] = [];

    for (const panelId of this.panels.keys()) {
      const data = await this.refreshPanel(panelId);
      if (data) {
        results.push(data);
      }
    }

    return results;
  }

  /**
   * 获取面板数据
   */
  getPanelData(panelId: string): PanelData | undefined {
    return this.data.get(panelId);
  }

  /**
   * 导出仪表盘配置
   */
  exportConfig(): PanelConfig[] {
    return this.getAllPanels();
  }

  /**
   * 导入仪表盘配置
   */
  importConfig(configs: PanelConfig[]): void {
    for (const config of configs) {
      this.addPanel(config);
    }
  }

  /**
   * 创建默认仪表盘
   */
  createDefault(): void {
    this.addPanel({
      id: 'system-status',
      type: 'status',
      title: '系统状态',
      position: { x: 0, y: 0, w: 2, h: 1 },
      refreshInterval: 5000,
    });

    this.addPanel({
      id: 'metrics',
      type: 'metrics',
      title: '性能指标',
      position: { x: 2, y: 0, w: 2, h: 1 },
      refreshInterval: 10000,
    });

    this.addPanel({
      id: 'active-tasks',
      type: 'tasks',
      title: '活跃任务',
      position: { x: 0, y: 1, w: 2, h: 2 },
      refreshInterval: 3000,
    });

    this.addPanel({
      id: 'agent-status',
      type: 'agents',
      title: 'Agent 状态',
      position: { x: 2, y: 1, w: 2, h: 2 },
      refreshInterval: 5000,
    });

    this.addPanel({
      id: 'recent-logs',
      type: 'logs',
      title: '最近日志',
      position: { x: 0, y: 3, w: 4, h: 1 },
      refreshInterval: 2000,
    });

    logger.info('Default dashboard created');
  }
}

/** 全局仪表盘 */
export const dashboard = new Dashboard();
