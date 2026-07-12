/**
 * 文件读取工具
 * 读取指定路径的文件内容，支持分页读取大文件
 */

import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BaseTool, type ToolContext } from '../base.js';
import type { ToolDefinition, ToolResult } from '../../core/types.js';

/** 每次读取的最大字符数（防止撑爆 LLM 上下文） */
const MAX_READ_CHARS = 2000;

export class FileReadTool extends BaseTool {
  readonly definition: ToolDefinition = {
    name: 'file_read',
    description: 'Read the contents of a file at the given path. Supports offset/limit for large files.',
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
        offset: {
          type: 'number',
          description: 'Start reading from this character position (0-based). Use with limit for large files.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of characters to read (default: 2000). Recommended for large files.',
        },
      },
      required: ['path'],
    },
  };

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const toolCallId = args._toolCallId as string;
    const filePath = args.path as string;
    const encoding = (args.encoding as string) ?? 'utf-8';
    const offset = (args.offset as number) ?? 0;
    const limit = (args.limit as number) ?? MAX_READ_CHARS;

    try {
      const fullPath = resolve(context.cwd, filePath);

      // 检查文件是否存在
      const fileStat = await stat(fullPath);
      if (!fileStat.isFile()) {
        return this.error(`"${filePath}" is not a file`, toolCallId);
      }

      // 读取完整内容
      const fullContent = await readFile(fullPath, { encoding: encoding as BufferEncoding });
      const totalLength = fullContent.length;

      // 分页读取
      const start = Math.min(offset, totalLength);
      const end = Math.min(start + limit, totalLength);
      const content = fullContent.slice(start, end);

      // 构建结果，包含分页信息
      const hasMore = end < totalLength;
      const meta = `[File: ${filePath}] [Size: ${totalLength} chars] [Read: ${start}-${end}/${totalLength}]${hasMore ? ' [More: use offset=' + end + ' to continue]' : ''}`;

      return this.success(`${meta}\n\n${content}`, toolCallId);
    } catch (error) {
      return this.error(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        toolCallId,
      );
    }
  }
}
