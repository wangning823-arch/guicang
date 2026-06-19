/**
 * HTTP API 示例
 * 展示如何使用 HTTP 渠道提供 API 服务
 */

import {
  Agent,
  OpenAIProvider,
  HTTPChannel,
  registerTools,
  FileReadTool,
  FileWriteTool,
} from '../../src/index.js';

async function main() {
  // 注册工具
  registerTools([new FileReadTool(), new FileWriteTool()]);

  // 创建 Agent
  const provider = new OpenAIProvider({
    type: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = new Agent(provider);

  // 创建 HTTP 渠道
  const channel = new HTTPChannel({
    port: parseInt(process.env.PORT ?? '8080'),
    host: '0.0.0.0',
  });

  channel.setAgent(agent);

  // 启动服务
  await channel.start();

  console.log('🚀 HTTP API Server started');
  console.log('   POST /chat - Send a message');
  console.log('   GET /health - Health check');
  console.log('\n   Test with:');
  console.log('   curl -X POST http://localhost:8080/chat \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"message": "Hello!"}\'');
}

main().catch(console.error);
