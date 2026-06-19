/**
 * 文本摘要技能
 * 将长文本压缩为简洁摘要
 */

import { BaseSkill, type SkillContext, type SkillResult } from '../base.js';

export class SummarizeSkill extends BaseSkill {
  constructor() {
    super({
      name: 'summarize',
      description: 'Summarize long text into a concise overview',
      version: '1.0.0',
      tags: ['text', 'summary', 'analysis'],
    });
  }

  canHandle(message: { content: string }): boolean {
    // 文本超过 200 字符时可以处理
    return message.content.length > 200;
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    const { message } = context;
    const text = message.content;

    // 简单的摘要生成（生产环境应使用 LLM）
    const sentences = text.split(/[.!?。！？]+/).filter((s) => s.trim().length > 0);
    const wordCount = text.split(/\s+/).length;

    // 取前 3 个句子作为摘要
    const summary = sentences.slice(0, 3).join('. ').trim() + '.';

    return {
      success: true,
      output: `**摘要** (${wordCount} 词):\n${summary}`,
    };
  }
}
