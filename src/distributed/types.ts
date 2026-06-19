/**
 * 分布式 Agent 类型定义
 */

/** 任务状态 */
export type DistributedTaskStatus =
  | 'queued'
  | 'assigned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** 分布式任务 */
export interface DistributedTask {
  /** 任务 ID */
  id: string;
  /** 任务类型 */
  type: string;
  /** 任务输入 */
  input: Record<string, unknown>;
  /** 任务状态 */
  status: DistributedTaskStatus;
  /** 分配给的 worker ID */
  workerId?: string;
  /** 任务结果 */
  result?: unknown;
  /** 错误信息 */
  error?: string;
  /** 创建时间 */
  createdAt: Date;
  /** 开始时间 */
  startedAt?: Date;
  /** 完成时间 */
  completedAt?: Date;
  /** 重试次数 */
  retries: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 优先级 (0-10) */
  priority: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/** Worker 信息 */
export interface WorkerInfo {
  /** Worker ID */
  id: string;
  /** Worker 名称 */
  name: string;
  /** 支持的任务类型 */
  supportedTypes: string[];
  /** 当前状态 */
  status: 'idle' | 'busy' | 'offline';
  /** 当前任务 ID */
  currentTaskId?: string;
  /** 已完成任务数 */
  completedTasks: number;
  /** 失败任务数 */
  failedTasks: number;
  /** 最后心跳时间 */
  lastHeartbeat: Date;
}

/** 任务处理器 */
export type TaskHandler = (
  task: DistributedTask,
) => Promise<unknown>;

/** 分布式任务结果 */
export interface DistributedTaskResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}
