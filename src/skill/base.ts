/**
 * 技能基类
 * 可组合的能力单元，可被 Agent 加载和调用
 */

import type { ToolDefinition, Message } from '../core/types.js';

/** 技能配置 */
export interface SkillConfig {
  /** 技能名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 技能版本 */
  version?: string;
  /** 技能作者 */
  author?: string;
  /** 依赖的其他技能 */
  dependencies?: string[];
  /** 技能标签 */
  tags?: string[];
}

/** 技能执行上下文 */
export interface SkillContext {
  /** 用户消息 */
  message: Message;
  /** 技能参数 */
  params: Record<string, unknown>;
  /** 共享状态 */
  state: Map<string, unknown>;
}

/** 技能执行结果 */
export interface SkillResult {
  /** 是否成功 */
  success: boolean;
  /** 输出内容 */
  output: string;
  /** 提供的工具定义（可选） */
  tools?: ToolDefinition[];
  /** 更新的状态 */
  stateUpdates?: Record<string, unknown>;
}

/**
 * 技能抽象基类
 */
export abstract class BaseSkill {
  constructor(public readonly config: SkillConfig) {}

  /** 技能名称 */
  get name(): string {
    return this.config.name;
  }

  /** 技能描述 */
  get description(): string {
    return this.config.description;
  }

  /**
   * 执行技能
   * @param context 执行上下文
   * @returns 技能结果
   */
  abstract execute(context: SkillContext): Promise<SkillResult>;

  /**
   * 检查技能是否可以处理该消息
   * 默认实现：总是可以处理
   */
  canHandle(_message: Message): boolean {
    return true;
  }

  /**
   * 获取技能提供的工具定义
   * 默认实现：不提供工具
   */
  getTools(): ToolDefinition[] {
    return [];
  }

  /**
   * 技能初始化（可选）
   */
  async initialize?(): Promise<void>;

  /**
   * 技能清理（可选）
   */
  async cleanup?(): Promise<void>;
}
