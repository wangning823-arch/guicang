import { describe, it, expect } from 'vitest';
import type { Message, ToolCall, ToolResult, AgentResult } from '../src/core/types.js';

describe('Core Types', () => {
  it('Message type has correct shape', () => {
    const msg: Message = {
      role: 'user',
      content: 'Hello',
    };
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
  });

  it('ToolCall type has correct shape', () => {
    const call: ToolCall = {
      id: 'call_1',
      name: 'web_search',
      arguments: { query: 'test' },
    };
    expect(call.id).toBe('call_1');
    expect(call.name).toBe('web_search');
  });

  it('ToolResult type has correct shape', () => {
    const result: ToolResult = {
      toolCallId: 'call_1',
      success: true,
      content: 'search results...',
    };
    expect(result.success).toBe(true);
  });

  it('AgentResult type has correct shape', () => {
    const result: AgentResult = {
      status: 'done',
      messages: [],
      toolCalls: [],
    };
    expect(result.status).toBe('done');
  });
});
