# 归藏 (Guicang) 开发路线图

## 已完成
- [x] P0: 项目骨架 — TypeScript 项目初始化、基础配置、测试框架
- [x] P1: Provider 抽象 — 统一的 LLM 调用接口，支持 OpenAI 和 Anthropic
- [x] P2: 工具系统 — 工具注册、调用、结果处理的完整 pipeline
- [x] P3: Agent 循环 — 核心的 ReAct 循环（思考→行动→观察）
- [x] P4: 记忆系统 — 短期记忆 + 长期记忆（持久化）
- [x] P5: 渠道接入 — CLI 和 HTTP API 渠道适配
- [x] P6: 技能系统 — 可组合的技能定义和加载机制
- [x] P7: 安全沙箱 — 工具执行的隔离和权限控制
- [x] P8: 心跳与定时 — 周期性任务和主动检查机制
- [x] P9: 多 Agent 协作 — 子 agent 生成和任务分发
- [x] P10: ESLint 集成 — 代码静态分析和风格统一
- [x] P11: GitHub Actions CI/CD — 自动化测试和构建
- [x] P12: 配置文件热重载 — 支持配置变更自动重新加载
- [x] P13: API 文档和使用示例 — 完整的 API 文档和示例代码
- [x] P14: 性能优化和压测 — 计时器、内存监控、性能基准测试
- [x] P15: 更多 Provider — Ollama、Google Gemini、Azure OpenAI
- [x] P16: WebSocket 渠道 — 实时双向通信支持
- [x] P17: 插件系统 — 动态加载和管理插件

## 后续优化
- [ ] P18: Web UI 界面
- [ ] P19: 流式输出支持
- [ ] P20: 语音输入/输出
- [ ] P21: 多模态支持（图片、音频）
- [ ] P22: 分布式 Agent 运行
