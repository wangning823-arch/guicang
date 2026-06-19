/**
 * 结构化日志模块
 * 支持级别过滤和结构化输出
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  module?: string;
  data?: unknown;
}

export class Logger {
  private minLevel: LogLevel;

  constructor(
    private module: string,
    minLevel: LogLevel = 'info',
  ) {
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel];
  }

  private format(level: LogLevel, message: string, data?: unknown): string {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      module: this.module,
    };
    if (data !== undefined) entry.data = data;
    return JSON.stringify(entry);
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      console.debug(this.format('debug', message, data));
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      console.info(this.format('info', message, data));
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message, data));
    }
  }

  error(message: string, data?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(this.format('error', message, data));
    }
  }

  /** 创建子 logger */
  child(subModule: string): Logger {
    return new Logger(`${this.module}:${subModule}`, this.minLevel);
  }

  /** 设置日志级别 */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

/** 全局 logger 实例 */
export const logger = new Logger('guicang');
