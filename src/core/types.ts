/**
 * 归藏核心类型定义
 * Agent 循环、工具调度的基础类型
 */

/** 消息角色 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** 单条消息 */
export interface Message {
  role: MessageRole;
  content: string;
  /** 工具调用 ID（role=tool 时必填） */
  toolCallId?: string;
}

/** 工具定义 */
export interface ToolDefinition {
  /** 工具名称，唯一标识 */
  name: string;
  /** 工具描述 */
  description: string;
  /** JSON Schema 格式的参数定义 */
  parameters: Record<string, unknown>;
}

/** 工具调用请求 */
export interface ToolCall {
  /** 调用 ID */
  id: string;
  /** 工具名称 */
  name: string;
  /** 工具参数 */
  arguments: Record<string, unknown>;
}

/** 工具执行结果 */
export interface ToolResult {
  /** 调用 ID，与 ToolCall.id 对应 */
  toolCallId: string;
  /** 是否成功 */
  success: boolean;
  /** 结果内容 */
  content: string;
  /** 错误信息（失败时） */
  error?: string;
}

/** LLM 响应 */
export interface LLMResponse {
  /** 响应消息 */
  message: Message;
  /** 工具调用列表（如果有） */
  toolCalls?: ToolCall[];
  /** token 使用量 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 停止原因：'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' */
  stopReason?: string;
}

/** Agent 运行状态 */
export type AgentStatus = 'idle' | 'thinking' | 'acting' | 'observing' | 'done' | 'error';

/** Agent 运行结果 */
export interface AgentResult {
  /** 最终状态 */
  status: AgentStatus;
  /** 完整对话历史 */
  messages: Message[];
  /** 工具调用记录 */
  toolCalls: Array<ToolCall & { result?: ToolResult }>;
  /** 总 token 使用量 */
  totalUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 错误信息 */
  error?: string;
}
