/**
 * 上下文压缩器
 * 自动摘要长对话历史，减少 token 消耗
 */

import type { Message } from './types.js';
import type { BaseProvider, ProviderOptions } from '../provider/base.js';
import { Logger } from './logger.js';

const logger = new Logger('compressor');

/** 压缩选项 */
export interface CompressorOptions {
  /** 保留最近 N 条消息（默认 20） */
  keepRecent?: number;
  /** 超过此条数开始压缩（默认 30） */
  threshold?: number;
  /** 摘要时的 LLM 选项 */
  providerOptions?: ProviderOptions;
}

const DEFAULT_OPTIONS: Required<CompressorOptions> = {
  keepRecent: 20,
  threshold: 30,
  providerOptions: {},
};

/**
 * 上下文压缩器
 *
 * 策略：
 * 1. 保留系统提示（始终不动）
 * 2. 将中间部分的消息压缩为摘要
 * 3. 保留最近 keepRecent 条消息
 */
export class ContextCompressor {
  private options: Required<CompressorOptions>;

  constructor(options?: CompressorOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 检查是否需要压缩
   */
  shouldCompress(messages: Message[]): boolean {
    return messages.length > this.options.threshold;
  }

  /**
   * 压缩消息历史
   * 返回压缩后的消息数组
   */
  async compress(
    messages: Message[],
    provider: BaseProvider,
  ): Promise<Message[]> {
    if (!this.shouldCompress(messages)) {
      return messages;
    }

    // 找到系统消息
    const systemIndex = messages.findIndex((m) => m.role === 'system');
    const hasSystem = systemIndex !== -1;

    // 分区：系统消息 | 待压缩区域 | 最近消息
    const startIdx = hasSystem ? 1 : 0;
    const endIdx = messages.length - this.options.keepRecent;
    const recentCount = this.options.keepRecent;

    if (endIdx <= startIdx) {
      // 不够压缩，直接返回
      return messages;
    }

    const middleMessages = messages.slice(startIdx, endIdx);
    const recentMessages = messages.slice(messages.length - recentCount);

    // 生成摘要
    logger.info(
      `Compressing ${middleMessages.length} messages into summary`,
    );

    const summary = await this.generateSummary(middleMessages, provider);

    // 重建消息数组
    const compressed: Message[] = [];

    if (hasSystem) {
      compressed.push(messages[systemIndex]);
    }

    compressed.push({
      role: 'system',
      content: `[Context Summary]\n${summary}\n[End of Summary]`,
    });

    compressed.push(...recentMessages);

    logger.info(
      `Compressed ${messages.length} messages → ${compressed.length} messages`,
    );

    return compressed;
  }

  /**
   * 使用 LLM 生成对话摘要
   */
  private async generateSummary(
    messages: Message[],
    provider: BaseProvider,
  ): Promise<string> {
    // 将消息格式化为可读文本
    const conversationText = messages
      .map((m) => {
        const role = m.role.charAt(0).toUpperCase() + m.role.slice(1);
        const content = m.content.length > 500
          ? m.content.slice(0, 500) + '...'
          : m.content;
        return `${role}: ${content}`;
      })
      .join('\n');

    const prompt = `请将以下对话历史压缩为简洁的摘要。保留关键信息、决策和重要的上下文。用中文输出，控制在 200 字以内。

对话历史：
${conversationText}

摘要：`;

    try {
      const response = await provider.chat(
        [{ role: 'user', content: prompt }],
        undefined,
        this.options.providerOptions,
      );

      return response.message.content;
    } catch {
      logger.warn('Failed to generate summary, using fallback');
      // 回退策略：简单提取最近几条的关键信息
      return this.fallbackSummary(messages);
    }
  }

  /**
   * 回退摘要策略（不调用 LLM）
   */
  private fallbackSummary(messages: Message[]): string {
    const summaryParts: string[] = [];
    let totalLength = 0;
    const maxSummaryLength = 300;

    // 从后往前取关键消息
    for (let i = messages.length - 1; i >= 0 && totalLength < maxSummaryLength; i--) {
      const msg = messages[i];
      if (msg.role === 'user' || msg.role === 'assistant') {
        const snippet = msg.content.slice(0, 100);
        summaryParts.unshift(`${msg.role}: ${snippet}`);
        totalLength += snippet.length;
      }
    }

    return summaryParts.join('\n') || '对话历史已压缩';
  }

  /**
   * 估算消息的 token 数（粗略估算：中文 1 字 ≈ 2 token，英文 1 词 ≈ 1.3 token）
   */
  static estimateTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
      // 粗略估算：每个字符约 1.5 token
      total += Math.ceil(msg.content.length * 1.5);
    }
    return total;
  }
}
