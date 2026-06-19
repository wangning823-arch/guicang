# 归藏 API 文档

## 核心模块 (Core)

### Agent

Agent 是归藏的核心，实现了 ReAct 循环（思考→行动→观察）。

```typescript
import { Agent, OpenAIProvider, registerTool, FileReadTool } from 'guicang';

// 注册工具
registerTool(new FileReadTool());

// 创建 provider
const provider = new OpenAIProvider({
  type: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
});

// 创建 agent
const agent = new Agent(provider, {
  maxIterations: 10,
  systemPrompt: 'You are a helpful assistant.',
});

// 运行 agent
const result = await agent.run('Read the file src/index.ts');
console.log(result.messages);
console.log(result.toolCalls);
console.log(result.totalUsage);
```

### AgentOptions

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| maxIterations | number | 10 | 最大循环次数 |
| iterationTimeout | number | 60000 | 单次循环超时（毫秒） |
| systemPrompt | string | - | 系统提示词 |
| toolContext | Partial<ToolContext> | - | 工具执行上下文 |
| providerOptions | ProviderOptions | - | Provider 选项 |

---

## Provider 模块

### OpenAIProvider

```typescript
import { OpenAIProvider } from 'guicang';

const provider = new OpenAIProvider({
  type: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  apiKey: 'sk-xxx', // 或设置 OPENAI_API_KEY 环境变量
  timeout: 60000,
  maxRetries: 3,
});

const response = await provider.chat([
  { role: 'user', content: 'Hello' },
]);
```

### AnthropicProvider

```typescript
import { AnthropicProvider } from 'guicang';

const provider = new AnthropicProvider({
  type: 'anthropic',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-sonnet-4-20250514',
  apiKey: 'sk-ant-xxx', // 或设置 ANTHROPIC_API_KEY 环境变量
});
```

### 自定义 Provider

```typescript
import { BaseProvider, registerProvider } from 'guicang';

class MyProvider extends BaseProvider {
  get type(): string { return 'my-provider'; }

  async chat(messages, tools, options) {
    // 实现你的 LLM 调用逻辑
  }

  async validate(): Promise<boolean> {
    return true;
  }
}

registerProvider('my-provider', MyProvider);
```

---

## Tool 模块

### 内置工具

```typescript
import { registerTools, FileReadTool, FileWriteTool, ShellTool } from 'guicang';

// 注册所有内置工具
registerTools([
  new FileReadTool(),
  new FileWriteTool(),
  new ShellTool(),
]);
```

### 自定义工具

```typescript
import { BaseTool, registerTool } from 'guicang';

class WeatherTool extends BaseTool {
  definition = {
    name: 'weather',
    description: 'Get weather for a city',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name' },
      },
      required: ['city'],
    },
  };

  async execute(args, context) {
    const city = args.city as string;
    // 调用天气 API
    const weather = await fetchWeather(city);
    return this.success(`Weather in ${city}: ${weather}`, args._toolCallId as string);
  }
}

registerTool(new WeatherTool());
```

---

## Memory 模块

### 短期记忆

```typescript
import { ShortTermMemory } from 'guicang';

const memory = new ShortTermMemory(100); // 最多 100 条

await memory.add({
  content: 'User prefers dark mode',
  metadata: { source: 'conversation' },
});

const results = await memory.query({ keyword: 'dark mode' });
```

### 长期记忆

```typescript
import { LongTermMemory } from 'guicang';

const memory = new LongTermMemory('./data/memory.json');

await memory.add({
  content: 'Important fact',
  metadata: { tags: ['fact', 'important'] },
});

// 持久化到文件
const results = await memory.query({ sortBy: 'recency' });
```

---

## Channel 模块

### CLI 渠道

```typescript
import { CLIChannel, Agent } from 'guicang';

const channel = new CLIChannel();
channel.setAgent(agent);
await channel.start();
```

### HTTP API 渠道

```typescript
import { HTTPChannel, Agent } from 'guicang';

const channel = new HTTPChannel({ port: 8080 });
channel.setAgent(agent);
await channel.start();

// API 端点：
// POST /chat - { "message": "Hello" }
// GET /health - { "status": "ok" }
```

---

## Skill 模块

```typescript
import { BaseSkill, registerSkill } from 'guicang';

class MySkill extends BaseSkill {
  constructor() {
    super({
      name: 'my-skill',
      description: 'My custom skill',
      tags: ['custom'],
    });
  }

  async execute(context) {
    return { success: true, output: 'Skill executed' };
  }
}

registerSkill(new MySkill());
```

---

## Sandbox 模块

```typescript
import { ProcessSandbox } from 'guicang';

const sandbox = new ProcessSandbox({
  allowedPermissions: ['file:read', 'shell:execute'],
  blockedPaths: ['/etc', '/proc'],
  commandTimeout: 5000,
});

// 检查权限
const check = sandbox.checkPermission('file:read', 'src/index.ts');
if (check.allowed) {
  await sandbox.execute('cat src/index.ts');
}
```

---

## Scheduler 模块

```typescript
import { Scheduler } from 'guicang';

const scheduler = new Scheduler();

// 每 5 分钟执行一次
scheduler.schedule(
  {
    name: 'cleanup',
    intervalMs: 5 * 60 * 1000,
    runImmediately: true,
  },
  async () => {
    console.log('Running cleanup...');
  },
);

// 停止所有任务
scheduler.stopAll();
```

---

## Collaboration 模块

```typescript
import { Orchestrator, Agent, OpenAIProvider } from 'guicang';

const orchestrator = new Orchestrator();

// 注册角色
orchestrator.registerRole({
  id: 'researcher',
  name: 'Researcher',
  description: 'Finds information',
  agent: new Agent(new OpenAIProvider({ ... })),
});

orchestrator.registerRole({
  id: 'writer',
  name: 'Writer',
  description: 'Writes content',
  agent: new Agent(new OpenAIProvider({ ... })),
});

// 创建并执行任务
const task = orchestrator.createTask('Research topic', 'AI agents');
orchestrator.assignTask(task, 'researcher');
await orchestrator.executeTask(task);

// 并发执行
const result = await orchestrator.executeTasks([task1, task2, task3]);
```

---

## 配置

### guicang.toml

```toml
name = "my-project"
logLevel = "info"
defaultProvider = "openai"

[[providers]]
type = "openai"
baseUrl = "https://api.openai.com/v1"
model = "gpt-4o"
timeout = 60000

[tools]
enabled = ["file_read", "file_write", "shell"]
executionTimeout = 30000
maxConcurrency = 5

[[channels]]
type = "cli"

[[channels]]
type = "http"
port = 8080

[memory]
shortTermLimit = 100
longTermPath = "./data/memory"
```

### 热重载

```typescript
import { createHotReload } from 'guicang';

const hotReload = createHotReload({
  configPath: './guicang.toml',
  debounceMs: 300,
  onChange: (newConfig, oldConfig) => {
    console.log('Config changed:', newConfig);
  },
});

await hotReload.start();
```
