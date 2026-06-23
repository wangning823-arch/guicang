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
export { darkTokens, lightTokens } from './theme/tokens.js';
export type { DesignTokens, ThemeName } from './theme/index.js';
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

// 管理器
export { LayoutManager, SessionManager, SearchManager, ClipboardManager, KeybindingManager } from './managers/index.js';
export type { PanelConfig, LayoutConfig } from './managers/layout.js';
export type { Session, SessionInfo } from './managers/session.js';
export type { SearchScope, SearchResult, LogFilter, ToolFilter } from './managers/search.js';
export type { Action, KeyBinding, KeybindingPreset } from './managers/keybinding.js';

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

export { ToolsPanel } from './panels/tools.js';
export type { ToolCallEntry } from './panels/tools.js';

export { LogsPanel } from './panels/logs.js';
export type { LogEntry } from './panels/logs.js';

export { HelpPanel } from './panels/help.js';

export { TUIApp } from './app.js';
export type { TUIAppOptions } from './app.js';
