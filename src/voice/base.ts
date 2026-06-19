/**
 * 语音模块基类
 * 语音输入（STT）和语音输出（TTS）的抽象接口
 */

/** 语音配置 */
export interface VoiceConfig {
  /** STT 提供商 */
  sttProvider?: string;
  /** TTS 提供商 */
  ttsProvider?: string;
  /** 语言 */
  language?: string;
  /** 语音类型 */
  voice?: string;
  /** 语速 */
  speed?: number;
}

/** STT 结果 */
export interface STTResult {
  /** 转录文本 */
  text: string;
  /** 置信度 */
  confidence?: number;
  /** 语言 */
  language?: string;
}

/** TTS 选项 */
export interface TTSOptions {
  /** 语音类型 */
  voice?: string;
  /** 语速 (0.5-2.0) */
  speed?: number;
  /** 音调 */
  pitch?: number;
}

/**
 * STT（语音转文本）接口
 */
export abstract class BaseSTT {
  constructor(protected config: VoiceConfig) {}

  /** 提供商标识 */
  abstract get type(): string;

  /**
   * 将音频转录为文本
   * @param audio 音频数据（Buffer 或 base64）
   * @param mimeType 音频 MIME 类型
   */
  abstract transcribe(
    audio: Buffer | string,
    mimeType?: string,
  ): Promise<STTResult>;

  /**
   * 检查是否可用
   */
  abstract isAvailable(): Promise<boolean>;
}

/**
 * TTS（文本转语音）接口
 */
export abstract class BaseTTS {
  constructor(protected config: VoiceConfig) {}

  /** 提供商标识 */
  abstract get type(): string;

  /**
   * 将文本转换为语音
   * @param text 要转换的文本
   * @param options TTS 选项
   * @returns 音频数据（Buffer）
   */
  abstract synthesize(
    text: string,
    options?: TTSOptions,
  ): Promise<Buffer>;

  /**
   * 获取支持的语音列表
   */
  abstract listVoices(): Promise<Array<{ id: string; name: string; language: string }>>;

  /**
   * 检查是否可用
   */
  abstract isAvailable(): Promise<boolean>;
}
