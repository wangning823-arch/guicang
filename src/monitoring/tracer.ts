/**
 * 分布式追踪
 * 追踪请求在系统中的流转
 */

export interface Span {
  /** Span ID */
  id: string;
  /** 父 Span ID */
  parentId?: string;
  /** 追踪 ID */
  traceId: string;
  /** 操作名称 */
  name: string;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime?: number;
  /** 状态 */
  status: 'ok' | 'error';
  /** 标签 */
  attributes: Record<string, unknown>;
  /** 事件 */
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, unknown> }>;
}

export class Tracer {
  private spans: Map<string, Span> = new Map();
  private activeSpanId: string | null = null;

  /** 开始新的追踪 */
  startTrace(name: string): Span {
    const traceId = this.generateId();
    const span = this.startSpan(name, traceId);
    return span;
  }

  /** 开始新的 Span */
  startSpan(name: string, traceId?: string, parentId?: string): Span {
    const span: Span = {
      id: this.generateId(),
      traceId: traceId ?? this.spans.get(this.activeSpanId ?? '')?.traceId ?? this.generateId(),
      parentId,
      name,
      startTime: Date.now(),
      status: 'ok',
      attributes: {},
      events: [],
    };

    this.spans.set(span.id, span);
    this.activeSpanId = span.id;

    return span;
  }

  /** 结束 Span */
  endSpan(spanId?: string, status: 'ok' | 'error' = 'ok'): void {
    const id = spanId ?? this.activeSpanId;
    if (!id) return;

    const span = this.spans.get(id);
    if (span) {
      span.endTime = Date.now();
      span.status = status;
    }

    // 恢复父 Span
    if (span?.parentId) {
      this.activeSpanId = span.parentId;
    } else {
      this.activeSpanId = null;
    }
  }

  /** 添加标签 */
  setAttribute(key: string, value: unknown, spanId?: string): void {
    const id = spanId ?? this.activeSpanId;
    if (!id) return;

    const span = this.spans.get(id);
    if (span) {
      span.attributes[key] = value;
    }
  }

  /** 添加事件 */
  addEvent(name: string, attributes?: Record<string, unknown>, spanId?: string): void {
    const id = spanId ?? this.activeSpanId;
    if (!id) return;

    const span = this.spans.get(id);
    if (span) {
      span.events.push({
        name,
        timestamp: Date.now(),
        attributes,
      });
    }
  }

  /** 获取追踪 */
  getTrace(traceId: string): Span[] {
    return [...this.spans.values()].filter((s) => s.traceId === traceId);
  }

  /** 获取当前活跃 Span */
  getActiveSpan(): Span | undefined {
    return this.activeSpanId ? this.spans.get(this.activeSpanId) : undefined;
  }

  /** 获取所有 Span */
  getAllSpans(): Span[] {
    return [...this.spans.values()];
  }

  /** 清空 */
  clear(): void {
    this.spans.clear();
    this.activeSpanId = null;
  }

  /** 生成追踪报告 */
  report(): string {
    const traces = new Map<string, Span[]>();
    for (const span of this.spans.values()) {
      if (!traces.has(span.traceId)) {
        traces.set(span.traceId, []);
      }
      traces.get(span.traceId)!.push(span);
    }

    const lines: string[] = ['Trace Report:', '============='];

    for (const [traceId, spans] of traces) {
      const duration = Math.max(...spans.map((s) => (s.endTime ?? s.startTime) - s.startTime));
      lines.push(`\nTrace ${traceId.slice(0, 8)}... (${duration}ms, ${spans.length} spans)`);

      for (const span of spans.sort((a, b) => a.startTime - b.startTime)) {
        const dur = (span.endTime ?? span.startTime) - span.startTime;
        const indent = span.parentId ? '  ' : '';
        const status = span.status === 'ok' ? '✓' : '✗';
        lines.push(`${indent}${status} ${span.name} (${dur}ms)`);
      }
    }

    return lines.join('\n');
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2, 15);
  }
}

/** 全局追踪器 */
export const tracer = new Tracer();
