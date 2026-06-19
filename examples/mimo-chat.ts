/**
 * Mimo v2.5 对话示例
 * 展示如何使用归藏与 Mimo 模型交互
 */

import {
  Agent,
  MimoProvider,
  registerTools,
  FileReadTool,
  FileWriteTool,
  ShellTool,
} from '../src/index.js';

async function main() {
  console.log('🌊 归藏 (Guicang) - Mimo v2.5 Demo\n');

  // 1. 注册工具
  registerTools([
    new FileReadTool(),
    new FileWriteTool(),
    new ShellTool(),
  ]);

  // 2. 创建 Mimo Provider
  const provider = new MimoProvider({
    type: 'mimo',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic',
    model: 'mimo-v2.5',
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
    timeout: 120000,
  });

  // 3. 验证配置
  const isValid = await provider.validate();
  if (!isValid) {
    console.error('❌ Invalid API key. Set ANTHROPIC_AUTH_TOKEN environment variable.');
    process.exit(1);
  }
  console.log('✅ API key validated');

  // 4. 创建 Agent
  const agent = new Agent(provider, {
    maxIterations: 5,
    systemPrompt: 'You are 归藏 (Guicang), a helpful AI assistant. 万物归藏，一念即达。',
  });

  // 5. 运行对话
  const userMessage = process.argv[2] || 'Hello! Who are you?';
  console.log(`\n👤 User: ${userMessage}\n`);

  const result = await agent.run(userMessage);

  // 6. 输出结果
  const lastAssistant = result.messages
    .filter((m) => m.role === 'assistant')
    .pop();

  console.log(`🤖 Guicang: ${lastAssistant?.content}\n`);

  // 7. 统计信息
  console.log('📊 Stats:');
  console.log(`   Status: ${result.status}`);
  console.log(`   Tool calls: ${result.toolCalls.length}`);
  if (result.totalUsage) {
    console.log(`   Tokens: ${result.totalUsage.totalTokens}`);
  }
}

main().catch(console.error);
