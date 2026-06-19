/**
 * 工作流构建器
 * 用于创建工作流定义
 */

import type { WorkflowDefinition, WorkflowNode, WorkflowEdge, NodeType } from './types.js';

let nodeCounter = 0;

function generateNodeId(): string {
  return `node_${++nodeCounter}`;
}

function generateEdgeId(): string {
  return `edge_${++nodeCounter}`;
}

export class WorkflowBuilder {
  private nodes: WorkflowNode[] = [];
  private edges: WorkflowEdge[] = [];
  private startNodeId: string = '';
  private endNodeId: string = '';
  private lastNodeId: string = '';
  private name: string = 'unnamed';
  private description: string = '';
  private version: string = '1.0.0';

  /** 设置工作流名称 */
  setName(name: string): this {
    this.name = name;
    return this;
  }

  /** 设置描述 */
  setDescription(description: string): this {
    this.description = description;
    return this;
  }

  /** 设置版本 */
  setVersion(version: string): this {
    this.version = version;
    return this;
  }

  /** 添加节点 */
  addNode(
    type: NodeType,
    name: string,
    config?: Record<string, unknown>,
  ): this {
    const id = generateNodeId();
    const node: WorkflowNode = {
      id,
      type,
      name,
      config,
      next: [],
    };

    this.nodes.push(node);

    // 自动连接上一个节点
    if (this.lastNodeId) {
      this.connect(this.lastNodeId, id);
    }

    this.lastNodeId = id;

    if (type === 'start') {
      this.startNodeId = id;
    } else if (type === 'end') {
      this.endNodeId = id;
    }

    return this;
  }

  /** 连接节点 */
  connect(fromId: string, toId: string, label?: string): this {
    const fromNode = this.nodes.find((n) => n.id === fromId);
    if (!fromNode) {
      throw new Error(`Node not found: ${fromId}`);
    }

    fromNode.next.push(toId);

    const edge: WorkflowEdge = {
      id: generateEdgeId(),
      from: fromId,
      to: toId,
      label,
    };

    this.edges.push(edge);
    return this;
  }

  /** 构建工作流定义 */
  build(): WorkflowDefinition {
    if (!this.startNodeId) {
      throw new Error('No start node defined');
    }
    if (!this.endNodeId) {
      throw new Error('No end node defined');
    }

    return {
      id: `wf_${Date.now()}`,
      name: this.name,
      description: this.description,
      version: this.version,
      nodes: [...this.nodes],
      edges: [...this.edges],
      startNode: this.startNodeId,
      endNode: this.endNodeId,
    };
  }

  /** 重置构建器 */
  reset(): void {
    this.nodes = [];
    this.edges = [];
    this.startNodeId = '';
    this.endNodeId = '';
    this.lastNodeId = '';
    nodeCounter = 0;
  }
}
