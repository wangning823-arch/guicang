/**
 * 多步推理链
 * Chain-of-Thought 自动分解复杂任务
 * 将复杂任务拆解为可执行的子步骤
 */

import type { BaseProvider, ProviderOptions } from '../provider/base.js';
import { Logger } from './logger.js';

const logger = new Logger('reasoning');

/** 推理步骤 */
export interface ReasoningStep {
  /** 步骤编号 */
  index: number;
  /** 思考过程 */
  thought: string;
  /** 要执行的动作 */
  action: string;
  /** 预期结果 */
  expectedOutcome: string;
  /** 所需工具（如果有） */
  tools?: string[];
  /** 状态 */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  /** 实际结果 */
  actualOutcome?: string;
}

/** 推理链选项 */
export interface ReasoningChainOptions {
  /** 最大步骤数（默认 10） */
  maxSteps?: number;
  /** Provider 选项 */
  providerOptions?: ProviderOptions;
  /** 是否启用自动验证（默认 true） */
  autoValidate?: boolean;
}

const DEFAULT_OPTIONS: Required<ReasoningChainOptions> = {
  maxSteps: 10,
  providerOptions: {},
  autoValidate: true,
};

/**
 * 推理链
 *
 * 工作流程：
 * 1. 接收复杂任务描述
 * 2. 调用 LLM 将任务分解为子步骤
 * 3. 返回结构化的推理步骤列表
 * 4. 调用者可以逐步执行并报告结果
 */
export class ReasoningChain {
  private steps: ReasoningStep[] = [];
  private options: Required<ReasoningChainOptions>;

  constructor(options?: ReasoningChainOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 分解任务为推理步骤
   */
  async decompose(task: string, provider: BaseProvider): Promise<ReasoningStep[]> {
    logger.info(`Decomposing task: ${task.slice(0, 100)}...`);

    const prompt = this.buildDecompositionPrompt(task);

    try {
      const response = await provider.chat(
        [{ role: 'user', content: prompt }],
        undefined,
        this.options.providerOptions,
      );

      this.steps = this.parseSteps(response.message.content);
      logger.info(`Task decomposed into ${this.steps.length} steps`);

      return this.steps;
    } catch (error) {
      logger.error('Failed to decompose task', error);
      // 回退：创建单步推理
      return this.fallbackDecomposition(task);
    }
  }

  /**
   * 获取推理进度
   */
  getProgress(): { completed: number; total: number; percentage: number } {
    const completed = this.steps.filter((s) => s.status === 'completed').length;
    const total = this.steps.length;
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  /**
   * 标记步骤完成
   */
  completeStep(index: number, outcome: string): void {
    if (index >= 0 && index < this.steps.length) {
      this.steps[index].status = 'completed';
      this.steps[index].actualOutcome = outcome;
    }
  }

  /**
   * 标记步骤失败
   */
  failStep(index: number, error: string): void {
    if (index >= 0 && index < this.steps.length) {
      this.steps[index].status = 'failed';
      this.steps[index].actualOutcome = `Failed: ${error}`;
    }
  }

  /**
   * 获取下一步
   */
  getNextStep(): ReasoningStep | null {
    return this.steps.find((s) => s.status === 'pending') ?? null;
  }

  /**
   * 获取所有步骤
   */
  getSteps(): ReasoningStep[] {
    return [...this.steps];
  }

  /**
   * 验证推理链完整性
   */
  validate(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (this.steps.length === 0) {
      issues.push('No steps in reasoning chain');
    }

    if (this.steps.length > this.options.maxSteps) {
      issues.push(`Too many steps: ${this.steps.length} > ${this.options.maxSteps}`);
    }

    for (const step of this.steps) {
      if (!step.thought) {
        issues.push(`Step ${step.index}: missing thought`);
      }
      if (!step.action) {
        issues.push(`Step ${step.index}: missing action`);
      }
      if (!step.expectedOutcome) {
        issues.push(`Step ${step.index}: missing expected outcome`);
      }
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * 获取执行摘要
   */
  getSummary(): string {
    const progress = this.getProgress();
    const lines = [
      `推理链进度: ${progress.completed}/${progress.total} (${progress.percentage}%)`,
      '',
    ];

    for (const step of this.steps) {
      const icon =
        step.status === 'completed' ? '✅' :
        step.status === 'failed' ? '❌' :
        step.status === 'in_progress' ? '🔄' : '⏳';

      lines.push(`${icon} Step ${step.index}: ${step.action}`);
      if (step.actualOutcome) {
        lines.push(`   结果: ${step.actualOutcome}`);
      }
    }

    return lines.join('\n');
  }

  // --- 内部方法 ---

  private buildDecompositionPrompt(task: string): string {
    return `你是一个任务分解专家。请将以下复杂任务分解为清晰的子步骤。

要求：
1. 每个步骤必须是可独立执行的
2. 步骤之间应有逻辑顺序
3. 标明每个步骤需要使用的工具（如果有）
4. 最多 ${this.options.maxSteps} 个步骤

任务：${task}

请按以下 JSON 格式输出步骤列表（只输出 JSON，不要其他内容）：
[
  {
    "thought": "为什么需要这个步骤",
    "action": "具体要做什么",
    "expectedOutcome": "预期结果是什么",
    "tools": ["需要的工具名，如果没有则为空数组"]
  }
]`;
  }

  private parseSteps(content: string): ReasoningStep[] {
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const rawSteps = JSON.parse(jsonMatch[0]) as Array<{
        thought?: string;
        action?: string;
        expectedOutcome?: string;
        tools?: string[];
      }>;

      return rawSteps.map((s, i) => ({
        index: i,
        thought: s.thought ?? '',
        action: s.action ?? '',
        expectedOutcome: s.expectedOutcome ?? '',
        tools: s.tools ?? [],
        status: 'pending' as const,
      }));
    } catch {
      logger.warn('Failed to parse steps from LLM response, using fallback');
      return [];
    }
  }

  private fallbackDecomposition(task: string): ReasoningStep[] {
    return [
      {
        index: 0,
        thought: '直接执行任务',
        action: task,
        expectedOutcome: '任务完成',
        tools: [],
        status: 'pending',
      },
    ];
  }
}
