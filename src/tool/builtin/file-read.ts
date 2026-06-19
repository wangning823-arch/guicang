/**
 * 文件读取工具
 * 读取指定路径的文件内容
 */

import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BaseTool, type ToolContext } from '../base.js';
import type { ToolDefinition, ToolResult } from '../../core/types.js';

export class FileReadTool extends BaseTool {
  readonly definition: ToolDefinition = {
    name: 'file_read',
    description: 'Read the contents of a file at the given path',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The file path to read',
        },
        encoding: {
          type: 'string',
          description: 'File encoding (default: utf-8)',
          enum: ['utf-8', 'base64'],
        },
      },
      required: ['path'],
    },
  };

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const toolCallId = args._toolCallId as string;
    const filePath = args.path as string;
    const encoding = (args.encoding as string) ?? 'utf-8';

    try {
      const fullPath = resolve(context.cwd, filePath);

      // 检查文件是否存在
      const fileStat = await stat(fullPath);
      if (!fileStat.isFile()) {
        return this.error(`"${filePath}" is not a file`, toolCallId);
      }

      // 限制文件大小（1MB）
      if (fileStat.size > 1024 * 1024) {
        return this.error(`File too large (${fileStat.size} bytes). Max: 1MB`, toolCallId);
      }

      const content = await readFile(fullPath, { encoding: encoding as BufferEncoding });
      return this.success(content, toolCallId);
    } catch (error) {
      return this.error(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        toolCallId,
      );
    }
  }
}
