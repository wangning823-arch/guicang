/**
 * 多 Agent 协作框架
 * Agent 间消息传递、协作任务分配
 */

import { Logger } from '../core/logger.js';

const logger = new Logger('collaboration');

/** Agent 角色 */
export type AgentRole =
  | 'coordinator'
  | 'worker'
  | 'reviewer'
  | 'specialist'
  | 'observer';

/** 协作消息 */
export interface CollaborationMessage {
  id: string;
  from: string;
  to: string | 'broadcast';
  type: 'task' | 'result' | 'question' | 'answer' | 'status' | 'error';
  content: unknown;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/** 协作任务 */
export interface CollaborationTask {
  id: string;
  title: string;
  description: string;
  assignedTo: string[];
  createdBy: string;
  status: 'pending' | 'in_progress' | 'review' | 'completed' | 'failed';
  result?: unknown;
  dependencies: string[];
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Agent 信息 */
export interface AgentInfo {
  id: string;
  name: string;
  role: AgentRole;
  capabilities: string[];
  status: 'online' | 'busy' | 'offline';
  currentTaskId?: string;
  completedTasks: number;
  lastSeen: Date;
}

/** 消息处理器 */
export type MessageHandler = (
  message: CollaborationMessage,
) => Promise<void>;

/**
 * Agent 网络
 */
export class AgentNetwork {
  private agents = new Map<string, AgentInfo>();
  private tasks = new Map<string, CollaborationTask>();
  private messageHandlers = new Map<string, MessageHandler[]>();
  private messageHistory: CollaborationMessage[] = [];

  /**
   * 注册 Agent
   */
  registerAgent(agent: AgentInfo): void {
    this.agents.set(agent.id, agent);
    logger.info(`Agent registered: ${agent.name} (${agent.role})`);
  }

  /**
   * 注销 Agent
   */
  unregisterAgent(agentId: string): boolean {
    const result = this.agents.delete(agentId);
    if (result) {
      logger.info(`Agent unregistered: ${agentId}`);
    }
    return result;
  }

  /**
   * 获取 Agent
   */
  getAgent(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId);
  }

  /**
   * 获取所有 Agent
   */
  getAllAgents(): AgentInfo[] {
    return [...this.agents.values()];
  }

  /**
   * 按角色获取 Agent
   */
  getAgentsByRole(role: AgentRole): AgentInfo[] {
    return [...this.agents.values()].filter((a) => a.role === role);
  }

  /**
   * 获取在线 Agent
   */
  getOnlineAgents(): AgentInfo[] {
    return [...this.agents.values()].filter((a) => a.status !== 'offline');
  }

  /**
   * 注册消息处理器
   */
  onMessage(agentId: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(agentId)) {
      this.messageHandlers.set(agentId, []);
    }
    this.messageHandlers.get(agentId)!.push(handler);
  }

  /**
   * 发送消息
   */
  async sendMessage(message: Omit<CollaborationMessage, 'id' | 'timestamp'>): Promise<void> {
    const fullMessage: CollaborationMessage = {
      ...message,
      id: this.generateId(),
      timestamp: new Date(),
    };

    this.messageHistory.push(fullMessage);

    // 分发给目标
    if (message.to === 'broadcast') {
      for (const [agentId, handlers] of this.messageHandlers) {
        if (agentId !== message.from) {
          for (const handler of handlers) {
            await handler(fullMessage);
          }
        }
      }
    } else {
      const handlers = this.messageHandlers.get(message.to) ?? [];
      for (const handler of handlers) {
        await handler(fullMessage);
      }
    }

    logger.debug(`Message sent: ${message.from} -> ${message.to} (${message.type})`);
  }

  /**
   * 创建协作任务
   */
  createTask(
    task: Omit<CollaborationTask, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  ): CollaborationTask {
    const fullTask: CollaborationTask = {
      ...task,
      id: this.generateId(),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.set(fullTask.id, fullTask);
    logger.info(`Task created: ${fullTask.title}`);
    return fullTask;
  }

  /**
   * 分配任务
   */
  assignTask(taskId: string, agentIds: string[]): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.assignedTo = agentIds;
    task.status = 'in_progress';
    task.updatedAt = new Date();

    // 更新 Agent 状态
    for (const agentId of agentIds) {
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.status = 'busy';
        agent.currentTaskId = taskId;
      }
    }

    logger.info(`Task ${taskId} assigned to ${agentIds.join(', ')}`);
    return true;
  }

  /**
   * 完成任务
   */
  completeTask(taskId: string, result: unknown): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = 'completed';
    task.result = result;
    task.updatedAt = new Date();

    // 更新 Agent 状态
    for (const agentId of task.assignedTo) {
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.status = 'online';
        agent.currentTaskId = undefined;
        agent.completedTasks++;
      }
    }

    logger.info(`Task ${taskId} completed`);
    return true;
  }

  /**
   * 失败任务
   */
  failTask(taskId: string, error: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = 'failed';
    task.result = { error };
    task.updatedAt = new Date();

    // 更新 Agent 状态
    for (const agentId of task.assignedTo) {
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.status = 'online';
        agent.currentTaskId = undefined;
      }
    }

    logger.info(`Task ${taskId} failed: ${error}`);
    return true;
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): CollaborationTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): CollaborationTask[] {
    return [...this.tasks.values()];
  }

  /**
   * 按状态获取任务
   */
  getTasksByStatus(status: CollaborationTask['status']): CollaborationTask[] {
    return [...this.tasks.values()].filter((t) => t.status === status);
  }

  /**
   * 智能分配任务
   * 根据 Agent 能力和负载自动分配
   */
  autoAssignTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // 查找可用的在线 Agent
    const availableAgents = this.getOnlineAgents().filter(
      (a) => a.status === 'online',
    );

    if (availableAgents.length === 0) {
      logger.warn('No available agents for task assignment');
      return false;
    }

    // 按完成任务数排序（优先分配给经验丰富的 Agent）
    availableAgents.sort((a, b) => b.completedTasks - a.completedTasks);

    // 分配给第一个可用的 Agent
    const assignee = availableAgents[0];
    return this.assignTask(taskId, [assignee.id]);
  }

  /**
   * 获取消息历史
   */
  getMessageHistory(limit = 50): CollaborationMessage[] {
    return this.messageHistory.slice(-limit);
  }

  /**
   * 获取网络统计
   */
  getStats(): {
    totalAgents: number;
    onlineAgents: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    pendingTasks: number;
  } {
    const agents = this.getAllAgents();
    const tasks = this.getAllTasks();

    return {
      totalAgents: agents.length,
      onlineAgents: agents.filter((a) => a.status !== 'offline').length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.status === 'completed').length,
      failedTasks: tasks.filter((t) => t.status === 'failed').length,
      pendingTasks: tasks.filter((t) => t.status === 'pending').length,
    };
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2, 15);
  }
}

/** 全局 Agent 网络 */
export const agentNetwork = new AgentNetwork();
