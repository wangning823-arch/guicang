import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../src/monitoring/metrics.js';
import { Tracer } from '../src/monitoring/tracer.js';
import { HealthMonitor } from '../src/monitoring/health.js';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  it('records counters', () => {
    collector.counter('requests');
    collector.counter('requests');
    collector.counter('requests', 5);

    expect(collector.getCounter('requests')).toBe(7);
  });

  it('records gauges', () => {
    collector.gauge('temperature', 25);
    collector.gauge('temperature', 30);

    const summary = collector.getSummary('temperature');
    expect(summary).not.toBeNull();
    expect(summary!.latest).toBe(30);
    expect(summary!.count).toBe(2);
  });

  it('records histograms', () => {
    collector.histogram('latency', 100);
    collector.histogram('latency', 200);
    collector.histogram('latency', 150);

    const summary = collector.getSummary('latency');
    expect(summary!.min).toBe(100);
    expect(summary!.max).toBe(200);
    expect(summary!.avg).toBe(150);
  });

  it('supports labels', () => {
    collector.counter('requests', 1, { method: 'GET' });
    collector.counter('requests', 2, { method: 'POST' });

    expect(collector.getCounter('requests', { method: 'GET' })).toBe(1);
    expect(collector.getCounter('requests', { method: 'POST' })).toBe(2);
  });

  it('returns history', () => {
    collector.gauge('value', 1);
    collector.gauge('value', 2);
    collector.gauge('value', 3);

    const history = collector.getHistory('value');
    expect(history).toHaveLength(3);
  });

  it('clears metrics', () => {
    collector.counter('test');
    collector.clear();

    expect(collector.getCounter('test')).toBe(0);
    expect(collector.getMetricNames()).toHaveLength(0);
  });
});

describe('Tracer', () => {
  let tracer: Tracer;

  beforeEach(() => {
    tracer = new Tracer();
  });

  it('creates traces', () => {
    const span = tracer.startTrace('test-operation');

    expect(span.id).toBeDefined();
    expect(span.traceId).toBeDefined();
    expect(span.name).toBe('test-operation');
    expect(span.startTime).toBeGreaterThan(0);
  });

  it('creates child spans', () => {
    const parent = tracer.startTrace('parent');
    const child = tracer.startSpan('child', parent.traceId, parent.id);

    expect(child.parentId).toBe(parent.id);
    expect(child.traceId).toBe(parent.traceId);
  });

  it('ends spans', () => {
    const span = tracer.startTrace('test');
    tracer.endSpan(span.id);

    const updated = tracer.getAllSpans().find((s) => s.id === span.id);
    expect(updated?.endTime).toBeDefined();
    expect(updated?.status).toBe('ok');
  });

  it('sets attributes', () => {
    const span = tracer.startTrace('test');
    tracer.setAttribute('user.id', '123', span.id);
    tracer.setAttribute('http.method', 'GET', span.id);

    const updated = tracer.getAllSpans().find((s) => s.id === span.id);
    expect(updated?.attributes['user.id']).toBe('123');
    expect(updated?.attributes['http.method']).toBe('GET');
  });

  it('adds events', () => {
    const span = tracer.startTrace('test');
    tracer.addEvent('cache.miss', { key: 'user:123' }, span.id);

    const updated = tracer.getAllSpans().find((s) => s.id === span.id);
    expect(updated?.events).toHaveLength(1);
    expect(updated?.events[0].name).toBe('cache.miss');
  });

  it('generates report', () => {
    const span = tracer.startTrace('operation');
    tracer.endSpan(span.id);

    const report = tracer.report();
    expect(report).toContain('Trace Report');
    expect(report).toContain('operation');
  });

  it('clears all spans', () => {
    tracer.startTrace('test');
    tracer.clear();

    expect(tracer.getAllSpans()).toHaveLength(0);
  });
});

describe('HealthMonitor', () => {
  let monitor: HealthMonitor;

  beforeEach(() => {
    monitor = new HealthMonitor();
  });

  it('registers and runs checks', async () => {
    monitor.register('test', async () => ({
      name: 'test',
      status: 'healthy',
      duration: 0,
      timestamp: new Date(),
    }));

    const result = await monitor.check('test');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('healthy');
  });

  it('handles check failure', async () => {
    monitor.register('failing', async () => {
      throw new Error('Check failed');
    });

    const result = await monitor.check('failing');
    expect(result!.status).toBe('unhealthy');
    expect(result!.message).toContain('Check failed');
  });

  it('runs all checks', async () => {
    monitor.register('check1', async () => ({
      name: 'check1',
      status: 'healthy',
      duration: 0,
      timestamp: new Date(),
    }));

    monitor.register('check2', async () => ({
      name: 'check2',
      status: 'degraded',
      duration: 0,
      timestamp: new Date(),
    }));

    const report = await monitor.checkAll();
    expect(report.checks).toHaveLength(2);
    expect(report.status).toBe('degraded'); // degraded if any check is degraded
  });

  it('unregisters checks', () => {
    monitor.register('test', async () => ({
      name: 'test',
      status: 'healthy',
      duration: 0,
      timestamp: new Date(),
    }));

    expect(monitor.unregister('test')).toBe(true);
    expect(monitor.unregister('nonexistent')).toBe(false);
  });
});
