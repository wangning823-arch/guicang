/**
 * Guicang TUI 入口
 * 终端用户界面
 */

export { TUIEngine } from './engine.js';
export type { KeyEvent, RenderContext, Rect, Position } from './engine.js';

// 主题系统（旧版兼容）
export { Colors, Theme, colorize, bold, dim, withBg } from './theme.js';

// 新版主题系统
export { ThemeManager, defaultThemeManager } from './theme/index.js';
export type { ThemeName } from './theme/index.js';
export { darkTokens, lightTokens } from './theme/tokens.js';
export { monokaiTokens } from './theme/monokai.js';
export { nordTokens } from './theme/nord.js';
export { draculaTokens } from './theme/dracula.js';
export { solarizedTokens } from './theme/solarized.js';
export type { DesignTokens } from './theme/tokens.js';
export { FG, BG, STYLE, RESET, Palette256, fg256, bg256, fgRGB, bgRGB } from './theme/colors.js';

export { getCharWidth, getStringWidth, truncateString } from './utils.js';

export { Box } from './components/box.js';
export { ProgressBar, StatusIndicator, Sparkline } from './components/progress.js';
export { StatusBar } from './components/statusbar.js';
export type { StatusBarOptions, StatusBarItem } from './components/statusbar.js';

export { MarkdownRenderer } from './components/markdown.js';
export type { RenderedBlock, MarkdownRendererOptions } from './components/markdown.js';

export { CodeBlock } from './components/codeblock.js';
export type { CodeBlockOptions } from './components/codeblock.js';

export { WelcomeWizard } from './components/wizard.js';
export type { WizardStep, WizardOption, WizardResult, WizardOptions } from './components/wizard.js';

export { ContextHelp, DEFAULT_HELP_TIPS } from './components/context-help.js';
export type { HelpTip, ContextHelpOptions } from './components/context-help.js';

// 管理器
export { LayoutManager, SessionManager, SearchManager, ClipboardManager, KeybindingManager } from './managers/index.js';
export { AnimationManager, createLoadingSpinner } from './managers/animation.js';
export { BookmarkManager } from './managers/bookmark.js';
export type { PanelConfig, LayoutConfig } from './managers/layout.js';
export type { Session, SessionInfo } from './managers/session.js';
export type { SearchScope, SearchResult, LogFilter, ToolFilter } from './managers/search.js';
export type { Action, KeyBinding, KeybindingPreset } from './managers/keybinding.js';
export type { AnimationType } from './managers/animation.js';
export type { Bookmark } from './managers/bookmark.js';

// 工具
export { ObjectPool, StringCache, DirtyRegionTracker, PerformanceTimer, FrameRateMonitor, MemoryMonitor } from './utils/optimizer.js';
export { VirtualScroll, ScrollIndicator, ScrollHandler } from './utils/virtual-scroll.js';

export { ChatPanel } from './panels/chat.js';
export type { ChatMessage, ChatPanelOptions } from './panels/chat.js';

export { StatusPanel } from './panels/status.js';
export type { StatusPanelData } from './panels/status.js';

export { MetricsPanel } from './panels/metrics.js';
export type { MetricsPanelData } from './panels/metrics.js';

export { TokensPanel } from './panels/tokens.js';
export type { TokenUsageData, TokensPanelOptions } from './panels/tokens.js';

export { AgentsPanel } from './panels/agents.js';
export type { AgentInfo } from './panels/agents.js';

export { OrchestratorPanel } from './panels/agents-orchestrator.js';
export type { OrchestratorTask, OrchestratorPanelOptions } from './panels/agents-orchestrator.js';

export { HistoryPanel } from './panels/history.js';
export type { HistoryPanelOptions } from './panels/history.js';

export { ConfigPanel } from './panels/config.js';
export type { ConfigItem, ConfigPanelOptions } from './panels/config.js';

export { ToolsPanel } from './panels/tools.js';
export type { ToolCallEntry } from './panels/tools.js';

export { LogsPanel } from './panels/logs.js';
export type { LogEntry } from './panels/logs.js';

export { HelpPanel } from './panels/help.js';

// 插件系统
export { PluginManager, themeSwitcherPlugin, devToolsPlugin } from './plugin/index.js';
export type { TUIPlugin, PluginContext, PluginInfo } from './plugin/index.js';

export { TUIApp } from './app.js';
export type { TUIAppOptions } from './app.js';
