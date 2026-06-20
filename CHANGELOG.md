# Changelog

## [1.3.0] - 2026-06-20

### Added
- TUI 终端用户界面
  - 输入历史支持（Up/Down 浏览）
  - 面板焦点切换（Tab 键）
  - 命令解析（/help, /clear, /status, /config, /history, /quit）
  - 退出确认对话框
  - 粘贴缓冲支持（Bracketed Paste）
  - 水平滚动（光标超出可视区域时自动滚动）
  - 焦点指示器
  - 6 个面板（status, metrics, tokens, agents, tools, logs）

### Fixed
- 修复测试文件 ESLint 错误
- 移除未使用的导入和变量

### Changed
- 调整面板最小高度（6行）
- 优化面板宽度分配

## [1.2.0] - 2026-06-19

### Added
- Mimo Provider（支持 mimo-v2.5 模型）
- Mimo 配置文件（guicang.toml）
- Mimo 对话示例（examples/mimo-chat.ts）

## [1.1.0] - 2026-06-19

### Added
- ESLint 集成（typescript-eslint）
- GitHub Actions CI/CD（自动测试、构建、发布）
- 配置文件热重载（ConfigHotReload）
- API 文档（docs/API.md）
- 使用示例（examples/）
  - 基础对话示例
  - HTTP API 服务器示例
  - 多 Agent 协作示例

### Changed
- 更新 package.json 脚本（lint、typecheck、check）
- 添加 .gitignore

## [1.0.0] - 2026-06-19

### Added
- 多 Agent 协作系统（Orchestrator 编排器）
- Agent 角色注册和任务分发
- 并发任务执行（带并发控制）
- 流水线执行模式
- 心跳与定时系统（Scheduler）
- 定时任务管理（注册、执行、取消）
- 任务执行次数限制
- 安全沙箱（ProcessSandbox）
- 权限检查和路径阻止
- 域名白名单
- 技能系统（BaseSkill 基类、技能注册中心）
- 内置技能：code-review、summarize
- 技能自动初始化和清理
- 渠道系统（CLI + HTTP API）
- CLI 交互式对话
- HTTP REST API（/health, /chat）
- 记忆系统（短期 + 长期记忆）
- 短期记忆（内存有界存储，FIFO 淘汰）
- 长期记忆（文件持久化）
- 记忆查询（关键词、时间范围、排序）
- Agent 核心循环（ReAct 模式）
- 多轮工具调用支持
- Token 使用量追踪
- 工具系统（工具注册中心 + 内置工具）
- 内置工具：file_read、file_write、shell
- Provider 抽象层（OpenAI + Anthropic）
- 配置系统（TOML 解析、环境变量覆盖）
- 结构化日志模块
- TypeScript strict 模式配置

## [0.1.0] - 2026-06-19

### Added
- 项目骨架初始化
- 核心类型定义
