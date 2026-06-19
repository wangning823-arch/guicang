/**
 * 多模态工具函数
 */

import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { ImageContent, AudioContent, MultimodalContent } from './types.js';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mp3',
  '.ogg': 'audio/ogg',
};

/**
 * 从文件创建图片内容
 */
export async function imageFromFile(filePath: string): Promise<ImageContent> {
  const content = await readFile(filePath);
  const ext = extname(filePath).toLowerCase();
  const mediaType = (MIME_MAP[ext] ?? 'image/png') as ImageContent['mediaType'];

  return {
    type: 'image',
    source: content.toString('base64'),
    mediaType,
    isBase64: true,
  };
}

/**
 * 从 URL 创建图片内容
 */
export function imageFromUrl(url: string, description?: string): ImageContent {
  return {
    type: 'image',
    source: url,
    mediaType: 'image/png',
    isBase64: false,
    description,
  };
}

/**
 * 从文件创建音频内容
 */
export async function audioFromFile(filePath: string): Promise<AudioContent> {
  const content = await readFile(filePath);
  const ext = extname(filePath).toLowerCase();
  const mediaType = (MIME_MAP[ext] ?? 'audio/wav') as AudioContent['mediaType'];

  return {
    type: 'audio',
    source: content.toString('base64'),
    mediaType,
    isBase64: true,
  };
}

/**
 * 创建文本内容
 */
export function text(text: string): MultimodalContent {
  return { type: 'text', text };
}

/**
 * 将多模态内容转换为纯文本（用于不支持多模态的 Provider）
 */
export function toPlainText(content: string | MultimodalContent[]): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .map((item) => {
      switch (item.type) {
        case 'text':
          return item.text;
        case 'image':
          return `[Image: ${item.description ?? 'image'}]`;
        case 'audio':
          return '[Audio]';
        default:
          return '';
      }
    })
    .join('\n');
}

/**
 * 检查内容是否包含图片
 */
export function hasImages(content: string | MultimodalContent[]): boolean {
  if (typeof content === 'string') return false;
  return content.some((item) => item.type === 'image');
}

/**
 * 提取所有图片
 */
export function extractImages(content: string | MultimodalContent[]): ImageContent[] {
  if (typeof content === 'string') return [];
  return content.filter((item): item is ImageContent => item.type === 'image');
}
