/**
 * 插件基类
 * 动态加载和管理插件的机制
 */

import type { BaseTool } from '../tool/base.js';
import type { BaseSkill } from '../skill/base.js';
import type { BaseProvider } from '../provider/base.js';
import type { GuicangConfig } from '../config/schema.js';

/** 插件元数据 */
export interface PluginManifest {
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件描述 */
  description?: string;
  /** 插件作者 */
  author?: string;
  /** 依赖的其他插件 */
  dependencies?: string[];
  /** 最低归藏版本 */
  minVersion?: string;
}

/** 插件上下文 */
export interface PluginContext {
  /** 配置 */
  config: GuicangConfig;
  /** 注册工具 */
  registerTool: (tool: BaseTool) => void;
  /** 注册技能 */
  registerSkill: (skill: BaseSkill) => void;
  /** 注册 Provider */
  registerProvider: (type: string, cls: new (config: unknown) => BaseProvider) => void;
  /** 日志 */
  log: (message: string) => void;
}

/**
 * 插件抽象基类
 */
export abstract class BasePlugin {
  constructor(public readonly manifest: PluginManifest) {}

  /** 插件名称 */
  get name(): string {
    return this.manifest.name;
  }

  /** 插件版本 */
  get version(): string {
    return this.manifest.version;
  }

  /**
   * 插件初始化
   * 在插件加载时调用
   */
  abstract initialize(context: PluginContext): Promise<void>;

  /**
   * 插件清理
   * 在插件卸载时调用
   */
  async cleanup(): Promise<void> {
    // 默认不做什么
  }

  /**
   * 插件配置验证
   * 可选实现
   */
  async validate?(_config: GuicangConfig): Promise<boolean>;
}
