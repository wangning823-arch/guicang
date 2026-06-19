/**
 * 代码审查技能
 * 分析代码并提供改进建议
 */

import { BaseSkill, type SkillContext, type SkillResult } from '../base.js';
import type { ToolDefinition } from '../../core/types.js';

export class CodeReviewSkill extends BaseSkill {
  constructor() {
    super({
      name: 'code-review',
      description: 'Analyze code and provide improvement suggestions',
      version: '1.0.0',
      tags: ['code', 'analysis', 'review'],
    });
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    const { message } = context;
    const code = message.content;

    // 简单的代码分析规则
    const issues: string[] = [];

    // 检查常见问题
    if (code.includes('console.log')) {
      issues.push('Found console.log statements - consider removing for production');
    }
    if (code.includes('TODO') || code.includes('FIXME')) {
      issues.push('Found TODO/FIXME comments - address before merging');
    }
    if (code.length > 1000) {
      issues.push('Code block is quite long - consider breaking into smaller functions');
    }

    // 检查安全问题
    if (code.includes('eval(')) {
      issues.push('Security: eval() usage detected - potential security risk');
    }
    if (code.includes('innerHTML')) {
      issues.push('Security: innerHTML usage detected - potential XSS risk');
    }

    if (issues.length === 0) {
      return {
        success: true,
        output: 'No obvious issues found. Code looks clean!',
      };
    }

    return {
      success: true,
      output: `Found ${issues.length} potential issues:\n${issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}`,
    };
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'code_review',
        description: 'Review code and provide feedback',
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'Code to review' },
            language: { type: 'string', description: 'Programming language' },
          },
          required: ['code'],
        },
      },
    ];
  }
}
