/**
 * 安全审计
 * 工具调用权限检查、敏感操作确认
 */

import { Logger } from '../core/logger.js';

const logger = new Logger('security:audit');

/** 权限级别 */
export type PermissionLevel = 'low' | 'medium' | 'high' | 'critical';

/** 安全策略 */
export interface SecurityPolicy {
  /** 需要确认的工具 */
  requireConfirmation: string[];
  /** 禁止的工具 */
  blockedTools: string[];
  /** 权限级别映射 */
  toolPermissions: Record<string, PermissionLevel>;
  /** 最大并发执行数 */
  maxConcurrent: number;
  /** 是否启用沙箱 */
  sandboxEnabled: boolean;
}

/** 审计日志条目 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  tool: string;
  args: unknown;
  agent: string;
  allowed: boolean;
  reason: string;
  duration?: number;
}

/** 安全检查结果 */
export interface SecurityCheckResult {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason: string;
  riskLevel: PermissionLevel;
}

/**
 * 安全审计器
 */
export class SecurityAuditor {
  private policy: SecurityPolicy;
  private auditLog: AuditLogEntry[] = [];
  private runningExecutions = 0;

  constructor(policy?: Partial<SecurityPolicy>) {
    this.policy = {
      requireConfirmation: [
        'file_write',
        'file_delete',
        'shell',
        'network_request',
        'database_write',
      ],
      blockedTools: [
        'sudo',
        'rm_rf',
        'format_disk',
      ],
      toolPermissions: {
        file_read: 'low',
        file_write: 'medium',
        file_delete: 'high',
        shell: 'high',
        network_request: 'medium',
        database_read: 'low',
        database_write: 'high',
        code_execute: 'critical',
      },
      maxConcurrent: 5,
      sandboxEnabled: true,
      ...policy,
    };
  }

  /**
   * 检查工具调用权限
   */
  checkToolPermission(tool: string, args: unknown): SecurityCheckResult {
    // 检查是否被禁止
    if (this.policy.blockedTools.includes(tool)) {
      return {
        allowed: false,
        requiresConfirmation: false,
        reason: `Tool "${tool}" is blocked by security policy`,
        riskLevel: 'critical',
      };
    }

    // 检查并发限制
    if (this.runningExecutions >= this.policy.maxConcurrent) {
      return {
        allowed: false,
        requiresConfirmation: false,
        reason: 'Maximum concurrent executions reached',
        riskLevel: 'medium',
      };
    }

    // 检查权限级别
    const permission = this.policy.toolPermissions[tool] ?? 'medium';
    const requiresConfirmation = this.policy.requireConfirmation.includes(tool);

    // 检查敏感参数
    const sensitiveCheck = this.checkSensitiveArgs(tool, args);
    if (!sensitiveCheck.allowed) {
      return sensitiveCheck;
    }

    return {
      allowed: true,
      requiresConfirmation: requiresConfirmation || sensitiveCheck.requiresConfirmation,
      reason: sensitiveCheck.reason !== 'OK' ? sensitiveCheck.reason : 'OK',
      riskLevel: permission,
    };
  }

  /**
   * 记录审计日志
   */
  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    this.auditLog.push({
      ...entry,
      id: this.generateId(),
      timestamp: new Date(),
    });

    if (!entry.allowed) {
      logger.warn(`Security violation: ${entry.tool} - ${entry.reason}`);
    }
  }

  /**
   * 开始执行（增加计数）
   */
  startExecution(): void {
    this.runningExecutions++;
  }

  /**
   * 结束执行（减少计数）
   */
  endExecution(): void {
    this.runningExecutions = Math.max(0, this.runningExecutions - 1);
  }

  /**
   * 获取审计日志
   */
  getAuditLog(limit = 100): AuditLogEntry[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * 获取安全统计
   */
  getStats(): {
    totalChecks: number;
    allowed: number;
    denied: number;
    confirmationsRequired: number;
    runningExecutions: number;
  } {
    const total = this.auditLog.length;
    const allowed = this.auditLog.filter((e) => e.allowed).length;
    const denied = total - allowed;
    const confirmationsRequired = this.auditLog.filter(
      (e) => e.allowed && e.reason === 'confirmation_required',
    ).length;

    return {
      totalChecks: total,
      allowed,
      denied,
      confirmationsRequired,
      runningExecutions: this.runningExecutions,
    };
  }

  /**
   * 更新策略
   */
  updatePolicy(policy: Partial<SecurityPolicy>): void {
    this.policy = { ...this.policy, ...policy };
    logger.info('Security policy updated');
  }

  /**
   * 获取当前策略
   */
  getPolicy(): SecurityPolicy {
    return { ...this.policy };
  }

  /**
   * 清空审计日志
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * 检查敏感参数
   */
  private checkSensitiveArgs(tool: string, args: unknown): SecurityCheckResult {
    if (typeof args !== 'object' || args === null) {
      return { allowed: true, requiresConfirmation: false, reason: 'OK', riskLevel: 'low' };
    }

    const argsObj = args as Record<string, unknown>;

    // 检查 shell 命令
    if (tool === 'shell' && typeof argsObj.command === 'string') {
      const cmd = argsObj.command as string;
      const dangerousPatterns = [
        /rm\s+-rf/,
        /sudo/,
        /chmod\s+777/,
        /curl.*\|\s*sh/,
        /wget.*\|\s*sh/,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(cmd)) {
          return {
            allowed: false,
            requiresConfirmation: false,
            reason: `Dangerous command pattern detected: ${pattern.source}`,
            riskLevel: 'critical',
          };
        }
      }
    }

    // 检查文件路径
    if (tool.startsWith('file_') && typeof argsObj.path === 'string') {
      const path = argsObj.path as string;
      const sensitivePaths = ['/etc', '/var', '/usr', '~/.ssh', '~/.env'];

      for (const sensitive of sensitivePaths) {
        if (path.startsWith(sensitive)) {
          return {
            allowed: true,
            requiresConfirmation: true,
            reason: `Access to sensitive path: ${path}`,
            riskLevel: 'high',
          };
        }
      }
    }

    return { allowed: true, requiresConfirmation: false, reason: 'OK', riskLevel: 'low' };
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2, 15);
  }
}

/** 全局安全审计器 */
export const securityAuditor = new SecurityAuditor();
