/**
 * 工作流类型定义
 */

/** 节点类型 */
export type NodeType = 'start' | 'end' | 'task' | 'condition' | 'parallel' | 'loop';

/** 工作流节点 */
export interface WorkflowNode {
  /** 节点 ID */
  id: string;
  /** 节点类型 */
  type: NodeType;
  /** 节点名称 */
  name: string;
  /** 节点配置 */
  config?: Record<string, unknown>;
  /** 下一个节点 ID 列表 */
  next: string[];
  /** 条件表达式（condition 节点） */
  condition?: string;
}

/** 工作流边 */
export interface WorkflowEdge {
  /** 边 ID */
  id: string;
  /** 源节点 ID */
  from: string;
  /** 目标节点 ID */
  to: string;
  /** 条件标签 */
  label?: string;
}

/** 工作流定义 */
export interface WorkflowDefinition {
  /** 工作流 ID */
  id: string;
  /** 工作流名称 */
  name: string;
  /** 工作流描述 */
  description?: string;
  /** 版本 */
  version: string;
  /** 节点列表 */
  nodes: WorkflowNode[];
  /** 边列表 */
  edges: WorkflowEdge[];
  /** 入口节点 ID */
  startNode: string;
  /** 出口节点 ID */
  endNode: string;
}

/** 节点执行结果 */
export interface NodeResult {
  /** 节点 ID */
  nodeId: string;
  /** 是否成功 */
  success: boolean;
  /** 输出数据 */
  output?: unknown;
  /** 错误信息 */
  error?: string;
  /** 执行时长（毫秒） */
  duration: number;
}

/** 工作流执行状态 */
export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused';

/** 工作流执行结果 */
export interface WorkflowResult {
  /** 工作流 ID */
  workflowId: string;
  /** 执行状态 */
  status: WorkflowStatus;
  /** 节点执行结果 */
  nodeResults: NodeResult[];
  /** 总耗时（毫秒） */
  totalDuration: number;
  /** 输出数据 */
  output?: unknown;
  /** 错误信息 */
  error?: string;
}
