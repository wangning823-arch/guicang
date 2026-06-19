/**
 * 多 Agent 协作基类
 * 子 agent 生成和任务分发
 */

import type { Agent } from '../core/agent.js';
import type { AgentResult } from '../core/types.js';

/** 任务状态 */
export type TaskState = 'pending' | 'assigned' | 'running' | 'completed' | 'failed';

/** 协作任务 */
export interface CollaborationTask {
  /** 任务 ID */
  id: string;
  /** 任务描述 */
  description: string;
  /** 任务输入 */
  input: string;
  /** 任务状态 */
  state: TaskState;
  /** 分配给的 agent ID */
  assignedTo?: string;
  /** 任务结果 */
  result?: AgentResult;
  /** 创建时间 */
  createdAt: Date;
  /** 完成时间 */
  completedAt?: Date;
}

/** Agent 角色定义 */
export interface AgentRole {
  /** 角色 ID */
  id: string;
  /** 角色名称 */
  name: string;
  /** 角色描述 */
  description: string;
  /** Agent 实例 */
  agent: Agent;
  /** 可处理的任务类型 */
  capabilities?: string[];
}

/** 协作结果 */
export interface CollaborationResult {
  /** 所有任务结果 */
  tasks: CollaborationTask[];
  /** 是否全部成功 */
  success: boolean;
  /** 总耗时（毫秒） */
  totalDuration: number;
}
