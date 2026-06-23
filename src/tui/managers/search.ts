/**
 * 搜索管理器
 * 全局搜索和过滤功能
 */

import { LogEntry } from '../panels/logs.js';
import { ToolCallEntry } from '../panels/tools.js';
import { AgentInfo } from '../panels/agents.js';
import { ChatMessage } from '../panels/chat.js';

/** 搜索范围 */
export type SearchScope = 'all' | 'chat' | 'logs' | 'tools' | 'agents';

/** 搜索结果项 */
export interface SearchResult {
  type: 'chat' | 'log' | 'tool' | 'agent';
  id: string;
  content: string;
  highlight?: string;
  metadata?: Record<string, any>;
}

/** 日志过滤选项 */
export interface LogFilter {
  levels?: string[];
  modules?: string[];
  startTime?: Date;
  endTime?: Date;
}

/** 工具过滤选项 */
export interface ToolFilter {
  status?: 'success' | 'failed' | 'all';
  name?: string;
}

/** 搜索管理器 */
export class SearchManager {
  private chatMessages: ChatMessage[] = [];
  private logEntries: LogEntry[] = [];
  private toolCalls: ToolCallEntry[] = [];
  private agents: AgentInfo[] = [];
  private listeners: Array<() => void> = [];

  constructor() {}

  /** 更新数据源 */
  updateChatMessages(messages: ChatMessage[]): void {
    this.chatMessages = messages;
  }

  updateLogEntries(entries: LogEntry[]): void {
    this.logEntries = entries;
  }

  updateToolCalls(calls: ToolCallEntry[]): void {
    this.toolCalls = calls;
  }

  updateAgents(agents: AgentInfo[]): void {
    this.agents = agents;
  }

  /** 全局搜索 */
  search(query: string, scope: SearchScope = 'all'): SearchResult[] {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    if (scope === 'all' || scope === 'chat') {
      results.push(...this.searchChat(lowerQuery));
    }

    if (scope === 'all' || scope === 'logs') {
      results.push(...this.searchLogs(lowerQuery));
    }

    if (scope === 'all' || scope === 'tools') {
      results.push(...this.searchTools(lowerQuery));
    }

    if (scope === 'all' || scope === 'agents') {
      results.push(...this.searchAgents(lowerQuery));
    }

    return results;
  }

  /** 搜索聊天消息 */
  private searchChat(query: string): SearchResult[] {
    return this.chatMessages
      .filter(msg => msg.content.toLowerCase().includes(query))
      .map((msg, index) => ({
        type: 'chat' as const,
        id: `chat_${index}`,
        content: msg.content,
        highlight: this.extractHighlight(msg.content, query),
        metadata: { role: msg.role, timestamp: msg.timestamp },
      }));
  }

  /** 搜索日志 */
  private searchLogs(query: string): SearchResult[] {
    return this.logEntries
      .filter(log => log.message.toLowerCase().includes(query))
      .map((log, index) => ({
        type: 'log' as const,
        id: `log_${index}`,
        content: log.message,
        highlight: this.extractHighlight(log.message, query),
        metadata: { level: log.level, module: log.module, timestamp: log.timestamp },
      }));
  }

  /** 搜索工具调用 */
  private searchTools(query: string): SearchResult[] {
    return this.toolCalls
      .filter(tool => tool.name.toLowerCase().includes(query) || tool.status.toLowerCase().includes(query))
      .map((tool, index) => ({
        type: 'tool' as const,
        id: `tool_${index}`,
        content: `${tool.name} - ${tool.status}`,
        metadata: { name: tool.name, status: tool.status, duration: tool.duration },
      }));
  }

  /** 搜索 Agent */
  private searchAgents(query: string): SearchResult[] {
    return this.agents
      .filter(agent => agent.name.toLowerCase().includes(query) || agent.status.toLowerCase().includes(query))
      .map((agent, index) => ({
        type: 'agent' as const,
        id: `agent_${index}`,
        content: `${agent.name} - ${agent.status}`,
        metadata: { name: agent.name, status: agent.status },
      }));
  }

  /** 提取高亮片段 */
  private extractHighlight(text: string, query: string): string {
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(query);
    if (index === -1) return text;

    const start = Math.max(0, index - 20);
    const end = Math.min(text.length, index + query.length + 20);
    let highlight = text.slice(start, end);

    if (start > 0) highlight = '...' + highlight;
    if (end < text.length) highlight = highlight + '...';

    return highlight;
  }

  /** 过滤日志 */
  filterLogs(filter: LogFilter): LogEntry[] {
    return this.logEntries.filter(log => {
      if (filter.levels && filter.levels.length > 0) {
        if (!filter.levels.includes(log.level)) {
          return false;
        }
      }

      if (filter.modules && filter.modules.length > 0) {
        if (!filter.modules.includes(log.module)) {
          return false;
        }
      }

      if (filter.startTime && log.timestamp < filter.startTime) {
        return false;
      }

      if (filter.endTime && log.timestamp > filter.endTime) {
        return false;
      }

      return true;
    });
  }

  /** 过滤工具调用 */
  filterTools(filter: ToolFilter): ToolCallEntry[] {
    return this.toolCalls.filter(tool => {
      if (filter.status && filter.status !== 'all') {
        if (tool.status !== filter.status) {
          return false;
        }
      }

      if (filter.name && !tool.name.toLowerCase().includes(filter.name.toLowerCase())) {
        return false;
      }

      return true;
    });
  }

  /** 过滤 Agent */
  filterAgents(status?: string): AgentInfo[] {
    if (!status) {
      return this.agents;
    }
    return this.agents.filter(agent => agent.status === status);
  }

  /** 监听数据变化 */
  onDataChange(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
}
