/**
 * OpenAI Whisper STT 实现
 * 支持多种音频格式的语音转文本
 */

import { BaseSTT, type STTResult, type VoiceConfig } from '../base.js';

export class WhisperSTT extends BaseSTT {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: VoiceConfig & { apiKey?: string; baseUrl?: string } = {}) {
    super(config);
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
  }

  get type(): string {
    return 'whisper';
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.startsWith('sk-');
  }

  async transcribe(
    audio: Buffer | string,
    mimeType: string = 'audio/wav',
  ): Promise<STTResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key required for Whisper STT');
    }

    // 准备 FormData
    const formData = new FormData();

    let audioBlob: Blob;
    if (typeof audio === 'string') {
      // base64
      const binary = atob(audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      audioBlob = new Blob([bytes], { type: mimeType });
    } else {
      audioBlob = new Blob([new Uint8Array(audio)], { type: mimeType });
    }

    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', 'whisper-1');

    if (this.config.language) {
      formData.append('language', this.config.language);
    }

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whisper API error: ${error}`);
    }

    const result = (await response.json()) as { text: string };

    return {
      text: result.text,
      language: this.config.language,
    };
  }
}
