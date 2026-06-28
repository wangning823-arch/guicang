/**
 * 工具链编排
 * 将多个工具的输出串联为 pipeline
 * 前一个工具的输出自动成为下一个工具的输入
 */

import type { ToolResult } from '../core/types.js';
import type { ToolContext } from './base.js';
import { Logger } from '../core/logger.js';

const logger = new Logger('tool:pipeline');

/** Pipeline 步骤 */
export interface PipelineStep {
  /** 工具名称 */
  tool: string;
  /** 参数映射：接收前序步骤的所有结果，返回当前步骤的参数 */
  argsMapper: (context: PipelineContext) => Record<string, unknown>;
  /** 是否启用（默认 true） */
  enabled?: boolean;
  /** 步骤描述 */
  description?: string;
}

/** Pipeline 执行上下文，传递给每个步骤的 argsMapper */
export interface PipelineContext {
  /** 当前步骤索引 */
  stepIndex: number;
  /** 原始输入参数 */
  originalArgs: Record<string, unknown>;
  /** 所有前序步骤的结果（按索引） */
  previousResults: Array<{
    tool: string;
    args: Record<string, unknown>;
    result: ToolResult;
  }>;
  /** 上一个步骤的结果（快捷方式） */
  lastResult: ToolResult | null;
  /** 上一个步骤的输出内容 */
  lastOutput: string;
}

/** Pipeline 执行结果 */
export interface PipelineResult {
  /** 是否全部成功 */
  success: boolean;
  /** 所有步骤的执行记录 */
  steps: Array<{
    tool: string;
    args: Record<string, unknown>;
    result: ToolResult;
    duration: number;
  }>;
  /** 最终输出（最后一个成功步骤的结果） */
  finalOutput: string;
  /** 总耗时 */
  totalDuration: number;
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 工具链 Pipeline
 *
 * 用法示例：
 * ```typescript
 * const pipeline = new ToolPipeline([
 *   {
 *     tool: 'shell',
 *     argsMapper: () => ({ command: 'ls -la' }),
 *     description: '列出当前目录'
 *   },
 *   {
 *     tool: 'file_write',
 *     argsMapper: (ctx) => ({
 *       path: 'output.txt',
 *       content: ctx.lastOutput
 *     }),
 *     description: '保存结果到文件'
 *   }
 * ]);
 *
 * const result = await pipeline.execute(context);
 * ```
 */
export class ToolPipeline {
  private steps: PipelineStep[];
  private executeFn: (
    tool: string,
    args: Record<string, unknown>,
    toolCallId: string,
    context: ToolContext,
  ) => Promise<ToolResult>;

  constructor(
    steps: PipelineStep[],
    executeFn?: (
      tool: string,
      args: Record<string, unknown>,
      toolCallId: string,
      context: ToolContext,
    ) => Promise<ToolResult>,
  ) {
    this.steps = steps;
    // 默认使用动态 import 的 executeTool
    this.executeFn = executeFn ?? this.defaultExecute;
  }

  /**
   * 执行 pipeline
   */
  async execute(
    context: ToolContext,
    initialArgs: Record<string, unknown> = {},
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const stepResults: PipelineResult['steps'] = [];
    let lastResult: ToolResult | null = null;
    let lastOutput = '';
    let allSuccess = true;

    const pipelineContext: PipelineContext = {
      stepIndex: 0,
      originalArgs: initialArgs,
      previousResults: [],
      lastResult: null,
      lastOutput: '',
    };

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];

      // 检查是否启用
      if (step.enabled === false) {
        logger.debug(`Skipping disabled step ${i}: ${step.description ?? step.tool}`);
        continue;
      }

      // 更新 pipeline 上下文
      pipelineContext.stepIndex = i;
      pipelineContext.lastResult = lastResult;
      pipelineContext.lastOutput = lastOutput;

      // 如果上一步失败，停止 pipeline
      if (lastResult && !lastResult.success) {
        logger.warn(
          `Pipeline stopped at step ${i}: previous step "${this.steps[i - 1].tool}" failed`,
        );
        allSuccess = false;
        break;
      }

      // 计算当前步骤的参数
      const args = step.argsMapper(pipelineContext);

      logger.info(`Pipeline step ${i}: ${step.tool}`, {
        description: step.description,
        args,
      });

      const stepStart = Date.now();

      // 执行工具
      const toolCallId = `pipeline_step_${i}`;
      const result = await this.executeFn(step.tool, args, toolCallId, context);

      const duration = Date.now() - stepStart;

      stepResults.push({
        tool: step.tool,
        args,
        result,
        duration,
      });

      lastResult = result;
      lastOutput = result.success ? result.content : '';

      pipelineContext.previousResults.push({
        tool: step.tool,
        args,
        result,
      });

      if (!result.success) {
        logger.warn(`Pipeline step ${i} failed: ${result.error}`);
        allSuccess = false;
        break;
      }

      logger.debug(`Pipeline step ${i} completed in ${duration}ms`);
    }

    const totalDuration = Date.now() - startTime;
    const finalOutput = lastResult?.success ? lastResult.content : '';

    return {
      success: allSuccess,
      steps: stepResults,
      finalOutput,
      totalDuration,
      error: allSuccess ? undefined : `Pipeline failed at step ${stepResults.length}`,
    };
  }

  /**
   * 添加步骤（支持链式调用）
   */
  addStep(step: PipelineStep): this {
    this.steps.push(step);
    return this;
  }

  /**
   * 获取步骤数量
   */
  get stepCount(): number {
    return this.steps.length;
  }

  /**
   * 默认的工具执行函数（延迟加载）
   */
  private async defaultExecute(
    tool: string,
    args: Record<string, unknown>,
    toolCallId: string,
    context: ToolContext,
  ): Promise<ToolResult> {
    // 动态导入避免循环依赖
    const { executeTool } = await import('./registry.js');
    return executeTool(tool, args, toolCallId, context);
  }
}
