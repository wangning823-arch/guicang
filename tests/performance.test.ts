/**
 * Agent 性能基准测试
 */

import { describe, it, expect } from 'vitest';
import { Timer, MemoryMonitor } from '../src/perf/index.js';
import { Agent } from '../src/core/agent.js';
import { BaseProvider } from '../src/provider/base.js';
import { registerTools, clearRegistry, FileReadTool, FileWriteTool, ShellTool } from '../src/tool/index.js';
import type { Message, LLMResponse, ToolDefinition } from '../src/core/types.js';
import type { ProviderOptions } from '../src/provider/base.js';

/** Mock provider for benchmarking */
class BenchmarkProvider extends BaseProvider {
  private responseDelay: number;
  private toolCallCount: number;
  private currentCall = 0;

  constructor(responseDelay: number = 10, toolCalls: number = 0) {
    super({ type: 'benchmark', baseUrl: '', model: 'bench' });
    this.responseDelay = responseDelay;
    this.toolCallCount = toolCalls;
  }

  get type(): string { return 'benchmark'; }

  async chat(
    messages: Message[],
    tools?: ToolDefinition[],
    _options?: ProviderOptions,
  ): Promise<LLMResponse> {
    // 模拟延迟
    if (this.responseDelay > 0) {
      await new Promise((r) => setTimeout(r, this.responseDelay));
    }

    this.currentCall++;

    // 如果还有工具调用要做，且有工具可用
    if (this.currentCall <= this.toolCallCount && tools && tools.length > 0) {
      return {
        message: { role: 'assistant', content: '' },
        toolCalls: [{
          id: `bench_call_${this.currentCall}`,
          name: tools[0].name,
          arguments: { _toolCallId: `bench_call_${this.currentCall}`, command: 'echo bench' },
        }],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      };
    }

    // 最终回复
    return {
      message: { role: 'assistant', content: 'Benchmark response' },
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    };
  }

  async validate(): Promise<boolean> {
    return true;
  }
}

describe('Performance Benchmarks', () => {
  const timer = new Timer();
  const memMonitor = new MemoryMonitor();

  beforeEach(() => {
    timer.clear();
    memMonitor.clear();
    clearRegistry();
  });

  it('simple agent run performance', async () => {
    registerTools([new FileReadTool(), new FileWriteTool(), new ShellTool()]);

    const provider = new BenchmarkProvider(5, 0);
    const agent = new Agent(provider, { maxIterations: 5 });

    memMonitor.snapshot();
    timer.start('simple_run');

    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
      await agent.run('Hello');
    }

    timer.stop('simple_run');
    memMonitor.snapshot();

    const results = timer.getResults();
    expect(results).toHaveLength(1);

    const avgDuration = results[0].duration / iterations;
    console.log(`Simple run: ${avgDuration.toFixed(2)}ms avg (${iterations} iterations)`);

    // 性能断言：平均每次 < 50ms（mock provider 5ms delay）
    expect(avgDuration).toBeLessThan(50);
  });

  it('agent with tool calls performance', async () => {
    registerTools([new ShellTool()]);

    timer.start('tool_calls');

    const iterations = 20;
    for (let i = 0; i < iterations; i++) {
      // 每次迭代创建新的 provider 和 agent
      const provider = new BenchmarkProvider(5, 3);
      const agent = new Agent(provider, { maxIterations: 10 });
      const result = await agent.run('Do something');
      expect(result.toolCalls.length).toBeGreaterThan(0);
    }

    timer.stop('tool_calls');

    const results = timer.getResults();
    const avgDuration = results[0].duration / iterations;
    console.log(`Tool calls: ${avgDuration.toFixed(2)}ms avg (${iterations} iterations)`);

    // 性能断言：平均每次 < 100ms（3 tool calls * 5ms delay）
    expect(avgDuration).toBeLessThan(100);
  });

  it('concurrent agent runs performance', async () => {
    registerTools([new ShellTool()]);

    const provider = new BenchmarkProvider(5, 0);
    const agent = new Agent(provider, { maxIterations: 5 });

    timer.start('concurrent');

    const iterations = 30;
    const promises = Array.from({ length: iterations }, (_, i) =>
      agent.run(`Message ${i}`),
    );

    const results = await Promise.all(promises);
    timer.stop('concurrent');

    const timingResults = timer.getResults();
    console.log(`Concurrent: ${timingResults[0].duration.toFixed(2)}ms total (${iterations} parallel)`);

    // 所有结果都应该成功
    expect(results.every((r) => r.status === 'done')).toBe(true);
  });

  it('memory usage during operations', async () => {
    registerTools([new FileReadTool(), new FileWriteTool(), new ShellTool()]);

    const provider = new BenchmarkProvider(10, 2);
    const agent = new Agent(provider, { maxIterations: 10 });

    memMonitor.start(100);

    // 运行多次
    for (let i = 0; i < 20; i++) {
      await agent.run(`Test message ${i}`);
    }

    memMonitor.stop();

    const report = memMonitor.report();
    console.log('\n' + report);

    // 检查内存增长是否在合理范围内（< 50MB）
    const snapshots = memMonitor.getSnapshots();
    if (snapshots.length >= 2) {
      const growth = snapshots[snapshots.length - 1].heapUsed - snapshots[0].heapUsed;
      expect(growth).toBeLessThan(50 * 1024 * 1024); // 50MB
    }
  });

  it('registry operations performance', async () => {
    timer.start('registry');

    // 注册 100 个工具
    for (let i = 0; i < 100; i++) {
      class DummyTool extends (await import('../src/tool/base.js')).BaseTool {
        definition = {
          name: `tool_${i}`,
          description: `Tool ${i}`,
          parameters: { type: 'object', properties: {} },
        };
        async execute() {
          return { toolCallId: '', success: true, content: '' };
        }
      }
      const { registerTool } = await import('../src/tool/registry.js');
      registerTool(new DummyTool());
    }

    timer.stop('registry');

    const results = timer.getResults();
    console.log(`Registry (100 tools): ${results[0].duration.toFixed(2)}ms`);

    // 注册 100 个工具应该 < 20ms
    expect(results[0].duration).toBeLessThan(20);
  });
});
