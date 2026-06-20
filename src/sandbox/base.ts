/**
 * 安全沙箱基类
 * 工具执行的隔离和权限控制
 */

/** 权限类型 */
export type Permission =
  | 'file:read'
  | 'file:write'
  | 'file:delete'
  | 'network:outbound'
  | 'shell:execute'
  | 'env:read'
  | 'memory:read'
  | 'memory:write';

/** 沙箱配置 */
export interface SandboxConfig {
  /** 允许的权限列表 */
  allowedPermissions: Permission[];
  /** 禁止的路径模式 */
  blockedPaths?: string[];
  /** 允许的网络域名 */
  allowedDomains?: string[];
  /** 最大文件大小（字节） */
  maxFileSize?: number;
  /** 命令执行超时（毫秒） */
  commandTimeout?: number;
  /** 最大内存使用（MB） */
  maxMemoryMB?: number;
}

/** 权限检查结果 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/** 默认沙箱配置 */
export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  allowedPermissions: ['file:read', 'file:write', 'shell:execute', 'env:read'],
  blockedPaths: ['/etc', '/proc', '/sys', '/dev'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  commandTimeout: 30_000,
  maxMemoryMB: 256,
};

/**
 * 安全沙箱抽象基类
 */
export abstract class BaseSandbox {
  protected config: SandboxConfig;

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
  }

  /**
   * 检查权限
   */
  abstract checkPermission(permission: Permission, target?: string): PermissionCheckResult;

  /**
   * 执行命令（带沙箱限制）
   */
  abstract execute(command: string, options?: { timeout?: number }): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;

  /**
   * 检查路径是否被阻止
   * 使用精确匹配或路径段匹配，避免 /etc 匹配 /etc2
   */
  isPathBlocked(path: string): boolean {
    return (this.config.blockedPaths ?? []).some((blocked) => {
      // 精确匹配
      if (path === blocked) return true;
      // 路径段匹配：确保是子路径（blocked 以 / 结尾，或 path 在 blocked 后有 /）
      return path.startsWith(blocked) && (blocked.endsWith('/') || path[blocked.length] === '/');
    });
  }

  /**
   * 检查域名是否允许
   * 支持端口号（如 api.example.com:8080）
   */
  isDomainAllowed(domain: string): boolean {
    if (!this.config.allowedDomains || this.config.allowedDomains.length === 0) {
      return true; // 未配置时允许所有
    }
    // 移除端口号再匹配
    const domainWithoutPort = domain.split(':')[0];
    return this.config.allowedDomains.some((allowed) =>
      domainWithoutPort === allowed || domainWithoutPort.endsWith(`.${allowed}`),
    );
  }

  /**
   * 获取配置
   */
  getConfig(): SandboxConfig {
    return { ...this.config };
  }
}
