/**
 * 命令历史和撤销系统
 * 操作历史记录和回滚
 */

import { Logger } from '../core/logger.js';

const logger = new Logger('history');

/** 历史条目 */
export interface HistoryEntry {
  id: string;
  command: string;
  args: unknown;
  result?: unknown;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed' | 'undone';
  undoData?: unknown;
}

/**
 * 命令历史管理器
 */
export class CommandHistory {
  private history: HistoryEntry[] = [];
  private maxHistory: number;
  private undoStack: HistoryEntry[] = [];

  constructor(maxHistory = 100) {
    this.maxHistory = maxHistory;
  }

  /**
   * 添加历史记录
   */
  add(command: string, args: unknown, undoData?: unknown): HistoryEntry {
    const entry: HistoryEntry = {
      id: this.generateId(),
      command,
      args,
      timestamp: new Date(),
      status: 'pending',
      undoData,
    };

    this.history.push(entry);

    // 限制历史大小
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    logger.debug(`History added: ${command}`);
    return entry;
  }

  /**
   * 完成命令
   */
  complete(id: string, result: unknown): void {
    const entry = this.history.find((e) => e.id === id);
    if (entry) {
      entry.status = 'completed';
      entry.result = result;
    }
  }

  /**
   * 标记失败
   */
  fail(id: string, error: unknown): void {
    const entry = this.history.find((e) => e.id === id);
    if (entry) {
      entry.status = 'failed';
      entry.result = { error };
    }
  }

  /**
   * 撤销最后一条命令
   */
  undoLast(): HistoryEntry | null {
    const lastCompleted = [...this.history]
      .reverse()
      .find((e) => e.status === 'completed');

    if (!lastCompleted) {
      return null;
    }

    lastCompleted.status = 'undone';
    this.undoStack.push(lastCompleted);

    logger.info(`Undone: ${lastCompleted.command}`);
    return lastCompleted;
  }

  /**
   * 重做最后撤销的命令
   */
  redoLast(): HistoryEntry | null {
    const lastUndone = this.undoStack.pop();
    if (!lastUndone) {
      return null;
    }

    lastUndone.status = 'completed';
    logger.info(`Redone: ${lastUndone.command}`);
    return lastUndone;
  }

  /**
   * 获取历史记录
   */
  getHistory(limit = 50): HistoryEntry[] {
    return this.history.slice(-limit);
  }

  /**
   * 按命令过滤
   */
  getByCommand(command: string): HistoryEntry[] {
    return this.history.filter((e) => e.command === command);
  }

  /**
   * 获取最近的命令
   */
  getRecentCommands(limit = 10): string[] {
    const seen = new Set<string>();
    const commands: string[] = [];

    for (let i = this.history.length - 1; i >= 0 && commands.length < limit; i--) {
      const cmd = this.history[i].command;
      if (!seen.has(cmd)) {
        seen.add(cmd);
        commands.push(cmd);
      }
    }

    return commands;
  }

  /**
   * 获取命令统计
   */
  getStats(): {
    total: number;
    completed: number;
    failed: number;
    undone: number;
    uniqueCommands: number;
  } {
    const completed = this.history.filter((e) => e.status === 'completed').length;
    const failed = this.history.filter((e) => e.status === 'failed').length;
    const undone = this.history.filter((e) => e.status === 'undone').length;
    const uniqueCommands = new Set(this.history.map((e) => e.command)).size;

    return {
      total: this.history.length,
      completed,
      failed,
      undone,
      uniqueCommands,
    };
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.history = [];
    this.undoStack = [];
  }

  /**
   * 搜索历史
   */
  search(query: string): HistoryEntry[] {
    const lower = query.toLowerCase();
    return this.history.filter(
      (e) =>
        e.command.toLowerCase().includes(lower) ||
        JSON.stringify(e.args).toLowerCase().includes(lower),
    );
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2, 15);
  }
}

/** 全局命令历史 */
export const commandHistory = new CommandHistory();
