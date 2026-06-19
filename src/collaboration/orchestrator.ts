/**
 * 协作编排器
 * 管理多 agent 任务分发和结果收集
 */

import {
  type CollaborationTask,
  type AgentRole,
  type CollaborationResult,
} from './base.js';
import { Logger } from '../core/logger.js';

/** 生成任务 ID */
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 协作编排器
 */
export class Orchestrator {
  private roles = new Map<string, AgentRole>();
  private logger = new Logger('orchestrator');

  /**
   * 注册 agent 角色
   */
  registerRole(role: AgentRole): void {
    if (this.roles.has(role.id)) {
      throw new Error(`Role "${role.id}" is already registered`);
    }
    this.roles.set(role.id, role);
    this.logger.info(`Registered role: ${role.name}`, { id: role.id });
  }

  /**
   * 获取角色
   */
  getRole(id: string): AgentRole | undefined {
    return this.roles.get(id);
  }

  /**
   * 获取所有角色
   */
  getAllRoles(): AgentRole[] {
    return [...this.roles.values()];
  }

  /**
   * 创建任务
   */
  createTask(description: string, input: string): CollaborationTask {
    return {
      id: generateTaskId(),
      description,
      input,
      state: 'pending',
      createdAt: new Date(),
    };
  }

  /**
   * 分配任务给角色
   */
  assignTask(task: CollaborationTask, roleId: string): CollaborationTask {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role "${roleId}" not found`);
    }

    task.assignedTo = roleId;
    task.state = 'assigned';
    return task;
  }

  /**
   * 执行单个任务
   */
  async executeTask(task: CollaborationTask): Promise<CollaborationTask> {
    if (!task.assignedTo) {
      throw new Error(`Task "${task.id}" is not assigned to any role`);
    }

    const role = this.roles.get(task.assignedTo);
    if (!role) {
      throw new Error(`Role "${task.assignedTo}" not found`);
    }

    task.state = 'running';
    this.logger.info(`Executing task: ${task.description}`, { role: role.name });

    try {
      const result = await role.agent.run(task.input);
      task.result = result;
      task.state = result.status === 'done' ? 'completed' : 'failed';
      task.completedAt = new Date();
    } catch (error) {
      task.state = 'failed';
      task.completedAt = new Date();
      this.logger.error(`Task failed: ${task.description}`, error);
    }

    return task;
  }

  /**
   * 执行多个任务（并发）
   */
  async executeTasks(
    tasks: CollaborationTask[],
    concurrency: number = 5,
  ): Promise<CollaborationResult> {
    const startTime = Date.now();
    const results: CollaborationTask[] = [];

    // 简单的并发控制
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((task) => this.executeTask(task)),
      );
      results.push(...batchResults);
    }

    return {
      tasks: results,
      success: results.every((t) => t.state === 'completed'),
      totalDuration: Date.now() - startTime,
    };
  }

  /**
   * 流水线执行（前一个任务的输出作为下一个任务的输入）
   */
  async pipeline(
    inputs: string[],
    roleId: string,
  ): Promise<CollaborationResult> {
    const startTime = Date.now();
    const tasks: CollaborationTask[] = [];
    let currentInput = '';

    for (const input of inputs) {
      currentInput = currentInput ? `${currentInput}\n\n${input}` : input;

      const task = this.createTask('Pipeline step', currentInput);
      this.assignTask(task, roleId);
      tasks.push(task);

      await this.executeTask(task);

      // 如果任务失败，停止流水线
      if (task.state === 'failed') break;

      // 使用任务输出作为下一步的输入
      if (task.result) {
        const lastAssistant = task.result.messages
          .filter((m) => m.role === 'assistant')
          .pop();
        if (lastAssistant) {
          currentInput = lastAssistant.content;
        }
      }
    }

    return {
      tasks,
      success: tasks.every((t) => t.state === 'completed'),
      totalDuration: Date.now() - startTime,
    };
  }

  /**
   * 清空所有角色（测试用）
   */
  clear(): void {
    this.roles.clear();
  }
}
