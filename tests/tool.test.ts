import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  registerTool,
  getTool,
  getAllToolDefinitions,
  getRegisteredToolNames,
  executeTool,
  clearRegistry,
  FileReadTool,
  FileWriteTool,
  ShellTool,
} from '../src/tool/index.js';
import type { ToolContext } from '../src/tool/index.js';

describe('Tool Registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('registers and retrieves tools', () => {
    const tool = new FileReadTool();
    registerTool(tool);

    expect(getTool('file_read')).toBe(tool);
    expect(getRegisteredToolNames()).toContain('file_read');
  });

  it('throws on duplicate registration', () => {
    registerTool(new FileReadTool());
    expect(() => registerTool(new FileReadTool())).toThrow('already registered');
  });

  it('returns all tool definitions', () => {
    registerTool(new FileReadTool());
    registerTool(new FileWriteTool());

    const defs = getAllToolDefinitions();
    expect(defs).toHaveLength(2);
    expect(defs.map((d) => d.name)).toContain('file_read');
    expect(defs.map((d) => d.name)).toContain('file_write');
  });

  it('executes tool with valid args', async () => {
    registerTool(new FileReadTool());

    const tmpDir = resolve(tmpdir(), `guicang-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    await writeFile(resolve(tmpDir, 'test.txt'), 'hello world');

    const context: ToolContext = { cwd: tmpDir, env: {}, log: () => {} };
    const result = await executeTool('file_read', { path: 'test.txt' }, 'call-1', context);

    expect(result.success).toBe(true);
    expect(result.content).toBe('hello world');

    await rm(tmpDir, { recursive: true });
  });

  it('returns error for unknown tool', async () => {
    const context: ToolContext = { cwd: '.', env: {}, log: () => {} };
    const result = await executeTool('unknown', {}, 'call-1', context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('FileReadTool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = resolve(tmpdir(), `guicang-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it('has correct definition', () => {
    const tool = new FileReadTool();
    expect(tool.name).toBe('file_read');
    expect(tool.definition.parameters.required).toContain('path');
  });

  it('reads file content', async () => {
    await writeFile(resolve(tmpDir, 'test.txt'), 'hello world');

    const tool = new FileReadTool();
    const context: ToolContext = { cwd: tmpDir, env: {}, log: () => {} };
    const result = await tool.execute({ path: 'test.txt', _toolCallId: 'call-1' }, context);

    expect(result.success).toBe(true);
    expect(result.content).toBe('hello world');
  });

  it('fails on non-existent file', async () => {
    const tool = new FileReadTool();
    const context: ToolContext = { cwd: tmpDir, env: {}, log: () => {} };
    const result = await tool.execute({ path: 'missing.txt', _toolCallId: 'call-1' }, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to read file');
  });
});

describe('FileWriteTool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = resolve(tmpdir(), `guicang-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it('has correct definition', () => {
    const tool = new FileWriteTool();
    expect(tool.name).toBe('file_write');
    expect(tool.definition.parameters.required).toContain('path');
    expect(tool.definition.parameters.required).toContain('content');
  });

  it('writes file content', async () => {
    const tool = new FileWriteTool();
    const context: ToolContext = { cwd: tmpDir, env: {}, log: () => {} };
    const result = await tool.execute(
      { path: 'output.txt', content: 'test content', _toolCallId: 'call-1' },
      context,
    );

    expect(result.success).toBe(true);

    const content = await readFile(resolve(tmpDir, 'output.txt'), 'utf-8');
    expect(content).toBe('test content');
  });

  it('creates parent directories', async () => {
    const tool = new FileWriteTool();
    const context: ToolContext = { cwd: tmpDir, env: {}, log: () => {} };
    const result = await tool.execute(
      { path: 'nested/dir/file.txt', content: 'deep', _toolCallId: 'call-1' },
      context,
    );

    expect(result.success).toBe(true);

    const content = await readFile(resolve(tmpDir, 'nested/dir/file.txt'), 'utf-8');
    expect(content).toBe('deep');
  });

  it('appends to file', async () => {
    await writeFile(resolve(tmpDir, 'existing.txt'), 'line 1\n');

    const tool = new FileWriteTool();
    const context: ToolContext = { cwd: tmpDir, env: {}, log: () => {} };
    await tool.execute(
      { path: 'existing.txt', content: 'line 2\n', append: true, _toolCallId: 'call-1' },
      context,
    );

    const content = await readFile(resolve(tmpDir, 'existing.txt'), 'utf-8');
    expect(content).toBe('line 1\nline 2\n');
  });
});

describe('ShellTool', () => {
  it('has correct definition', () => {
    const tool = new ShellTool();
    expect(tool.name).toBe('shell');
    expect(tool.definition.parameters.required).toContain('command');
  });

  it('executes command successfully', async () => {
    const tool = new ShellTool();
    const context: ToolContext = { cwd: tmpdir(), env: {}, log: () => {} };
    const result = await tool.execute({ command: 'echo hello', _toolCallId: 'call-1' }, context);

    expect(result.success).toBe(true);
    expect(result.content).toContain('hello');
  });

  it('handles command failure', async () => {
    const tool = new ShellTool();
    const context: ToolContext = { cwd: tmpdir(), env: {}, log: () => {} };
    const result = await tool.execute(
      { command: 'exit 1', _toolCallId: 'call-1' },
      context,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('exit code 1');
  });
});
