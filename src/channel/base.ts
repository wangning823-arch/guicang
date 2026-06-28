/**
 * 消息渠道基类
 * 定义消息收发的统一接口
 */

import type { Agent } from '../core/agent.js';
import type { AgentResult, Message } from '../core/types.js';
import { Logger } from '../core/logger.js';

/** 消息格式 */
export interface ChannelMessage {
  /** 消息 ID */
  id: string;
  /** 发送者 */
  sender: string;
  /** 消息内容 */
  content: string;
  /** 时间戳 */
  timestamp: Date;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/** 渠道事件 */
export type ChannelEvent =
  | { type: 'message'; data: ChannelMessage }
  | { type: 'connected' }
  | { type: 'disconnected'; reason?: string }
  | { type: 'error'; error: Error };

/** 渠道选项 */
export interface ChannelOptions {
  /** 渠道名称 */
  name: string;
  /** 渠道描述 */
  description?: string;
}

/**
 * 消息渠道抽象基类
 */
export abstract class BaseChannel {
  protected agent: Agent | null = null;
  protected running = false;
  /** 对话历史（跨轮次保持） */
  protected conversationHistory: Message[] = [];
  /** 最大历史消息数（防止无限增长） */
  protected maxHistoryLength = 50;
  private logger = new Logger('channel');

  constructor(protected options: ChannelOptions) {}

  /** 渠道类型标识 */
  abstract get type(): string;

  /** 关联 agent */
  setAgent(agent: Agent): void {
    this.agent = agent;
  }

  /** 启动渠道 */
  abstract start(): Promise<void>;

  /** 停止渠道 */
  abstract stop(): Promise<void>;

  /** 发送消息（由渠道实现） */
  abstract send(message: string): Promise<void>;

  /** 处理收到的消息（由子类调用） */
  protected async handleMessage(message: ChannelMessage): Promise<AgentResult | null> {
    if (!this.agent) {
      throw new Error('No agent configured for this channel');
    }

    this.logger.debug(`Handling message, history has ${this.conversationHistory.length} messages`);

    // 使用 runWithHistory 保持上下文连贯
    const result = await this.agent.runWithHistory(
      this.conversationHistory,
      message.content,
    );

    // 更新对话历史：保留本次交互的所有消息
    if (result.messages.length > 0) {
      this.conversationHistory = result.messages;
      this.logger.debug(`Updated history: ${this.conversationHistory.length} messages`);

      // 截断过长的历史（保留系统消息 + 最近的对话）
      if (this.conversationHistory.length > this.maxHistoryLength) {
        const systemMsg = this.conversationHistory.find((m) => m.role === 'system');
        const recentMessages = this.conversationHistory.slice(
          this.conversationHistory.length - this.maxHistoryLength + (systemMsg ? 1 : 0),
        );
        this.conversationHistory = systemMsg
          ? [systemMsg, ...recentMessages]
          : recentMessages;
      }
    }

    return result;
  }

  /** 清空对话历史 */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /** 生成消息 ID */
  protected generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /** 检查是否正在运行 */
  isRunning(): boolean {
    return this.running;
  }
}
