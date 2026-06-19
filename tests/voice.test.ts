import { describe, it, expect } from 'vitest';
import { VoiceManager } from '../src/voice/voice-manager.js';
import { WhisperSTT } from '../src/voice/stt/whisper.js';
import { OpenAITTS } from '../src/voice/tts/openai.js';

describe('VoiceManager', () => {
  it('creates with default config', () => {
    const manager = new VoiceManager();
    expect(manager.getSTTType()).toBeNull();
    expect(manager.getTTSType()).toBeNull();
  });

  it('sets and gets STT', () => {
    const manager = new VoiceManager();
    const stt = new WhisperSTT();
    manager.setSTT(stt);
    expect(manager.getSTTType()).toBe('whisper');
  });

  it('sets and gets TTS', () => {
    const manager = new VoiceManager();
    const tts = new OpenAITTS();
    manager.setTTS(tts);
    expect(manager.getTTSType()).toBe('openai-tts');
  });

  it('throws when STT not configured', async () => {
    const manager = new VoiceManager();
    await expect(manager.speechToText(Buffer.from('test'))).rejects.toThrow('No STT provider');
  });

  it('throws when TTS not configured', async () => {
    const manager = new VoiceManager();
    await expect(manager.textToSpeech('hello')).rejects.toThrow('No TTS provider');
  });

  it('reports availability', async () => {
    const manager = new VoiceManager();
    expect(await manager.isSTTAvailable()).toBe(false);
    expect(await manager.isTTSAvailable()).toBe(false);
  });
});

describe('WhisperSTT', () => {
  it('has correct type', () => {
    const stt = new WhisperSTT();
    expect(stt.type).toBe('whisper');
  });

  it('is not available without API key', async () => {
    delete process.env.OPENAI_API_KEY;
    const stt = new WhisperSTT();
    expect(await stt.isAvailable()).toBe(false);
  });

  it('throws when transcribing without API key', async () => {
    delete process.env.OPENAI_API_KEY;
    const stt = new WhisperSTT();
    await expect(stt.transcribe(Buffer.from('test'))).rejects.toThrow('API key required');
  });
});

describe('OpenAITTS', () => {
  it('has correct type', () => {
    const tts = new OpenAITTS();
    expect(tts.type).toBe('openai-tts');
  });

  it('is not available without API key', async () => {
    delete process.env.OPENAI_API_KEY;
    const tts = new OpenAITTS();
    expect(await tts.isAvailable()).toBe(false);
  });

  it('throws when synthesizing without API key', async () => {
    delete process.env.OPENAI_API_KEY;
    const tts = new OpenAITTS();
    await expect(tts.synthesize('hello')).rejects.toThrow('API key required');
  });

  it('lists voices', async () => {
    const tts = new OpenAITTS();
    const voices = await tts.listVoices();
    expect(voices.length).toBeGreaterThan(0);
    expect(voices[0].id).toBeDefined();
  });
});
