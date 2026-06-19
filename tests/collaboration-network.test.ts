import { describe, it, expect, beforeEach } from 'vitest';
import { AgentNetwork } from '../src/collaboration/agent-network.js';
import type { AgentInfo } from '../src/collaboration/agent-network.js';

describe('AgentNetwork', () => {
  let network: AgentNetwork;

  beforeEach(() => {
    network = new AgentNetwork();
  });

  const createAgent = (id: string, role: 'coordinator' | 'worker' | 'reviewer' = 'worker'): AgentInfo => ({
    id,
    name: `Agent ${id}`,
    role,
    capabilities: ['task-a', 'task-b'],
    status: 'online',
    completedTasks: 0,
    lastSeen: new Date(),
  });

  describe('agent registration', () => {
    it('should register an agent', () => {
      const agent = createAgent('a1');
      network.registerAgent(agent);
      expect(network.getAgent('a1')).toBeDefined();
      expect(network.getAgent('a1')!.name).toBe('Agent a1');
    });

    it('should unregister an agent', () => {
      network.registerAgent(createAgent('a1'));
      expect(network.unregisterAgent('a1')).toBe(true);
      expect(network.getAgent('a1')).toBeUndefined();
    });

    it('should return false when unregistering non-existent agent', () => {
      expect(network.unregisterAgent('nonexistent')).toBe(false);
    });

    it('should get all agents', () => {
      network.registerAgent(createAgent('a1'));
      network.registerAgent(createAgent('a2'));
      expect(network.getAllAgents().length).toBe(2);
    });

    it('should get agents by role', () => {
      network.registerAgent(createAgent('a1', 'coordinator'));
      network.registerAgent(createAgent('a2', 'worker'));
      network.registerAgent(createAgent('a3', 'worker'));

      const workers = network.getAgentsByRole('worker');
      expect(workers.length).toBe(2);
    });

    it('should get online agents', () => {
      network.registerAgent(createAgent('a1'));
      network.registerAgent({ ...createAgent('a2'), status: 'offline' });

      const online = network.getOnlineAgents();
      expect(online.length).toBe(1);
      expect(online[0].id).toBe('a1');
    });
  });

  describe('messaging', () => {
    it('should send message to specific agent', async () => {
      const received: unknown[] = [];
      network.registerAgent(createAgent('a1'));
      network.registerAgent(createAgent('a2'));

      network.onMessage('a2', async (msg) => {
        received.push(msg);
      });

      await network.sendMessage({
        from: 'a1',
        to: 'a2',
        type: 'task',
        content: { task: 'do something' },
      });

      expect(received.length).toBe(1);
      expect(received[0]).toHaveProperty('type', 'task');
    });

    it('should broadcast message', async () => {
      const receivedA1: unknown[] = [];
      const receivedA2: unknown[] = [];

      network.registerAgent(createAgent('a1'));
      network.registerAgent(createAgent('a2'));

      network.onMessage('a1', async (msg) => receivedA1.push(msg));
      network.onMessage('a2', async (msg) => receivedA2.push(msg));

      await network.sendMessage({
        from: 'a1',
        to: 'broadcast',
        type: 'status',
        content: { status: 'online' },
      });

      expect(receivedA1.length).toBe(0); // sender doesn't receive
      expect(receivedA2.length).toBe(1);
    });

    it('should store message history', async () => {
      network.registerAgent(createAgent('a1'));
      network.registerAgent(createAgent('a2'));

      await network.sendMessage({
        from: 'a1',
        to: 'a2',
        type: 'task',
        content: {},
      });

      const history = network.getMessageHistory();
      expect(history.length).toBe(1);
    });

    it('should limit message history', async () => {
      network.registerAgent(createAgent('a1'));
      network.registerAgent(createAgent('a2'));

      for (let i = 0; i < 10; i++) {
        await network.sendMessage({
          from: 'a1',
          to: 'a2',
          type: 'task',
          content: { i },
        });
      }

      const history = network.getMessageHistory(5);
      expect(history.length).toBe(5);
    });
  });

  describe('task management', () => {
    it('should create a task', () => {
      const task = network.createTask({
        title: 'Test Task',
        description: 'A test task',
        assignedTo: [],
        createdBy: 'a1',
        dependencies: [],
        priority: 5,
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('pending');
    });

    it('should assign a task', () => {
      network.registerAgent(createAgent('a1'));
      const task = network.createTask({
        title: 'Test Task',
        description: 'A test task',
        assignedTo: [],
        createdBy: 'a1',
        dependencies: [],
        priority: 5,
      });

      const result = network.assignTask(task.id, ['a1']);
      expect(result).toBe(true);

      const agent = network.getAgent('a1');
      expect(agent!.status).toBe('busy');
    });

    it('should complete a task', () => {
      network.registerAgent(createAgent('a1'));
      const task = network.createTask({
        title: 'Test Task',
        description: 'A test task',
        assignedTo: [],
        createdBy: 'a1',
        dependencies: [],
        priority: 5,
      });

      network.assignTask(task.id, ['a1']);
      network.completeTask(task.id, { result: 'done' });

      const agent = network.getAgent('a1');
      expect(agent!.status).toBe('online');
      expect(agent!.completedTasks).toBe(1);

      const updatedTask = network.getTask(task.id);
      expect(updatedTask!.status).toBe('completed');
    });

    it('should fail a task', () => {
      network.registerAgent(createAgent('a1'));
      const task = network.createTask({
        title: 'Test Task',
        description: 'A test task',
        assignedTo: [],
        createdBy: 'a1',
        dependencies: [],
        priority: 5,
      });

      network.assignTask(task.id, ['a1']);
      network.failTask(task.id, 'Something went wrong');

      const agent = network.getAgent('a1');
      expect(agent!.status).toBe('online');

      const updatedTask = network.getTask(task.id);
      expect(updatedTask!.status).toBe('failed');
    });

    it('should get tasks by status', () => {
      network.registerAgent(createAgent('a1'));

      network.createTask({
        title: 'Task 1',
        description: '...',
        assignedTo: [],
        createdBy: 'a1',
        dependencies: [],
        priority: 1,
      });

      const task2 = network.createTask({
        title: 'Task 2',
        description: '...',
        assignedTo: [],
        createdBy: 'a1',
        dependencies: [],
        priority: 2,
      });

      network.assignTask(task2.id, ['a1']);

      expect(network.getTasksByStatus('pending').length).toBe(1);
      expect(network.getTasksByStatus('in_progress').length).toBe(1);
    });

    it('should auto-assign task', () => {
      network.registerAgent(createAgent('a1'));
      network.registerAgent(createAgent('a2'));

      const task = network.createTask({
        title: 'Auto Task',
        description: '...',
        assignedTo: [],
        createdBy: 'system',
        dependencies: [],
        priority: 5,
      });

      const result = network.autoAssignTask(task.id);
      expect(result).toBe(true);

      const updatedTask = network.getTask(task.id);
      expect(updatedTask!.assignedTo.length).toBe(1);
    });

    it('should fail auto-assign when no agents available', () => {
      const task = network.createTask({
        title: 'No Agents',
        description: '...',
        assignedTo: [],
        createdBy: 'system',
        dependencies: [],
        priority: 5,
      });

      const result = network.autoAssignTask(task.id);
      expect(result).toBe(false);
    });
  });

  describe('stats', () => {
    it('should return correct stats', () => {
      network.registerAgent(createAgent('a1'));
      network.registerAgent(createAgent('a2'));

      network.createTask({
        title: 'Task 1',
        description: '...',
        assignedTo: [],
        createdBy: 'a1',
        dependencies: [],
        priority: 1,
      });

      const stats = network.getStats();
      expect(stats.totalAgents).toBe(2);
      expect(stats.onlineAgents).toBe(2);
      expect(stats.totalTasks).toBe(1);
      expect(stats.pendingTasks).toBe(1);
    });
  });
});
