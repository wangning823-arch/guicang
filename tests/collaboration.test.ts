import { describe, it, expect, beforeEach } from 'vitest';
import { Orchestrator } from '../src/collaboration/orchestrator.js';
import { Agent } from '../src/core/agent.js';
import { BaseProvider } from '../src/provider/base.js';
import type { Message, LLMResponse, ToolDefinition } from '../src/core/types.js';
import type { ProviderOptions } from '../src/provider/base.js';

/** Mock provider */
class MockProvider extends BaseProvider {
  private responseText: string;

  constructor(responseText: string = 'Mock response') {
    super({ type: 'mock', baseUrl: '', model: 'mock' });
    this.responseText = responseText;
  }

  get type(): string { return 'mock'; }

  async chat(
    _messages: Message[],
    _tools?: ToolDefinition[],
    _options?: ProviderOptions,
  ): Promise<LLMResponse> {
    return {
      message: {
        role: 'assistant',
        content: this.responseText,
      },
    };
  }

  async validate(): Promise<boolean> {
    return true;
  }
}

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
  });

  it('registers and retrieves roles', () => {
    const agent = new Agent(new MockProvider());
    orchestrator.registerRole({
      id: 'researcher',
      name: 'Researcher',
      description: 'Finds information',
      agent,
    });

    const role = orchestrator.getRole('researcher');
    expect(role).toBeDefined();
    expect(role!.name).toBe('Researcher');
  });

  it('throws on duplicate role', () => {
    const agent = new Agent(new MockProvider());
    orchestrator.registerRole({
      id: 'dup',
      name: 'Dup',
      description: 'test',
      agent,
    });

    expect(() =>
      orchestrator.registerRole({
        id: 'dup',
        name: 'Dup2',
        description: 'test',
        agent,
      }),
    ).toThrow('already registered');
  });

  it('creates and assigns tasks', () => {
    const agent = new Agent(new MockProvider());
    orchestrator.registerRole({
      id: 'worker',
      name: 'Worker',
      description: 'Does work',
      agent,
    });

    const task = orchestrator.createTask('Do something', 'input data');
    expect(task.state).toBe('pending');

    const assigned = orchestrator.assignTask(task, 'worker');
    expect(assigned.state).toBe('assigned');
    expect(assigned.assignedTo).toBe('worker');
  });

  it('throws when assigning to unknown role', () => {
    const task = orchestrator.createTask('test', 'input');
    expect(() => orchestrator.assignTask(task, 'unknown')).toThrow('not found');
  });

  it('executes a task', async () => {
    const agent = new Agent(new MockProvider('Task completed'));
    orchestrator.registerRole({
      id: 'executor',
      name: 'Executor',
      description: 'Executes tasks',
      agent,
    });

    const task = orchestrator.createTask('Execute me', 'do it');
    orchestrator.assignTask(task, 'executor');

    const result = await orchestrator.executeTask(task);
    expect(result.state).toBe('completed');
    expect(result.result).toBeDefined();
    expect(result.completedAt).toBeDefined();
  });

  it('executes multiple tasks concurrently', async () => {
    const agent = new Agent(new MockProvider());
    orchestrator.registerRole({
      id: 'worker',
      name: 'Worker',
      description: 'Worker',
      agent,
    });

    const tasks = [
      orchestrator.createTask('Task 1', 'input 1'),
      orchestrator.createTask('Task 2', 'input 2'),
      orchestrator.createTask('Task 3', 'input 3'),
    ].map((t) => orchestrator.assignTask(t, 'worker'));

    const result = await orchestrator.executeTasks(tasks);
    expect(result.success).toBe(true);
    expect(result.tasks).toHaveLength(3);
    expect(result.totalDuration).toBeGreaterThanOrEqual(0);
  });

  it('returns all roles', () => {
    const agent = new Agent(new MockProvider());
    orchestrator.registerRole({
      id: 'a',
      name: 'A',
      description: 'Agent A',
      agent,
    });
    orchestrator.registerRole({
      id: 'b',
      name: 'B',
      description: 'Agent B',
      agent,
    });

    expect(orchestrator.getAllRoles()).toHaveLength(2);
  });

  it('pipeline executes sequentially', async () => {
    const agent = new Agent(new MockProvider());
    orchestrator.registerRole({
      id: 'step',
      name: 'Step',
      description: 'Pipeline step',
      agent,
    });

    const result = await orchestrator.pipeline(
      ['Step 1', 'Step 2', 'Step 3'],
      'step',
    );

    expect(result.tasks).toHaveLength(3);
    expect(result.success).toBe(true);
  });
});
