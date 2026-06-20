/**
 * Guicang TUI 入口
 * 终端用户界面
 */

export { TUIEngine } from './engine.js';
export type { KeyEvent, RenderContext, Rect, Position } from './engine.js';

export { Colors, Theme, colorize, bold, dim, withBg } from './theme.js';

export { Box } from './components/box.js';
export { ProgressBar, StatusIndicator, Sparkline } from './components/progress.js';

export { ChatPanel } from './panels/chat.js';
export type { ChatMessage, ChatPanelOptions } from './panels/chat.js';

export { StatusPanel } from './panels/status.js';
export type { StatusPanelData } from './panels/status.js';

export { MetricsPanel } from './panels/metrics.js';
export type { MetricsPanelData } from './panels/metrics.js';

export { ToolsPanel } from './panels/tools.js';
export type { ToolCallEntry } from './panels/tools.js';

export { LogsPanel } from './panels/logs.js';
export type { LogEntry } from './panels/logs.js';
