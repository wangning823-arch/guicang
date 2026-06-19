/**
 * 健康检查
 * 系统组件健康状态监控
 */

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  /** 组件名称 */
  name: string;
  /** 状态 */
  status: HealthStatus;
  /** 消息 */
  message?: string;
  /** 响应时间（毫秒） */
  duration: number;
  /** 检查时间 */
  timestamp: Date;
}

export interface HealthReport {
  /** 整体状态 */
  status: HealthStatus;
  /** 检查结果 */
  checks: HealthCheckResult[];
  /** 系统信息 */
  system: {
    uptime: number;
    memoryUsage: number;
    cpuUsage?: number;
  };
  /** 报告时间 */
  timestamp: Date;
}

export type HealthChecker = () => Promise<HealthCheckResult>;

export class HealthMonitor {
  private checkers = new Map<string, HealthChecker>();
  private results = new Map<string, HealthCheckResult>();
  private startTime = Date.now();

  /** 注册健康检查 */
  register(name: string, checker: HealthChecker): void {
    this.checkers.set(name, checker);
  }

  /** 注销健康检查 */
  unregister(name: string): boolean {
    return this.checkers.delete(name);
  }

  /** 执行单个检查 */
  async check(name: string): Promise<HealthCheckResult | null> {
    const checker = this.checkers.get(name);
    if (!checker) return null;

    const startTime = Date.now();
    try {
      const result = await checker();
      result.duration = Date.now() - startTime;
      result.timestamp = new Date();
      this.results.set(name, result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
      this.results.set(name, result);
      return result;
    }
  }

  /** 执行所有检查 */
  async checkAll(): Promise<HealthReport> {
    const checks: HealthCheckResult[] = [];

    for (const [name] of this.checkers) {
      const result = await this.check(name);
      if (result) {
        checks.push(result);
      }
    }

    // 确定整体状态
    let status: HealthStatus = 'healthy';
    for (const check of checks) {
      if (check.status === 'unhealthy') {
        status = 'unhealthy';
        break;
      }
      if (check.status === 'degraded') {
        status = 'degraded';
      }
    }

    const mem = process.memoryUsage();

    return {
      status,
      checks,
      system: {
        uptime: Date.now() - this.startTime,
        memoryUsage: mem.heapUsed / mem.heapTotal,
      },
      timestamp: new Date(),
    };
  }

  /** 获取上次检查结果 */
  getLastResults(): Map<string, HealthCheckResult> {
    return new Map(this.results);
  }
}

/** 全局健康监控 */
export const healthMonitor = new HealthMonitor();
