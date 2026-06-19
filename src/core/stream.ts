/**
 * 流式输出支持
 * 实现 LLM 流式响应处理
 */

import type { ToolCall, LLMResponse } from './types.js';

/** 流式事件类型 */
export type StreamEventType =
  | 'text_delta'
  | 'tool_call_start'
  | 'tool_call_delta'
  | 'tool_call_end'
  | 'done'
  | 'error';

/** 流式事件 */
export interface StreamEvent {
  type: StreamEventType;
  /** 文本增量（text_delta） */
  delta?: string;
  /** 工具调用 ID */
  toolCallId?: string;
  /** 工具名称 */
  toolName?: string;
  /** 工具参数增量 */
  argsDelta?: string;
  /** 完整的工具调用（tool_call_end） */
  toolCall?: ToolCall;
  /** 错误信息 */
  error?: string;
}

/** 流式回调 */
export type StreamCallback = (event: StreamEvent) => void;

/**
 * 流式处理器
 * 管理流式输出的状态和事件
 */
export class StreamHandler {
  private buffer = '';
  private toolCalls = new Map<string, { id: string; name: string; argsBuffer: string }>();
  private callback?: StreamCallback;

  constructor(callback?: StreamCallback) {
    this.callback = callback;
  }

  /** 设置回调 */
  setCallback(callback: StreamCallback): void {
    this.callback = callback;
  }

  /** 处理文本增量 */
  handleTextDelta(delta: string): void {
    this.buffer += delta;
    this.emit({ type: 'text_delta', delta });
  }

  /** 处理工具调用开始 */
  handleToolCallStart(id: string, name: string): void {
    this.toolCalls.set(id, { id, name, argsBuffer: '' });
    this.emit({ type: 'tool_call_start', toolCallId: id, toolName: name });
  }

  /** 处理工具调用参数增量 */
  handleToolCallDelta(id: string, argsDelta: string): void {
    const toolCall = this.toolCalls.get(id);
    if (toolCall) {
      toolCall.argsBuffer += argsDelta;
      this.emit({ type: 'tool_call_delta', toolCallId: id, argsDelta });
    }
  }

  /** 处理工具调用结束 */
  handleToolCallEnd(id: string): ToolCall | null {
    const toolCall = this.toolCalls.get(id);
    if (!toolCall) return null;

    const parsed: ToolCall = {
      id: toolCall.id,
      name: toolCall.name,
      arguments: this.safeParseJSON(toolCall.argsBuffer),
    };

    this.emit({ type: 'tool_call_end', toolCallId: id, toolCall: parsed });
    this.toolCalls.delete(id);
    return parsed;
  }

  /** 完成处理 */
  finish(): LLMResponse {
    const toolCalls: ToolCall[] = [...this.toolCalls.values()].map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: this.safeParseJSON(tc.argsBuffer),
    }));

    this.emit({ type: 'done' });

    return {
      message: {
        role: 'assistant',
        content: this.buffer,
      },
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /** 获取当前文本缓冲区 */
  getTextBuffer(): string {
    return this.buffer;
  }

  /** 清空缓冲区 */
  clear(): void {
    this.buffer = '';
    this.toolCalls.clear();
  }

  private emit(event: StreamEvent): void {
    this.callback?.(event);
  }

  private safeParseJSON(text: string): Record<string, unknown> {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
