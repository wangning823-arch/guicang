/**
 * 文件写入工具
 * 写入内容到指定路径的文件
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { BaseTool, type ToolContext } from '../base.js';
import type { ToolDefinition, ToolResult } from '../../core/types.js';

export class FileWriteTool extends BaseTool {
  readonly definition: ToolDefinition = {
    name: 'file_write',
    description: 'Write content to a file at the given path. Creates parent directories if needed.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The file path to write',
        },
        content: {
          type: 'string',
          description: 'The content to write',
        },
        append: {
          type: 'boolean',
          description: 'Append to file instead of overwriting (default: false)',
        },
      },
      required: ['path', 'content'],
    },
  };

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const toolCallId = args._toolCallId as string;
    const filePath = args.path as string;
    const content = args.content as string;
    const append = (args.append as boolean) ?? false;

    try {
      const fullPath = resolve(context.cwd, filePath);

      // 确保目录存在
      const dir = dirname(fullPath);
      await mkdir(dir, { recursive: true });

      // 写入文件
      await writeFile(fullPath, content, { flag: append ? 'a' : 'w' });

      const action = append ? 'Appended to' : 'Wrote';
      return this.success(`${action} ${filePath} (${content.length} bytes)`, toolCallId);
    } catch (error) {
      return this.error(
        `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
        toolCallId,
      );
    }
  }
}
