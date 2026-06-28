/**
 * 自我反思机制
 * Agent 自动评估输出质量并修正
 */

import type { BaseProvider, ProviderOptions } from '../provider/base.js';
import { Logger } from './logger.js';

const logger = new Logger('reflection');

/** 反思结果 */
export interface ReflectionResult {
  /** 质量评估 */
  quality: 'good' | 'needs_improvement';
  /** 发现的问题 */
  issues: string[];
  /** 改进建议 */
  suggestions: string[];
  /** 修正后的内容（如果有） */
  revisedContent?: string;
  /** 质量分数 0-100 */
  score: number;
}

/** 反思选项 */
export interface ReflectionOptions {
  /** 质量阈值，低于此分数触发修正（默认 60） */
  qualityThreshold?: number;
  /** 是否自动修正（默认 true） */
  autoRevise?: boolean;
  /** Provider 选项 */
  providerOptions?: ProviderOptions;
}

const DEFAULT_OPTIONS: Required<ReflectionOptions> = {
  qualityThreshold: 60,
  autoRevise: true,
  providerOptions: {},
};

/**
 * 自我反思模块
 *
 * 工作流程：
 * 1. 接收 Agent 的输出内容
 * 2. 评估输出质量（准确性、完整性、相关性）
 * 3. 如果质量低于阈值，生成修正版本
 * 4. 返回反思结果
 */
export class SelfReflection {
  private options: Required<ReflectionOptions>;

  constructor(options?: ReflectionOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 评估输出质量
   */
  async evaluate(
    output: string,
    context: string,
    provider: BaseProvider,
  ): Promise<ReflectionResult> {
    logger.info('Evaluating output quality...');

    // 1. 质量评估
    const evaluation = await this.assessQuality(output, context, provider);

    // 2. 如果质量不佳且启用自动修正，生成修正版本
    if (
      evaluation.quality === 'needs_improvement' &&
      this.options.autoRevise
    ) {
      logger.info(`Output quality ${evaluation.score}/100, attempting revision...`);
      const revised = await this.revise(output, context, evaluation, provider);
      evaluation.revisedContent = revised;
    }

    return evaluation;
  }

  /**
   * 评估输出质量
   */
  private async assessQuality(
    output: string,
    context: string,
    provider: BaseProvider,
  ): Promise<ReflectionResult> {
    const prompt = this.buildAssessmentPrompt(output, context);

    try {
      const response = await provider.chat(
        [{ role: 'user', content: prompt }],
        undefined,
        this.options.providerOptions,
      );

      return this.parseAssessment(response.message.content);
    } catch (error) {
      logger.error('Quality assessment failed', error);
      return {
        quality: 'good',
        issues: [],
        suggestions: [],
        score: 70, // 默认及格分
      };
    }
  }

  /**
   * 修正输出
   */
  private async revise(
    output: string,
    context: string,
    assessment: ReflectionResult,
    provider: BaseProvider,
  ): Promise<string> {
    const prompt = this.buildRevisionPrompt(output, context, assessment);

    try {
      const response = await provider.chat(
        [{ role: 'user', content: prompt }],
        undefined,
        this.options.providerOptions,
      );

      return response.message.content;
    } catch (error) {
      logger.error('Revision failed', error);
      return output; // 失败时返回原文
    }
  }

  // --- Prompt 构建 ---

  private buildAssessmentPrompt(output: string, context: string): string {
    return `你是一个严格的质量评估专家。请评估以下输出的质量。

用户请求的上下文：
${context}

Agent 的输出：
${output}

请从以下维度评估并给出 JSON 格式的结果（只输出 JSON）：
{
  "score": 0-100 的质量分数,
  "quality": "good" 或 "needs_improvement",
  "issues": ["发现的问题列表"],
  "suggestions": ["改进建议列表"]
}

评估标准：
- 准确性：信息是否正确
- 完整性：是否回答了所有问题
- 相关性：是否与请求相关
- 清晰度：表达是否清楚
- 可操作性：如果是操作指令，是否可以直接执行`;
  }

  private buildRevisionPrompt(
    output: string,
    context: string,
    assessment: ReflectionResult,
  ): string {
    const issuesText = assessment.issues.map((i) => `- ${i}`).join('\n');
    const suggestionsText = assessment.suggestions.map((s) => `- ${s}`).join('\n');

    return `请根据以下反馈修正输出。

用户请求的上下文：
${context}

原始输出：
${output}

发现的问题：
${issuesText}

改进建议：
${suggestionsText}

请输出修正后的完整内容：`;
  }

  // --- 结果解析 ---

  private parseAssessment(content: string): ReflectionResult {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found');
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        score?: number;
        quality?: string;
        issues?: string[];
        suggestions?: string[];
      };

      return {
        score: Math.min(100, Math.max(0, parsed.score ?? 70)),
        quality: parsed.quality === 'needs_improvement' ? 'needs_improvement' : 'good',
        issues: parsed.issues ?? [],
        suggestions: parsed.suggestions ?? [],
      };
    } catch (error) {
      logger.warn('Failed to parse assessment, using defaults');
      return {
        quality: 'good',
        issues: [],
        suggestions: [],
        score: 70,
      };
    }
  }
}
