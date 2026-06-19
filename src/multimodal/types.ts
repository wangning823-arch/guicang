/**
 * 多模态类型定义
 * 支持图片、音频等多种内容类型
 */

/** 内容类型 */
export type ContentType = 'text' | 'image' | 'audio' | 'video';

/** 文本内容 */
export interface TextContent {
  type: 'text';
  text: string;
}

/** 图片内容 */
export interface ImageContent {
  type: 'image';
  /** 图片 URL 或 base64 数据 */
  source: string;
  /** 图片格式 */
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  /** 是否为 base64 编码 */
  isBase64?: boolean;
  /** 图片描述（可选，用于辅助理解） */
  description?: string;
}

/** 音频内容 */
export interface AudioContent {
  type: 'audio';
  /** 音频 URL 或 base64 数据 */
  source: string;
  /** 音频格式 */
  mediaType: 'audio/wav' | 'audio/mp3' | 'audio/ogg';
  /** 是否为 base64 编码 */
  isBase64?: boolean;
}

/** 多模态内容 */
export type MultimodalContent = TextContent | ImageContent | AudioContent;

/** 多模态消息 */
export interface MultimodalMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | MultimodalContent[];
}
