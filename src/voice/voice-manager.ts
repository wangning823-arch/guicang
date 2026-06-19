/**
 * 语音管理器
 * 统一管理 STT 和 TTS
 */

import type { BaseSTT, BaseTTS, STTResult, TTSOptions, VoiceConfig } from './base.js';

export class VoiceManager {
  private stt: BaseSTT | null = null;
  private tts: BaseTTS | null = null;
  private config: VoiceConfig;

  constructor(config: VoiceConfig = {}) {
    this.config = config;
  }

  /** 设置 STT 提供商 */
  setSTT(stt: BaseSTT): void {
    this.stt = stt;
  }

  /** 设置 TTS 提供商 */
  setTTS(tts: BaseTTS): void {
    this.tts = tts;
  }

  /** 语音转文本 */
  async speechToText(
    audio: Buffer | string,
    mimeType?: string,
  ): Promise<STTResult> {
    if (!this.stt) {
      throw new Error('No STT provider configured');
    }
    return this.stt.transcribe(audio, mimeType);
  }

  /** 文本转语音 */
  async textToSpeech(
    text: string,
    options?: TTSOptions,
  ): Promise<Buffer> {
    if (!this.tts) {
      throw new Error('No TTS provider configured');
    }
    return this.tts.synthesize(text, options);
  }

  /** 检查 STT 是否可用 */
  async isSTTAvailable(): Promise<boolean> {
    return this.stt?.isAvailable() ?? false;
  }

  /** 检查 TTS 是否可用 */
  async isTTSAvailable(): Promise<boolean> {
    return this.tts?.isAvailable() ?? false;
  }

  /** 获取 STT 类型 */
  getSTTType(): string | null {
    return this.stt?.type ?? null;
  }

  /** 获取 TTS 类型 */
  getTTSType(): string | null {
    return this.tts?.type ?? null;
  }
}
