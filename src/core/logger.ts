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

/** 日志输出函数类型 */
export type LogOutputFn = (level: LogLevel, entry: LogEntry) => void;

/** 全局日志输出函数（可被 TUI 等覆盖） */
let globalOutputFn: LogOutputFn | null = null;

/** 设置全局日志输出函数 */
export function setLogOutput(fn: LogOutputFn | null): void {
  globalOutputFn = fn;
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

  private format(level: LogLevel, message: string, data?: unknown): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      module: this.module,
    };
    if (data !== undefined) entry.data = data;
    return entry;
  }

  private output(level: LogLevel, entry: LogEntry): void {
    if (globalOutputFn) {
      // 使用自定义输出（TUI 模式）
      globalOutputFn(level, entry);
    } else {
      // 默认输出到 console
      const json = JSON.stringify(entry);
      switch (level) {
        case 'debug':
          console.debug(json);
          break;
        case 'info':
          console.info(json);
          break;
        case 'warn':
          console.warn(json);
          break;
        case 'error':
          console.error(json);
          break;
      }
    }
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      this.output('debug', this.format('debug', message, data));
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      this.output('info', this.format('info', message, data));
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      this.output('warn', this.format('warn', message, data));
    }
  }

  error(message: string, data?: unknown): void {
    if (this.shouldLog('error')) {
      this.output('error', this.format('error', message, data));
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
