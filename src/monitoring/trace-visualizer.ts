/**
 * 分布式追踪可视化
 * 将追踪数据渲染为时间线和甘特图
 */

import type { Span } from './tracer.js';

/** 时间线渲染选项 */
export interface TimelineOptions {
  /** 最大宽度（字符数） */
  maxWidth?: number;
  /** 是否显示事件 */
  showEvents?: boolean;
  /** 是否显示属性 */
  showAttributes?: boolean;
  /** 时间单位 */
  timeUnit?: 'ms' | 's';
  /** 最小显示宽度 */
  minWidth?: number;
}

/** 时间线条目 */
interface TimelineEntry {
  span: Span;
  depth: number;
  startOffset: number;
  duration: number;
  barStart: number;
  barWidth: number;
}

/** 追踪摘要 */
export interface TraceSummary {
  traceId: string;
  totalDuration: number;
  spanCount: number;
  errorCount: number;
  spans: Span[];
  startTime: number;
  endTime: number;
}

/**
 * 追踪可视化器
 * 渲染追踪数据为可读的时间线
 */
export class TraceVisualizer {
  private options: Required<TimelineOptions>;

  constructor(options: TimelineOptions = {}) {
    this.options = {
      maxWidth: options.maxWidth ?? 80,
      showEvents: options.showEvents ?? true,
      showAttributes: options.showAttributes ?? false,
      timeUnit: options.timeUnit ?? 'ms',
      minWidth: options.minWidth ?? 20,
    };
  }

  /**
   * 生成追踪摘要
   */
  getSummary(spans: Span[]): TraceSummary | null {
    if (spans.length === 0) return null;

    const traceId = spans[0].traceId;
    const traceSpans = spans.filter((s) => s.traceId === traceId);
    const startTime = Math.min(...traceSpans.map((s) => s.startTime));
    const endTime = Math.max(
      ...traceSpans.map((s) => s.endTime ?? s.startTime),
    );
    const errorCount = traceSpans.filter((s) => s.status === 'error').length;

    return {
      traceId,
      totalDuration: endTime - startTime,
      spanCount: traceSpans.length,
      errorCount,
      spans: traceSpans,
      startTime,
      endTime,
    };
  }

  /**
   * 渲染文本时间线
   */
  renderTimeline(spans: Span[], options?: TimelineOptions): string {
    const opts = { ...this.options, ...options };
    const entries = this.buildTimelineEntries(spans, opts);

    if (entries.length === 0) return '(no spans)';

    const lines: string[] = [];
    const traceId = spans[0]?.traceId ?? 'unknown';
    const summary = this.getSummary(spans);

    // Header
    lines.push(`Trace: ${traceId.slice(0, 12)}...`);
    if (summary) {
      lines.push(
        `Duration: ${this.formatDuration(summary.totalDuration, opts)} | Spans: ${summary.spanCount} | Errors: ${summary.errorCount}`,
      );
    }
    lines.push('─'.repeat(opts.maxWidth));

    // Timeline entries
    for (const entry of entries) {
      const name = entry.span.name.padEnd(20).slice(0, 20);
      const status = entry.span.status === 'ok' ? '✓' : '✗';
      const duration = this.formatDuration(entry.duration, opts);

      // Build bar
      const barStart = entry.barStart;
      const barWidth = Math.max(1, entry.barWidth);
      const prefix = '  '.repeat(entry.depth);
      const barAreaWidth = opts.maxWidth - 28;
      const totalDur = summary?.totalDuration ?? 1;
      const barOffset = totalDur > 0 ? Math.floor((barStart / totalDur) * barAreaWidth) : 0;
      const barLen = totalDur > 0 ? Math.ceil((barWidth / totalDur) * barAreaWidth) : 1;
      const safeBarOffset = Math.min(barOffset, barAreaWidth);
      const safeBarLen = Math.min(barLen, barAreaWidth - safeBarOffset);

      const bar = ' '.repeat(safeBarOffset) + '█'.repeat(safeBarLen);
      lines.push(
        `${prefix}${status} ${name} │ ${bar.slice(0, barAreaWidth)} ${duration}`,
      );

      // Show events
      if (opts.showEvents && entry.span.events.length > 0) {
        for (const event of entry.span.events) {
          const eventTime = this.formatDuration(
            event.timestamp - entry.span.startTime,
            opts,
          );
          lines.push(`${prefix}  └─ 📌 ${event.name} @ ${eventTime}`);
        }
      }

      // Show attributes
      if (opts.showAttributes && Object.keys(entry.span.attributes).length > 0) {
        for (const [key, value] of Object.entries(entry.span.attributes)) {
          lines.push(`${prefix}  └─ ${key}: ${String(value)}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * 渲染 HTML 时间线
   */
  renderHTML(spans: Span[]): string {
    const entries = this.buildTimelineEntries(spans, this.options);
    const summary = this.getSummary(spans);

    if (!summary) return '<div>No spans</div>';

    const rows = entries
      .map((entry) => {
        const statusColor =
          entry.span.status === 'ok' ? '#10b981' : '#ef4444';
        const barLeft = summary.totalDuration
          ? `${(entry.startOffset / summary.totalDuration) * 100}%`
          : '0%';
        const barWidth = summary.totalDuration
          ? `${(entry.duration / summary.totalDuration) * 100}%`
          : '0%';
        const marginLeft = `${entry.depth * 20}px`;

        const eventHtml =
          entry.span.events.length > 0
            ? `<div class="span-events">${entry.span.events.map((e) => `<div class="event">📌 ${e.name}</div>`).join('')}</div>`
            : '';

        const attrHtml =
          Object.keys(entry.span.attributes).length > 0
            ? `<div class="span-attrs">${Object.entries(entry.span.attributes).map(([k, v]) => `<div class="attr">${k}: ${String(v)}</div>`).join('')}</div>`
            : '';

        return `
        <div class="span-row">
          <div class="span-label" style="margin-left: ${marginLeft}">
            <span class="status" style="color: ${statusColor}">${entry.span.status === 'ok' ? '✓' : '✗'}</span>
            <span class="name">${entry.span.name}</span>
            <span class="duration">${this.formatDuration(entry.duration, this.options)}</span>
          </div>
          <div class="span-bar-container">
            <div class="span-bar" style="left: ${barLeft}; width: ${barWidth}; background: ${statusColor}20; border-left: 3px solid ${statusColor};"></div>
          </div>
          ${eventHtml}
          ${attrHtml}
        </div>`;
      })
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: monospace; background: #1a1a2e; color: #e0e0e0; padding: 20px; }
    .trace-header { margin-bottom: 20px; }
    .trace-header h2 { color: #00d4ff; margin: 0 0 8px 0; }
    .trace-header .meta { color: #888; font-size: 14px; }
    .timeline { position: relative; }
    .span-row { margin-bottom: 4px; }
    .span-label { display: inline-block; width: 300px; white-space: nowrap; }
    .span-bar-container { display: inline-block; position: relative; width: 500px; height: 20px; }
    .span-bar { position: absolute; top: 2px; height: 16px; border-radius: 2px; }
    .status { margin-right: 8px; }
    .name { margin-right: 8px; }
    .duration { color: #888; }
    .span-events, .span-attrs { margin-left: 40px; font-size: 12px; color: #aaa; }
    .event { color: #fbbf24; }
    .attr { color: #60a5fa; }
    .error { border-color: #ef4444 !important; }
  </style>
</head>
<body>
  <div class="trace-header">
    <h2>Trace: ${summary.traceId.slice(0, 12)}...</h2>
    <div class="meta">
      Duration: ${this.formatDuration(summary.totalDuration, this.options)} |
      Spans: ${summary.spanCount} |
      Errors: ${summary.errorCount}
    </div>
  </div>
  <div class="timeline">${rows}</div>
</body>
</html>`;
  }

  /**
   * 渲染 JSON 格式
   */
  renderJSON(spans: Span[]): object {
    if (spans.length === 0) return {};
    const summary = this.getSummary(spans);
    const entries = this.buildTimelineEntries(spans, this.options);

    return {
      traceId: summary?.traceId,
      totalDuration: summary?.totalDuration,
      spanCount: summary?.spanCount,
      errorCount: summary?.errorCount,
      spans: entries.map((e) => ({
        id: e.span.id,
        name: e.span.name,
        parentId: e.span.parentId,
        depth: e.depth,
        duration: e.duration,
        status: e.span.status,
        startTime: e.span.startTime,
        endTime: e.span.endTime,
        startOffset: e.startOffset,
        attributes: e.span.attributes,
        events: e.span.events,
      })),
    };
  }

  /**
   * 构建时间线条目
   */
  private buildTimelineEntries(
    spans: Span[],
    _options: Required<TimelineOptions>,
  ): TimelineEntry[] {
    if (spans.length === 0) return [];

    const traceId = spans[0].traceId;
    const traceSpans = spans.filter((s) => s.traceId === traceId);
    const summary = this.getSummary(traceSpans);
    if (!summary) return [];

    // Build parent-child map
    const childMap = new Map<string | undefined, Span[]>();
    for (const span of traceSpans) {
      const key = span.parentId ?? undefined;
      if (!childMap.has(key)) childMap.set(key, []);
      childMap.get(key)!.push(span);
    }

    // Sort children by start time
    for (const [, children] of childMap) {
      children.sort((a, b) => a.startTime - b.startTime);
    }

    // Flatten with depth tracking
    const entries: TimelineEntry[] = [];
    this.flattenSpans(childMap, undefined, 0, summary, entries);

    return entries;
  }

  /**
   * 递归展平 Span 树
   */
  private flattenSpans(
    childMap: Map<string | undefined, Span[]>,
    parentId: string | undefined,
    depth: number,
    summary: TraceSummary,
    entries: TimelineEntry[],
  ): void {
    const children = childMap.get(parentId) ?? [];
    for (const span of children) {
      const startOffset = span.startTime - summary.startTime;
      const duration = (span.endTime ?? span.startTime) - span.startTime;
      const barStart = startOffset;
      const barWidth = duration;

      entries.push({
        span,
        depth,
        startOffset,
        duration,
        barStart,
        barWidth,
      });

      // Recurse into children
      this.flattenSpans(childMap, span.id, depth + 1, summary, entries);
    }
  }

  /**
   * 格式化持续时间
   */
  private formatDuration(
    ms: number,
    options: Required<TimelineOptions>,
  ): string {
    if (options.timeUnit === 's') {
      return `${(ms / 1000).toFixed(2)}s`;
    }
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

/**
 * 快捷函数：生成时间线文本
 */
export function renderTrace(spans: Span[], options?: TimelineOptions): string {
  return new TraceVisualizer(options).renderTimeline(spans);
}

/**
 * 快捷函数：生成 HTML
 */
export function renderTraceHTML(spans: Span[]): string {
  return new TraceVisualizer().renderHTML(spans);
}
