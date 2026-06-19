/**
 * 工作流引擎
 * 执行工作流定义
 */

import type {
  WorkflowDefinition,
  WorkflowNode,
  NodeResult,
  WorkflowResult,
  WorkflowStatus,
} from './types.js';
import { Logger } from '../core/logger.js';

const logger = new Logger('workflow:engine');

/** 节点处理器 */
export type NodeHandler = (
  node: WorkflowNode,
  context: Map<string, unknown>,
) => Promise<unknown>;

export class WorkflowEngine {
  private handlers = new Map<string, NodeHandler>();
  private status: WorkflowStatus = 'idle';

  /** 注册节点处理器 */
  registerHandler(type: string, handler: NodeHandler): void {
    this.handlers.set(type, handler);
  }

  /** 获取执行状态 */
  getStatus(): WorkflowStatus {
    return this.status;
  }

  /** 执行工作流 */
  async execute(
    definition: WorkflowDefinition,
    initialContext?: Map<string, unknown>,
  ): Promise<WorkflowResult> {
    this.status = 'running';
    const startTime = Date.now();
    const nodeResults: NodeResult[] = [];
    const context = initialContext ?? new Map<string, unknown>();

    logger.info(`Executing workflow: ${definition.name}`, { id: definition.id });

    try {
      let currentNodeId = definition.startNode;

      while (currentNodeId) {
        const node = definition.nodes.find((n) => n.id === currentNodeId);
        if (!node) {
          throw new Error(`Node not found: ${currentNodeId}`);
        }

        // 执行节点
        const result = await this.executeNode(node, context);
        nodeResults.push(result);

        if (!result.success) {
          this.status = 'failed';
          return {
            workflowId: definition.id,
            status: 'failed',
            nodeResults,
            totalDuration: Date.now() - startTime,
            error: result.error,
          };
        }

        // 存储节点输出到上下文
        if (result.output !== undefined) {
          context.set(node.id, result.output);
        }

        // 到达结束节点
        if (node.type === 'end') {
          break;
        }

        // 查找下一个节点
        const nextNodeId = this.findNextNode(node, definition, context);
        if (!nextNodeId) break;
        currentNodeId = nextNodeId;
      }

      this.status = 'completed';
      const output = context.get(definition.endNode);

      logger.info(`Workflow completed: ${definition.name}`, {
        duration: Date.now() - startTime,
      });

      return {
        workflowId: definition.id,
        status: 'completed',
        nodeResults,
        totalDuration: Date.now() - startTime,
        output,
      };
    } catch (error) {
      this.status = 'failed';
      const errorMsg = error instanceof Error ? error.message : String(error);

      logger.error(`Workflow failed: ${definition.name}`, { error: errorMsg });

      return {
        workflowId: definition.id,
        status: 'failed',
        nodeResults,
        totalDuration: Date.now() - startTime,
        error: errorMsg,
      };
    }
  }

  private async executeNode(
    node: WorkflowNode,
    context: Map<string, unknown>,
  ): Promise<NodeResult> {
    const startTime = Date.now();

    // 跳过 start 和 end 节点
    if (node.type === 'start' || node.type === 'end') {
      return {
        nodeId: node.id,
        success: true,
        duration: Date.now() - startTime,
      };
    }

    const handler = this.handlers.get(node.type) ?? this.handlers.get('task');
    if (!handler) {
      return {
        nodeId: node.id,
        success: true,
        output: node.config,
        duration: Date.now() - startTime,
      };
    }

    try {
      const output = await handler(node, context);
      return {
        nodeId: node.id,
        success: true,
        output,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        nodeId: node.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  private findNextNode(
    node: WorkflowNode,
    definition: WorkflowDefinition,
    context: Map<string, unknown>,
  ): string | null {
    if (node.type === 'condition') {
      // 条件节点：评估条件选择下一个节点
      const edges = definition.edges.filter((e) => e.from === node.id);
      for (const edge of edges) {
        if (edge.label) {
          // 简单条件评估（检查上下文中的值）
          const value = context.get(edge.label);
          if (value) return edge.to;
        }
      }
      // 默认返回第一个
      return edges[0]?.to ?? null;
    }

    // 其他节点：返回第一个下一个节点
    return node.next[0] ?? null;
  }
}
