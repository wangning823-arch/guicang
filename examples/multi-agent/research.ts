/**
 * 多 Agent 协作示例
 * 展示如何使用 Orchestrator 进行任务分发
 */

import {
  Agent,
  OpenAIProvider,
  Orchestrator,
} from '../../src/index.js';

async function main() {
  const providerConfig = {
    type: 'openai' as const,
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  };

  // 创建 Orchestrator
  const orchestrator = new Orchestrator();

  // 注册研究员角色
  orchestrator.registerRole({
    id: 'researcher',
    name: 'Researcher',
    description: 'Researches topics and finds information',
    agent: new Agent(new OpenAIProvider(providerConfig), {
      systemPrompt: 'You are a researcher. Find and summarize key information.',
    }),
  });

  // 注册写手角色
  orchestrator.registerRole({
    id: 'writer',
    name: 'Writer',
    description: 'Writes content based on research',
    agent: new Agent(new OpenAIProvider(providerConfig), {
      systemPrompt: 'You are a writer. Create engaging content based on the input.',
    }),
  });

  // 注册审校角色
  orchestrator.registerRole({
    id: 'reviewer',
    name: 'Reviewer',
    description: 'Reviews and improves content',
    agent: new Agent(new OpenAIProvider(providerConfig), {
      systemPrompt: 'You are an editor. Review and improve the content.',
    }),
  });

  // 流水线执行：研究 → 写作 → 审校
  console.log('🔄 Running research pipeline...\n');

  const result = await orchestrator.pipeline(
    [
      'Research the latest trends in AI agents',
      'Write a brief article based on the research',
      'Review and polish the article',
    ],
    'researcher', // 第一步用研究员
  );

  // 输出最终结果
  const lastTask = result.tasks[result.tasks.length - 1];
  if (lastTask?.result) {
    const finalMessage = lastTask.result.messages
      .filter((m) => m.role === 'assistant')
      .pop();

    console.log('📄 Final Output:');
    console.log(finalMessage?.content);
  }

  console.log(`\n⏱️  Total time: ${result.totalDuration}ms`);
  console.log(`✅ Success: ${result.success}`);
}

main().catch(console.error);
