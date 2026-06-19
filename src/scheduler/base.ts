/**
 * 定时任务基类
 * 周期性任务和主动检查机制
 */

/** 任务状态 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** 定时任务配置 */
export interface ScheduleConfig {
  /** 任务名称 */
  name: string;
  /** 任务描述 */
  description?: string;
  /** 执行间隔（毫秒） */
  intervalMs: number;
  /** 是否在注册后立即执行一次 */
  runImmediately?: boolean;
  /** 最大执行次数（0=无限） */
  maxExecutions?: number;
  /** 超时（毫秒） */
  timeout?: number;
}

/** 任务执行结果 */
export interface TaskResult {
  /** 任务名称 */
  name: string;
  /** 执行状态 */
  status: TaskStatus;
  /** 执行输出 */
  output?: string;
  /** 错误信息 */
  error?: string;
  /** 执行时长（毫秒） */
  duration?: number;
  /** 执行时间 */
  executedAt: Date;
}

/** 任务回调 */
export type TaskCallback = () => Promise<void>;

/**
 * 定时任务抽象基类
 */
export abstract class BaseTask {
  public status: TaskStatus = 'pending';
  public executionCount = 0;
  public lastExecution?: Date;
  public lastResult?: TaskResult;

  constructor(public readonly config: ScheduleConfig) {}

  get name(): string {
    return this.config.name;
  }

  /**
   * 执行任务
   */
  abstract execute(): Promise<TaskResult>;

  /**
   * 取消任务
   */
  cancel(): void {
    this.status = 'cancelled';
  }
}
