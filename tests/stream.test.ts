import { describe, it, expect } from 'vitest';
import { StreamHandler, type StreamEvent } from '../src/core/stream.js';

describe('StreamHandler', () => {
  it('handles text deltas', () => {
    const events: StreamEvent[] = [];
    const handler = new StreamHandler((e) => events.push(e));

    handler.handleTextDelta('Hello');
    handler.handleTextDelta(' world');

    expect(handler.getTextBuffer()).toBe('Hello world');
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'text_delta', delta: 'Hello' });
    expect(events[1]).toEqual({ type: 'text_delta', delta: ' world' });
  });

  it('handles tool calls', () => {
    const events: StreamEvent[] = [];
    const handler = new StreamHandler((e) => events.push(e));

    handler.handleToolCallStart('call-1', 'shell');
    handler.handleToolCallDelta('call-1', '{"command":');
    handler.handleToolCallDelta('call-1', ' "ls"}');
    const toolCall = handler.handleToolCallEnd('call-1');

    expect(toolCall).not.toBeNull();
    expect(toolCall!.id).toBe('call-1');
    expect(toolCall!.name).toBe('shell');
    expect(toolCall!.arguments).toEqual({ command: 'ls' });

    expect(events).toHaveLength(4);
    expect(events[0].type).toBe('tool_call_start');
    expect(events[1].type).toBe('tool_call_delta');
    expect(events[2].type).toBe('tool_call_delta');
    expect(events[3].type).toBe('tool_call_end');
  });

  it('finish returns complete response', () => {
    const handler = new StreamHandler();

    handler.handleTextDelta('Response text');
    handler.handleToolCallStart('call-1', 'shell');
    // 不调用 handleToolCallEnd，让 finish 处理

    const response = handler.finish();

    expect(response.message.content).toBe('Response text');
    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls![0].name).toBe('shell');
  });

  it('clear resets state', () => {
    const handler = new StreamHandler();

    handler.handleTextDelta('text');
    handler.handleToolCallStart('call-1', 'tool');
    handler.clear();

    expect(handler.getTextBuffer()).toBe('');
    const response = handler.finish();
    expect(response.toolCalls).toBeUndefined();
  });

  it('handles invalid JSON gracefully', () => {
    const handler = new StreamHandler();

    handler.handleToolCallStart('call-1', 'tool');
    handler.handleToolCallDelta('call-1', 'invalid json');
    const toolCall = handler.handleToolCallEnd('call-1');

    expect(toolCall).not.toBeNull();
    expect(toolCall!.arguments).toEqual({});
  });

  it('emits done event on finish', () => {
    const events: StreamEvent[] = [];
    const handler = new StreamHandler((e) => events.push(e));

    handler.handleTextDelta('done');
    handler.finish();

    expect(events[events.length - 1].type).toBe('done');
  });

  it('handles unknown tool call end gracefully', () => {
    const handler = new StreamHandler();
    const result = handler.handleToolCallEnd('unknown');
    expect(result).toBeNull();
  });
});
