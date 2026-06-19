/**
 * OpenAI TTS 实现
 * 支持文本转语音
 */

import { BaseTTS, type TTSOptions, type VoiceConfig } from '../base.js';

export class OpenAITTS extends BaseTTS {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: VoiceConfig & { apiKey?: string; baseUrl?: string } = {}) {
    super(config);
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
  }

  get type(): string {
    return 'openai-tts';
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.startsWith('sk-');
  }

  async synthesize(
    text: string,
    options?: TTSOptions,
  ): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key required for TTS');
    }

    const voice = options?.voice ?? this.config.voice ?? 'alloy';
    const speed = options?.speed ?? this.config.speed ?? 1.0;

    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice,
        speed,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TTS API error: ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async listVoices(): Promise<Array<{ id: string; name: string; language: string }>> {
    return [
      { id: 'alloy', name: 'Alloy', language: 'en' },
      { id: 'echo', name: 'Echo', language: 'en' },
      { id: 'fable', name: 'Fable', language: 'en' },
      { id: 'onyx', name: 'Onyx', language: 'en' },
      { id: 'nova', name: 'Nova', language: 'en' },
      { id: 'shimmer', name: 'Shimmer', language: 'en' },
    ];
  }
}
