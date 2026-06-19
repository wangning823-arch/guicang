/**
 * 自然语言配置
 * 用对话方式配置系统参数
 */

import { Logger } from '../core/logger.js';

const logger = new Logger('config:natural-language');

/** 配置意图 */
export type ConfigIntent =
  | 'set_provider'
  | 'set_model'
  | 'set_api_key'
  | 'set_temperature'
  | 'set_max_tokens'
  | 'set_timeout'
  | 'enable_feature'
  | 'disable_feature'
  | 'add_tool'
  | 'remove_tool'
  | 'set_channel'
  | 'set_port'
  | 'unknown';

/** 解析后的配置命令 */
export interface ParsedConfigCommand {
  intent: ConfigIntent;
  key: string;
  value: string | number | boolean;
  confidence: number;
  raw: string;
}

/** 配置模式 */
export interface ConfigPattern {
  intent: ConfigIntent;
  patterns: RegExp[];
  keyExtractor: (match: RegExpMatchArray) => string;
  valueExtractor: (match: RegExpMatchArray) => string | number | boolean;
}

/**
 * 自然语言配置解析器
 */
export class NaturalLanguageConfig {
  private patterns: ConfigPattern[];

  constructor() {
    this.patterns = this.getDefaultPatterns();
  }

  /**
   * 解析自然语言配置命令
   */
  parse(input: string): ParsedConfigCommand {
    const normalized = input.toLowerCase().trim();

    for (const pattern of this.patterns) {
      for (const regex of pattern.patterns) {
        const match = normalized.match(regex);
        if (match) {
          const key = pattern.keyExtractor(match);
          const value = pattern.valueExtractor(match);

          logger.debug(`Parsed config command: ${pattern.intent} -> ${key} = ${value}`);

          return {
            intent: pattern.intent,
            key,
            value,
            confidence: 0.9,
            raw: input,
          };
        }
      }
    }

    return {
      intent: 'unknown',
      key: '',
      value: '',
      confidence: 0,
      raw: input,
    };
  }

  /**
   * 获取所有支持的配置命令示例
   */
  getExamples(): Array<{ intent: ConfigIntent; example: string; description: string }> {
    return [
      { intent: 'set_provider', example: '使用 OpenAI 作为提供商', description: '设置 LLM 提供商' },
      { intent: 'set_model', example: '切换到 GPT-4 模型', description: '设置模型名称' },
      { intent: 'set_api_key', example: '设置 API 密钥为 sk-xxx', description: '配置 API 密钥' },
      { intent: 'set_temperature', example: '把温度设为 0.7', description: '设置生成温度' },
      { intent: 'set_max_tokens', example: '最大 token 数设为 4096', description: '设置最大 token 数' },
      { intent: 'set_timeout', example: '超时时间设为 30 秒', description: '设置请求超时' },
      { intent: 'enable_feature', example: '启用流式输出', description: '启用功能特性' },
      { intent: 'disable_feature', example: '关闭调试模式', description: '禁用功能特性' },
      { intent: 'add_tool', example: '添加网页搜索工具', description: '添加工具' },
      { intent: 'remove_tool', example: '移除文件读取工具', description: '移除工具' },
      { intent: 'set_channel', example: '使用 HTTP 渠道', description: '设置通信渠道' },
      { intent: 'set_port', example: '端口设为 8080', description: '设置服务端口' },
    ];
  }

  /**
   * 获取默认模式
   */
  private getDefaultPatterns(): ConfigPattern[] {
    return [
      // 设置提供商
      {
        intent: 'set_provider',
        patterns: [
          /使用\s*(\w+)\s*作为\s*提供商/,
          /切换到\s*(\w+)\s*提供商/,
          /提供商\s*设为?\s*(\w+)/,
          /provider\s*[:=]\s*(\w+)/i,
        ],
        keyExtractor: () => 'defaultProvider',
        valueExtractor: (m) => m[1].toLowerCase(),
      },

      // 设置模型
      {
        intent: 'set_model',
        patterns: [
          /切换到\s*(.+?)\s*模型/,
          /使用\s*(.+?)\s*模型/,
          /模型\s*设为?\s*(.+)/,
          /model\s*[:=]\s*(.+)/i,
        ],
        keyExtractor: () => 'model',
        valueExtractor: (m) => m[1].trim(),
      },

      // 设置 API 密钥
      {
        intent: 'set_api_key',
        patterns: [
          /设置\s*API\s*密钥\s*为?\s*(.+)/i,
          /api\s*key\s*[:=]\s*(.+)/i,
          /密钥\s*[:=]\s*(.+)/,
        ],
        keyExtractor: (_m) => 'apiKey',
        valueExtractor: (m) => m[1].trim(),
      },

      // 设置温度
      {
        intent: 'set_temperature',
        patterns: [
          /温度\s*设为?\s*([\d.]+)/,
          /temperature\s*[:=]\s*([\d.]+)/i,
          /把\s*温度\s*(?:改|设)?为?\s*([\d.]+)/,
        ],
        keyExtractor: () => 'temperature',
        valueExtractor: (m) => parseFloat(m[1]),
      },

      // 设置最大 token
      {
        intent: 'set_max_tokens',
        patterns: [
          /最大\s*(?:token|令牌)\s*(?:数)?\s*设为?\s*(\d+)/,
          /max[_\s]?tokens?\s*[:=]\s*(\d+)/i,
        ],
        keyExtractor: () => 'maxTokens',
        valueExtractor: (m) => parseInt(m[1], 10),
      },

      // 设置超时
      {
        intent: 'set_timeout',
        patterns: [
          /超时\s*(?:时间)?\s*设为?\s*(\d+)\s*(?:秒|s)?/,
          /timeout\s*[:=]\s*(\d+)/i,
        ],
        keyExtractor: () => 'timeout',
        valueExtractor: (m) => parseInt(m[1], 10) * 1000,
      },

      // 启用功能
      {
        intent: 'enable_feature',
        patterns: [
          /启用\s*(.+)/,
          /打开\s*(.+)/,
          /开启\s*(.+)/,
          /enable\s*(.+)/i,
          /turn\s*on\s*(.+)/i,
        ],
        keyExtractor: (m) => m[1].trim(),
        valueExtractor: () => true,
      },

      // 禁用功能
      {
        intent: 'disable_feature',
        patterns: [
          /关闭\s*(.+)/,
          /禁用\s*(.+)/,
          /disable\s*(.+)/i,
          /turn\s*off\s*(.+)/i,
        ],
        keyExtractor: (m) => m[1].trim(),
        valueExtractor: () => false,
      },

      // 添加工具
      {
        intent: 'add_tool',
        patterns: [
          /添加\s*(.+?)\s*工具/,
          /增加\s*(.+?)\s*工具/,
          /add\s*(.+?)\s*tool/i,
        ],
        keyExtractor: (_m) => 'tools',
        valueExtractor: (m) => m[1].trim(),
      },

      // 移除工具
      {
        intent: 'remove_tool',
        patterns: [
          /移除\s*(.+?)\s*工具/,
          /删除\s*(.+?)\s*工具/,
          /remove\s*(.+?)\s*tool/i,
        ],
        keyExtractor: (_m) => 'tools',
        valueExtractor: (m) => m[1].trim(),
      },

      // 设置渠道
      {
        intent: 'set_channel',
        patterns: [
          /使用\s*(\w+)\s*渠道/,
          /切换到\s*(\w+)\s*渠道/,
          /渠道\s*设为?\s*(\w+)/,
          /channel\s*[:=]\s*(\w+)/i,
        ],
        keyExtractor: () => 'channel',
        valueExtractor: (m) => m[1].toLowerCase(),
      },

      // 设置端口
      {
        intent: 'set_port',
        patterns: [
          /端口\s*设为?\s*(\d+)/,
          /port\s*[:=]\s*(\d+)/i,
          /监听\s*(\d+)\s*端口/,
        ],
        keyExtractor: () => 'port',
        valueExtractor: (m) => parseInt(m[1], 10),
      },
    ];
  }
}

/** 全局自然语言配置解析器 */
export const naturalLanguageConfig = new NaturalLanguageConfig();
