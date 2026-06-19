/**
 * Shell 执行工具
 * 执行 shell 命令并返回输出
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseTool, type ToolContext } from '../base.js';
import type { ToolDefinition, ToolResult } from '../../core/types.js';

const execAsync = promisify(exec);

/** 最大输出大小（100KB） */
const MAX_OUTPUT_SIZE = 100 * 1024;

export class ShellTool extends BaseTool {
  readonly definition: ToolDefinition = {
    name: 'shell',
    description: 'Execute a shell command and return its output. Use with caution.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute',
        },
        timeout: {
          type: 'number',
          description: 'Command timeout in milliseconds (default: 30000)',
        },
      },
      required: ['command'],
    },
  };

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const toolCallId = args._toolCallId as string;
    const command = args.command as string;
    const timeout = (args.timeout as number) ?? 30_000;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: context.cwd,
        timeout,
        maxBuffer: MAX_OUTPUT_SIZE,
        env: { ...process.env, ...context.env },
      });

      let output = stdout;
      if (stderr) {
        output += `\n[stderr]\n${stderr}`;
      }

      // 截断过长的输出
      if (output.length > MAX_OUTPUT_SIZE) {
        output = output.slice(0, MAX_OUTPUT_SIZE) + '\n... (output truncated)';
      }

      return this.success(output || '(no output)', toolCallId);
    } catch (error) {
      const err = error as {
        code?: number;
        stdout?: string;
        stderr?: string;
        message?: string;
      };

      let output = '';
      if (err.stdout) output += err.stdout;
      if (err.stderr) output += `\n[stderr]\n${err.stderr}`;

      return this.error(
        `Command failed (exit code ${err.code ?? 'unknown'}): ${output || err.message || 'Unknown error'}`,
        toolCallId,
      );
    }
  }
}
