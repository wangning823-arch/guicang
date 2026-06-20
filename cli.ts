/**
 * 归藏 CLI 入口
 * 交互式对话界面
 */

import {
  Agent,
  MimoProvider,
  CLIChannel,
  registerTools,
  FileReadTool,
  FileWriteTool,
  ShellTool,
} from './src/index.js';

async function main() {
  console.log('🌊 归藏 (Guicang) CLI 启动中...\n');

  // 1. 注册工具
  registerTools([
    new FileReadTool(),
    new FileWriteTool(),
    new ShellTool(),
  ]);

  // 2. 创建 Provider
  const provider = new MimoProvider({
    type: 'mimo',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic',
    model: 'mimo-v2.5',
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
    timeout: 120000,
  });

  // 3. 验证配置
  console.log('🔑 验证 API Key...');
  const isValid = await provider.validate();
  if (!isValid) {
    console.error('❌ API Key 无效。请设置 ANTHROPIC_AUTH_TOKEN 环境变量。');
    process.exit(1);
  }
  console.log('✅ API Key 验证通过\n');

  // 4. 创建 Agent
  const agent = new Agent(provider, {
    maxIterations: 10,
    systemPrompt: `你是归藏 (Guicang)，一个强大的 AI 助手。
万物归藏，一念即达。

你可以使用以下工具：
- file_read: 读取文件内容
- file_write: 写入文件内容
- shell: 执行 shell 命令

请用中文回复用户。`,
  });

  // 5. 创建 CLI 渠道并启动
  const channel = new CLIChannel({ name: 'cli' });
  channel.setAgent(agent);

  console.log('🚀 启动 CLI 渠道...\n');
  await channel.start();
}

main().catch((error) => {
  console.error('❌ 启动失败:', error);
  process.exit(1);
});
