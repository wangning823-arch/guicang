# 归藏 (Guicang)

万物归藏，一念即达。

一个自托管、模型无关的通用 AI Agent 框架。支持多渠道接入、工具调用和自动化工作流。

## ✨ 特性

- **模型无关** — 统一的 Provider 抽象层，支持 OpenAI、Anthropic、Mimo v2.5
- **工具系统** — 可扩展的工具注册和调用机制
- **Agent 循环** — 基于 ReAct 模式的思考-行动-观察循环
- **记忆系统** — 短期记忆 + 长期记忆持久化
- **多渠道** — CLI、HTTP API 等接入方式
- **技能系统** — 可组合的技能定义和加载
- **安全沙箱** — 工具执行的权限控制和隔离
- **定时任务** — 周期性任务和主动检查
- **多 Agent 协作** — 子 agent 生成和任务分发

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 运行测试
npm test

# 类型检查
npm run lint

# 构建
npm run build
```

## 📁 项目结构

```
guicang/
├── src/
│   ├── core/           # 核心引擎（Agent 循环、类型定义、日志）
│   ├── provider/       # LLM Provider 抽象层（OpenAI、Anthropic）
│   ├── tool/           # 工具系统（注册、调用、内置工具）
│   ├── memory/         # 记忆系统（短期 + 长期）
│   ├── channel/        # 消息渠道（CLI、HTTP API）
│   ├── skill/          # 技能系统（可组合的能力单元）
│   ├── sandbox/        # 安全沙箱（权限控制、路径阻止）
│   ├── scheduler/      # 定时任务（心跳、周期性任务）
│   ├── collaboration/  # 多 Agent 协作（编排、任务分发）
│   └── config/         # 配置管理（TOML 解析）
├── tests/              # 测试
├── docs/               # 文档
├── examples/           # 示例配置
└── TODO.md             # 开发路线图
```

## ⚙️ 配置

项目根目录已包含 `guicang.toml` 配置文件（使用 Mimo v2.5）：

```toml
name = "guicang"
logLevel = "info"
defaultProvider = "mimo"

[[providers]]
type = "mimo"
baseUrl = "https://token-plan-cn.xiaomimimo.com/anthropic"
model = "mimo-v2.5"
timeout = 120000
```

环境变量：
- `ANTHROPIC_AUTH_TOKEN` — Mimo API 密钥
- `OPENAI_API_KEY` — OpenAI API 密钥（可选）
- `ANTHROPIC_API_KEY` — Anthropic API 密钥（可选）

## 🧪 测试

```bash
# 运行所有测试
npm test

# 查看测试覆盖率
npm run test:coverage

# 监听模式
npm run test:watch
```

## 📦 模块

### Provider（L1）
统一的 LLM 调用接口，支持 OpenAI 和 Anthropic，可扩展自定义 Provider。

### Tool（L2）
工具注册中心 + 内置工具（file_read、file_write、shell），支持参数验证和错误处理。

### Agent（L3）
核心 ReAct 循环，支持多轮工具调用、token 追踪、最大迭代限制。

### Memory（L4）
短期记忆（内存有界）+ 长期记忆（文件持久化），支持关键词查询。

### Channel（L5）
CLI 交互式对话 + HTTP REST API，支持健康检查和聊天接口。

### Skill（L6）
可组合的技能单元，支持自动初始化、依赖管理和内置技能。

### Sandbox（L7）
进程级安全沙箱，支持权限检查、路径阻止、域名白名单。

### Scheduler（L8）
定时任务管理，支持周期性执行、最大次数限制、任务取消。

### Collaboration（L9）
多 Agent 编排器，支持角色注册、任务分发、并发执行、流水线模式。

## 📝 开发路线

见 [TODO.md](./TODO.md)

## 📄 License

MIT
