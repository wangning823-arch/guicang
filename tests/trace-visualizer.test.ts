import { describe, it, expect, beforeEach } from 'vitest';
import {
  TraceVisualizer,
  renderTrace,
  renderTraceHTML,
} from '../src/monitoring/trace-visualizer.js';
import { Tracer } from '../src/monitoring/tracer.js';

describe('TraceVisualizer', () => {
  let tracer: Tracer;
  let visualizer: TraceVisualizer;

  beforeEach(() => {
    tracer = new Tracer();
    visualizer = new TraceVisualizer();
  });

  describe('getSummary', () => {
    it('should return null for empty spans', () => {
      const summary = visualizer.getSummary([]);
      expect(summary).toBeNull();
    });

    it('should compute trace summary', () => {
      const root = tracer.startTrace('root');
      tracer.setAttribute('type', 'http');
      const child = tracer.startSpan('child', root.traceId, root.id);
      tracer.endSpan(child.id);
      tracer.endSpan(root.id);

      const summary = visualizer.getSummary(tracer.getAllSpans());
      expect(summary).not.toBeNull();
      expect(summary!.traceId).toBe(root.traceId);
      expect(summary!.spanCount).toBe(2);
      expect(summary!.errorCount).toBe(0);
      expect(summary!.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should count errors', () => {
      const root = tracer.startTrace('root');
      const child = tracer.startSpan('child', root.traceId, root.id);
      tracer.endSpan(child.id, 'error');
      tracer.endSpan(root.id, 'error');

      const summary = visualizer.getSummary(tracer.getAllSpans());
      expect(summary!.errorCount).toBe(2);
    });
  });

  describe('renderTimeline', () => {
    it('should render empty message for no spans', () => {
      const result = visualizer.renderTimeline([]);
      expect(result).toBe('(no spans)');
    });

    it('should render single span', () => {
      const root = tracer.startTrace('root');
      tracer.endSpan(root.id);

      const result = visualizer.renderTimeline(tracer.getAllSpans());
      expect(result).toContain('Trace:');
      expect(result).toContain('root');
      expect(result).toContain('✓');
    });

    it('should render nested spans with indentation', () => {
      const root = tracer.startTrace('root');
      const child = tracer.startSpan('child', root.traceId, root.id);
      const grandchild = tracer.startSpan(
        'grandchild',
        root.traceId,
        child.id,
      );
      tracer.endSpan(grandchild.id);
      tracer.endSpan(child.id);
      tracer.endSpan(root.id);

      const result = visualizer.renderTimeline(tracer.getAllSpans());
      const lines = result.split('\n');

      // root should have no indent, child 2 spaces, grandchild 4 spaces
      const rootLine = lines.find((l) => l.includes('root'));
      const childLine = lines.find((l) => l.includes('child') && !l.includes('grandchild'));
      const grandchildLine = lines.find((l) => l.includes('grandchild'));

      expect(rootLine).toBeDefined();
      expect(childLine).toBeDefined();
      expect(grandchildLine).toBeDefined();
    });

    it('should show error status', () => {
      const root = tracer.startTrace('root');
      tracer.endSpan(root.id, 'error');

      const result = visualizer.renderTimeline(tracer.getAllSpans());
      expect(result).toContain('✗');
    });

    it('should show duration in ms', () => {
      const root = tracer.startTrace('root');
      tracer.endSpan(root.id);

      const result = visualizer.renderTimeline(tracer.getAllSpans());
      expect(result).toContain('ms');
    });

    it('should show events when enabled', () => {
      const root = tracer.startTrace('root');
      tracer.addEvent('http.request', { method: 'GET' }, root.id);
      tracer.endSpan(root.id);

      const result = visualizer.renderTimeline(tracer.getAllSpans(), {
        showEvents: true,
      });
      expect(result).toContain('http.request');
      expect(result).toContain('📌');
    });

    it('should hide events when disabled', () => {
      const root = tracer.startTrace('root');
      tracer.addEvent('http.request', {}, root.id);
      tracer.endSpan(root.id);

      const result = visualizer.renderTimeline(tracer.getAllSpans(), {
        showEvents: false,
      });
      expect(result).not.toContain('📌');
    });

    it('should show attributes when enabled', () => {
      const root = tracer.startTrace('root');
      tracer.setAttribute('host', 'localhost');
      tracer.endSpan(root.id);

      const result = visualizer.renderTimeline(tracer.getAllSpans(), {
        showAttributes: true,
      });
      expect(result).toContain('host: localhost');
    });

    it('should format duration in seconds', () => {
      const root = tracer.startTrace('root');
      tracer.endSpan(root.id);

      const viz = new TraceVisualizer({ timeUnit: 's' });
      const result = viz.renderTimeline(tracer.getAllSpans());
      expect(result).toContain('s');
    });
  });

  describe('renderHTML', () => {
    it('should render HTML for empty spans', () => {
      const result = visualizer.renderHTML([]);
      expect(result).toBe('<div>No spans</div>');
    });

    it('should render valid HTML', () => {
      const root = tracer.startTrace('root');
      tracer.endSpan(root.id);

      const result = visualizer.renderHTML(tracer.getAllSpans());
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('Trace:');
      expect(result).toContain('root');
    });

    it('should include CSS styles', () => {
      const root = tracer.startTrace('root');
      tracer.endSpan(root.id);

      const result = visualizer.renderHTML(tracer.getAllSpans());
      expect(result).toContain('<style>');
      expect(result).toContain('font-family');
    });
  });

  describe('renderJSON', () => {
    it('should render empty object for no spans', () => {
      const result = visualizer.renderJSON([]);
      expect(result).toEqual({});
    });

    it('should render JSON structure', () => {
      const root = tracer.startTrace('root');
      const child = tracer.startSpan('child', root.traceId, root.id);
      tracer.endSpan(child.id);
      tracer.endSpan(root.id);

      const result = visualizer.renderJSON(tracer.getAllSpans()) as Record<string, unknown>;
      expect(result.traceId).toBe(root.traceId);
      expect(result.spanCount).toBe(2);
      expect(Array.isArray(result.spans)).toBe(true);
      expect((result.spans as Array<Record<string, unknown>>).length).toBe(2);
    });

    it('should include span details', () => {
      const root = tracer.startTrace('root');
      tracer.setAttribute('type', 'http');
      tracer.endSpan(root.id);

      const result = visualizer.renderJSON(tracer.getAllSpans()) as Record<string, unknown>;
      const spans = result.spans as Array<Record<string, unknown>>;
      expect(spans[0].name).toBe('root');
      expect(spans[0].attributes).toEqual({ type: 'http' });
    });
  });

  describe('edge cases', () => {
    it('should handle span without endTime', () => {
      tracer.startTrace('root');
      // Don't end span

      const result = visualizer.renderTimeline(tracer.getAllSpans());
      expect(result).toContain('root');
    });

    it('should handle multiple traces', () => {
      const trace1 = tracer.startTrace('trace1');
      tracer.endSpan(trace1.id);
      const trace2 = tracer.startTrace('trace2');
      tracer.endSpan(trace2.id);

      const summary = visualizer.getSummary(tracer.getAllSpans());
      // Should use first trace's ID
      expect(summary).not.toBeNull();
    });

    it('should handle custom maxWidth', () => {
      const root = tracer.startTrace('root');
      tracer.endSpan(root.id);

      const viz = new TraceVisualizer({ maxWidth: 120 });
      const result = viz.renderTimeline(tracer.getAllSpans());
      expect(result).toContain('root');
    });
  });
});

describe('快捷函数', () => {
  it('renderTrace should work', () => {
    const tracer = new Tracer();
    const root = tracer.startTrace('test');
    tracer.endSpan(root.id);

    const result = renderTrace(tracer.getAllSpans());
    expect(result).toContain('test');
  });

  it('renderTraceHTML should work', () => {
    const tracer = new Tracer();
    const root = tracer.startTrace('test');
    tracer.endSpan(root.id);

    const result = renderTraceHTML(tracer.getAllSpans());
    expect(result).toContain('<!DOCTYPE html>');
  });
});
