import { describe, it, expect } from 'vitest';
import { WorkflowBuilder } from '../src/workflow/builder.js';
import { WorkflowEngine } from '../src/workflow/engine.js';

describe('WorkflowBuilder', () => {
  it('builds a simple workflow', () => {
    const wf = new WorkflowBuilder()
      .setName('test-workflow')
      .setDescription('A test workflow')
      .addNode('start', 'Start')
      .addNode('task', 'Process', { action: 'process' })
      .addNode('end', 'End');

    const definition = wf.build();

    expect(definition.name).toBe('test-workflow');
    expect(definition.nodes).toHaveLength(3);
    expect(definition.edges).toHaveLength(2);
    expect(definition.nodes[0].type).toBe('start');
    expect(definition.nodes[2].type).toBe('end');
  });

  it('throws when building without start node', () => {
    const wf = new WorkflowBuilder()
      .addNode('task', 'Task')
      .addNode('end', 'End');

    expect(() => wf.build()).toThrow('No start node');
  });

  it('throws when building without end node', () => {
    const wf = new WorkflowBuilder()
      .addNode('start', 'Start')
      .addNode('task', 'Task');

    expect(() => wf.build()).toThrow('No end node');
  });

  it('supports manual connections', () => {
    const wf = new WorkflowBuilder()
      .setName('manual')
      .addNode('start', 'Start')
      .addNode('task', 'Task A')
      .addNode('task', 'Task B')
      .addNode('end', 'End');

    // 手动重新连接
    const nodes = wf['nodes'];
    wf.connect(nodes[0].id, nodes[1].id);
    wf.connect(nodes[1].id, nodes[2].id);
    wf.connect(nodes[2].id, nodes[3].id);

    const definition = wf.build();
    expect(definition.edges.length).toBeGreaterThanOrEqual(2);
  });
});

describe('WorkflowEngine', () => {
  it('executes a simple workflow', async () => {
    const wf = new WorkflowBuilder()
      .setName('simple')
      .addNode('start', 'Start')
      .addNode('task', 'Process')
      .addNode('end', 'End');

    const definition = wf.build();
    const engine = new WorkflowEngine();

    const result = await engine.execute(definition);

    expect(result.status).toBe('completed');
    expect(result.nodeResults).toHaveLength(3);
    expect(result.totalDuration).toBeGreaterThanOrEqual(0);
  });

  it('executes with custom handlers', async () => {
    const wf = new WorkflowBuilder()
      .setName('custom')
      .addNode('start', 'Start')
      .addNode('task', 'Double')
      .addNode('end', 'End');

    const definition = wf.build();
    const engine = new WorkflowEngine();

    let doubleResult: unknown;
    engine.registerHandler('task', async (node, context) => {
      const input = (context.get('input') as number) ?? 1;
      doubleResult = input * 2;
      return doubleResult;
    });

    const context = new Map([['input', 5]]);
    const result = await engine.execute(definition, context);

    expect(result.status).toBe('completed');
    expect(doubleResult).toBe(10);
  });

  it('handles node failure', async () => {
    const wf = new WorkflowBuilder()
      .setName('failing')
      .addNode('start', 'Start')
      .addNode('task', 'Fail')
      .addNode('end', 'End');

    const definition = wf.build();
    const engine = new WorkflowEngine();

    engine.registerHandler('task', async () => {
      throw new Error('Task failed');
    });

    const result = await engine.execute(definition);

    expect(result.status).toBe('failed');
    expect(result.nodeResults[1].success).toBe(false);
    expect(result.nodeResults[1].error).toContain('Task failed');
  });

  it('reports status correctly', () => {
    const engine = new WorkflowEngine();
    expect(engine.getStatus()).toBe('idle');
  });

  it('handles missing node gracefully', async () => {
    const definition = {
      id: 'test',
      name: 'test',
      version: '1.0.0',
      nodes: [{ id: 'start', type: 'start' as const, name: 'Start', next: ['missing'] }],
      edges: [],
      startNode: 'start',
      endNode: 'missing',
    };

    const engine = new WorkflowEngine();
    const result = await engine.execute(definition);

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Node not found');
  });
});
