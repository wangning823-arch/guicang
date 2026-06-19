/**
 * 归藏配置模式定义
 * 所有配置项的类型和默认值
 */

/** LLM Provider 配置 */
export interface ProviderConfig {
  /** provider 标识符，如 "openai", "anthropic" */
  type: string;
  /** API endpoint URL */
  baseUrl: string;
  /** API key（从环境变量读取） */
  apiKey?: string;
  /** 默认模型 */
  model: string;
  /** 请求超时（毫秒） */
  timeout?: number;
  /** 最大重试次数 */
  maxRetries?: number;
}

/** 工具配置 */
export interface ToolConfig {
  /** 启用的工具列表 */
  enabled: string[];
  /** 工具执行超时（毫秒） */
  executionTimeout?: number;
  /** 最大并发工具调用数 */
  maxConcurrency?: number;
}

/** 渠道配置 */
export interface ChannelConfig {
  /** 渠道类型，如 "cli", "http" */
  type: string;
  /** 监听端口（HTTP 渠道） */
  port?: number;
  /** 监听地址 */
  host?: string;
}

/** 记忆系统配置 */
export interface MemoryConfig {
  /** 短期记忆最大条数 */
  shortTermLimit?: number;
  /** 长期记忆存储路径 */
  longTermPath?: string;
  /** 向量搜索维度 */
  embeddingDimension?: number;
}

/** 归藏主配置 */
export interface GuicangConfig {
  /** 项目名称 */
  name: string;
  /** 日志级别 */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** LLM Provider 配置 */
  providers: ProviderConfig[];
  /** 默认 provider 名称 */
  defaultProvider: string;
  /** 工具配置 */
  tools: ToolConfig;
  /** 渠道配置 */
  channels: ChannelConfig[];
  /** 记忆系统配置 */
  memory: MemoryConfig;
}

/** 默认配置 */
export const DEFAULT_CONFIG: GuicangConfig = {
  name: 'guicang',
  logLevel: 'info',
  providers: [],
  defaultProvider: '',
  tools: {
    enabled: [],
    executionTimeout: 30_000,
    maxConcurrency: 5,
  },
  channels: [],
  memory: {
    shortTermLimit: 100,
    longTermPath: './data/memory',
    embeddingDimension: 1536,
  },
};
