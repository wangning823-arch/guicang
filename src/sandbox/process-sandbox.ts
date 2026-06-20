/**
 * 进程沙箱实现
 * 基于子进程隔离的沙箱
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { BaseSandbox, type Permission, type PermissionCheckResult, type SandboxConfig } from './base.js';
import { Logger } from '../core/logger.js';

const execAsync = promisify(exec);

export class ProcessSandbox extends BaseSandbox {
  private logger = new Logger('sandbox:process');
  private cwd: string;

  constructor(config: Partial<SandboxConfig> = {}, cwd: string = process.cwd()) {
    super(config);
    this.cwd = cwd;
  }

  checkPermission(permission: Permission, target?: string): PermissionCheckResult {
    // 检查是否在允许列表中
    if (!this.config.allowedPermissions.includes(permission)) {
      return {
        allowed: false,
        reason: `Permission "${permission}" is not allowed`,
      };
    }

    // 文件操作路径检查
    if (permission.startsWith('file:') && target) {
      const fullPath = resolve(this.cwd, target);
      if (this.isPathBlocked(fullPath)) {
        return {
          allowed: false,
          reason: `Path "${target}" is blocked`,
        };
      }
    }

    // 网络域名检查
    if (permission === 'network:outbound' && target) {
      if (!this.isDomainAllowed(target)) {
        return {
          allowed: false,
          reason: `Domain "${target}" is not allowed`,
        };
      }
    }

    return { allowed: true };
  }

  async execute(
    command: string,
    options?: { timeout?: number },
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // 检查权限
    const permResult = this.checkPermission('shell:execute', command);
    if (!permResult.allowed) {
      return {
        stdout: '',
        stderr: permResult.reason ?? 'Permission denied',
        exitCode: 126,
      };
    }

    const timeout = options?.timeout ?? this.config.commandTimeout ?? 30_000;

    this.logger.debug('Executing command', { command, timeout });

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        env: {
          // 仅传递必要的环境变量，不泄露其他变量
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          NODE_ENV: process.env.NODE_ENV,
        },
      });

      return { stdout, stderr, exitCode: 0 };
    } catch (error) {
      const err = error as {
        code?: number;
        stdout?: string;
        stderr?: string;
        message?: string;
        killed?: boolean;
      };

      // 区分超时和其他错误
      if (err.killed) {
        return {
          stdout: err.stdout ?? '',
          stderr: `Command timed out after ${timeout}ms`,
          exitCode: 124,
        };
      }

      return {
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? err.message ?? '',
        exitCode: err.code ?? 1,
      };
    }
  }

  /**
   * 设置工作目录
   */
  setCwd(cwd: string): void {
    this.cwd = cwd;
  }
}
