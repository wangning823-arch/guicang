/**
 * 插件市场
 * 插件发现、安装、评分系统
 */

import { Logger } from '../core/logger.js';

const logger = new Logger('plugin:marketplace');

/** 插件元数据 */
export interface PluginMetadata {
  /** 插件名称 */
  name: string;
  /** 版本 */
  version: string;
  /** 描述 */
  description: string;
  /** 作者 */
  author: string;
  /** 标签 */
  tags: string[];
  /** 下载量 */
  downloads: number;
  /** 评分 (1-5) */
  rating: number;
  /** 评分人数 */
  ratingCount: number;
  /** 发布时间 */
  publishedAt: string;
  /** 最后更新 */
  updatedAt: string;
  /** 仓库地址 */
  repository?: string;
  /** 主页 */
  homepage?: string;
  /** 许可证 */
  license?: string;
  /** 依赖 */
  dependencies?: string[];
  /** 已安装版本 */
  installedVersion?: string;
}

/** 安装记录 */
export interface InstallRecord {
  pluginName: string;
  version: string;
  installedAt: string;
  enabled: boolean;
}

/** 评分记录 */
export interface RatingRecord {
  pluginName: string;
  user: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

/**
 * 插件市场
 */
export class PluginMarketplace {
  private plugins = new Map<string, PluginMetadata>();
  private installs = new Map<string, InstallRecord>();
  private ratings = new Map<string, RatingRecord[]>();

  constructor() {
    // 加载内置插件元数据
    this.loadBuiltinPlugins();
  }

  /**
   * 搜索插件
   */
  search(query: string): PluginMetadata[] {
    const lower = query.toLowerCase();
    return [...this.plugins.values()].filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.description.toLowerCase().includes(lower) ||
        p.tags.some((t) => t.toLowerCase().includes(lower)),
    );
  }

  /**
   * 获取所有插件
   */
  getAllPlugins(): PluginMetadata[] {
    return [...this.plugins.values()];
  }

  /**
   * 按标签获取插件
   */
  getByTag(tag: string): PluginMetadata[] {
    return [...this.plugins.values()].filter((p) =>
      p.tags.includes(tag.toLowerCase()),
    );
  }

  /**
   * 获取热门插件（按下载量排序）
   */
  getPopular(limit = 10): PluginMetadata[] {
    return [...this.plugins.values()]
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit);
  }

  /**
   * 获取高评分插件
   */
  getTopRated(limit = 10): PluginMetadata[] {
    return [...this.plugins.values()]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  }

  /**
   * 获取最新插件
   */
  getRecent(limit = 10): PluginMetadata[] {
    return [...this.plugins.values()]
      .sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() -
          new Date(a.publishedAt).getTime(),
      )
      .slice(0, limit);
  }

  /**
   * 获取插件详情
   */
  getPlugin(name: string): PluginMetadata | undefined {
    return this.plugins.get(name);
  }

  /**
   * 注册插件到市场
   */
  registerPlugin(metadata: PluginMetadata): void {
    this.plugins.set(metadata.name, metadata);
    logger.info(`Registered plugin in marketplace: ${metadata.name}`);
  }

  /**
   * 安装插件
   */
  install(name: string, version: string): InstallRecord | null {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      logger.warn(`Plugin not found: ${name}`);
      return null;
    }

    const record: InstallRecord = {
      pluginName: name,
      version,
      installedAt: new Date().toISOString(),
      enabled: true,
    };

    this.installs.set(name, record);
    plugin.installedVersion = version;
    plugin.downloads++;

    logger.info(`Installed plugin: ${name}@${version}`);
    return record;
  }

  /**
   * 卸载插件
   */
  uninstall(name: string): boolean {
    if (!this.installs.has(name)) return false;

    this.installs.delete(name);
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.installedVersion = undefined;
    }

    logger.info(`Uninstalled plugin: ${name}`);
    return true;
  }

  /**
   * 启用/禁用插件
   */
  setEnabled(name: string, enabled: boolean): boolean {
    const record = this.installs.get(name);
    if (!record) return false;

    record.enabled = enabled;
    logger.info(`${enabled ? 'Enabled' : 'Disabled'} plugin: ${name}`);
    return true;
  }

  /**
   * 获取已安装插件
   */
  getInstalled(): InstallRecord[] {
    return [...this.installs.values()];
  }

  /**
   * 检查是否已安装
   */
  isInstalled(name: string): boolean {
    return this.installs.has(name);
  }

  /**
   * 添加评分
   */
  addRating(
    pluginName: string,
    user: string,
    rating: number,
    comment?: string,
  ): RatingRecord | null {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return null;

    if (rating < 1 || rating > 5) {
      logger.warn(`Invalid rating: ${rating}. Must be 1-5.`);
      return null;
    }

    const record: RatingRecord = {
      pluginName,
      user,
      rating,
      comment,
      createdAt: new Date().toISOString(),
    };

    if (!this.ratings.has(pluginName)) {
      this.ratings.set(pluginName, []);
    }
    this.ratings.get(pluginName)!.push(record);

    // 更新插件评分
    const allRatings = this.ratings.get(pluginName)!;
    const avg = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
    plugin.rating = Math.round(avg * 10) / 10;
    plugin.ratingCount = allRatings.length;

    logger.info(
      `Added rating for ${pluginName}: ${rating}/5 by ${user}`,
    );
    return record;
  }

  /**
   * 获取插件评分
   */
  getRatings(pluginName: string): RatingRecord[] {
    return this.ratings.get(pluginName) ?? [];
  }

  /**
   * 获取所有标签
   */
  getAllTags(): string[] {
    const tags = new Set<string>();
    for (const plugin of this.plugins.values()) {
      for (const tag of plugin.tags) {
        tags.add(tag);
      }
    }
    return [...tags].sort();
  }

  /**
   * 获取市场统计
   */
  getStats(): {
    totalPlugins: number;
    totalInstalls: number;
    totalRatings: number;
    averageRating: number;
  } {
    const totalPlugins = this.plugins.size;
    const totalInstalls = this.installs.size;
    const allRatings = [...this.ratings.values()].flat();
    const totalRatings = allRatings.length;
    const averageRating =
      totalRatings > 0
        ? Math.round(
            (allRatings.reduce((sum, r) => sum + r.rating, 0) / totalRatings) *
              10,
          ) / 10
        : 0;

    return { totalPlugins, totalInstalls, totalRatings, averageRating };
  }

  /**
   * 加载内置插件
   */
  private loadBuiltinPlugins(): void {
    const builtin: PluginMetadata[] = [
      {
        name: 'weather',
        version: '1.0.0',
        description: '天气查询插件，支持全球城市天气查询',
        author: '归藏团队',
        tags: ['weather', 'utility', 'api'],
        downloads: 1250,
        rating: 4.5,
        ratingCount: 89,
        publishedAt: '2024-01-15',
        updatedAt: '2024-03-20',
        license: 'MIT',
      },
      {
        name: 'calculator',
        version: '1.2.0',
        description: '数学计算插件，支持复杂数学表达式求值',
        author: '归藏团队',
        tags: ['math', 'utility', 'calculation'],
        downloads: 980,
        rating: 4.2,
        ratingCount: 67,
        publishedAt: '2024-02-01',
        updatedAt: '2024-04-10',
        license: 'MIT',
      },
      {
        name: 'web-search',
        version: '2.0.0',
        description: '网页搜索插件，集成搜索引擎API',
        author: '社区',
        tags: ['search', 'web', 'api'],
        downloads: 2100,
        rating: 4.8,
        ratingCount: 156,
        publishedAt: '2024-01-20',
        updatedAt: '2024-05-01',
        license: 'Apache-2.0',
      },
      {
        name: 'code-runner',
        version: '1.1.0',
        description: '代码执行插件，支持多种编程语言沙箱执行',
        author: '社区',
        tags: ['code', 'execution', 'sandbox'],
        downloads: 1800,
        rating: 4.6,
        ratingCount: 112,
        publishedAt: '2024-02-15',
        updatedAt: '2024-04-25',
        license: 'MIT',
      },
      {
        name: 'file-manager',
        version: '1.0.0',
        description: '文件管理插件，提供文件读写和目录操作',
        author: '归藏团队',
        tags: ['file', 'filesystem', 'utility'],
        downloads: 750,
        rating: 4.0,
        ratingCount: 45,
        publishedAt: '2024-03-01',
        updatedAt: '2024-03-15',
        license: 'MIT',
      },
      {
        name: 'database',
        version: '1.3.0',
        description: '数据库插件，支持SQLite和PostgreSQL操作',
        author: '社区',
        tags: ['database', 'sql', 'storage'],
        downloads: 1500,
        rating: 4.4,
        ratingCount: 98,
        publishedAt: '2024-01-25',
        updatedAt: '2024-05-10',
        license: 'MIT',
      },
    ];

    for (const plugin of builtin) {
      this.plugins.set(plugin.name, plugin);
    }
  }
}

/** 全局市场实例 */
export const marketplace = new PluginMarketplace();
