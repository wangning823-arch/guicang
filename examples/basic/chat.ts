/**
 * 基础对话示例
 * 展示如何使用 Agent 进行简单对话
 */

import {
  Agent,
  OpenAIProvider,
  registerTools,
  FileReadTool,
  FileWriteTool,
  ShellTool,
} from '../../src/index.js';

async function main() {
  // 1. 注册工具
  registerTools([
    new FileReadTool(),
    new FileWriteTool(),
    new ShellTool(),
  ]);

  // 2. 创建 Provider
  const provider = new OpenAIProvider({
    type: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  // 3. 创建 Agent
  const agent = new Agent(provider, {
    maxIterations: 5,
    systemPrompt: 'You are a helpful coding assistant. Use tools when needed.',
  });

  // 4. 运行对话
  console.log('🤖 归藏 AI Assistant\n');

  const result = await agent.run(
    'Create a file called hello.txt with the content "Hello, 归藏!"',
  );

  // 5. 输出结果
  console.log('📝 Response:');
  const lastMessage = result.messages.filter((m) => m.role === 'assistant').pop();
  console.log(lastMessage?.content);

  console.log('\n📊 Stats:');
  console.log(`  Tool calls: ${result.toolCalls.length}`);
  console.log(`  Total tokens: ${result.totalUsage?.totalTokens}`);
}

main().catch(console.error);
