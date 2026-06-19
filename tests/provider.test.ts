import { describe, it, expect } from 'vitest';
import { createProvider, registerProvider, getRegisteredProviders } from '../src/provider/factory.js';
import { OpenAIProvider } from '../src/provider/openai.js';
import { AnthropicProvider } from '../src/provider/anthropic.js';
import { BaseProvider } from '../src/provider/base.js';
import type { ProviderConfig } from '../src/config/schema.js';
import type { Message } from '../src/core/types.js';

describe('Provider Factory', () => {
  it('creates OpenAI provider', () => {
    const config: ProviderConfig = {
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.type).toBe('openai');
  });

  it('creates Anthropic provider', () => {
    const config: ProviderConfig = {
      type: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-sonnet-4-20250514',
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.type).toBe('anthropic');
  });

  it('throws on unknown provider type', () => {
    const config: ProviderConfig = {
      type: 'unknown',
      baseUrl: 'https://example.com',
      model: 'model',
    };
    expect(() => createProvider(config)).toThrow('Unknown provider type: unknown');
  });

  it('registers custom provider', () => {
    class CustomProvider extends BaseProvider {
      get type(): string { return 'custom'; }
      async chat(): Promise<never> { throw new Error('Not implemented'); }
      async validate(): Promise<boolean> { return true; }
    }

    registerProvider('custom', CustomProvider);
    expect(getRegisteredProviders()).toContain('custom');

    const provider = createProvider({
      type: 'custom',
      baseUrl: 'https://example.com',
      model: 'model',
    });
    expect(provider).toBeInstanceOf(CustomProvider);
  });

  it('lists registered providers', () => {
    const providers = getRegisteredProviders();
    expect(providers).toContain('openai');
    expect(providers).toContain('anthropic');
  });
});

describe('OpenAI Provider', () => {
  const config: ProviderConfig = {
    type: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    timeout: 5000,
    maxRetries: 1,
  };

  it('has correct type', () => {
    const provider = new OpenAIProvider(config);
    expect(provider.type).toBe('openai');
  });

  it('returns model info', () => {
    const provider = new OpenAIProvider(config);
    const info = provider.getModelInfo();
    expect(info).toEqual({ type: 'openai', model: 'gpt-4o' });
  });

  it('validate fails without API key', async () => {
    delete process.env.OPENAI_API_KEY;
    const provider = new OpenAIProvider(config);
    const valid = await provider.validate();
    expect(valid).toBe(false);
  });

  it('chat throws without API key', async () => {
    delete process.env.OPENAI_API_KEY;
    const provider = new OpenAIProvider(config);
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    await expect(provider.chat(messages)).rejects.toThrow();
  });
});

describe('Anthropic Provider', () => {
  const config: ProviderConfig = {
    type: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
    timeout: 5000,
    maxRetries: 1,
  };

  it('has correct type', () => {
    const provider = new AnthropicProvider(config);
    expect(provider.type).toBe('anthropic');
  });

  it('returns model info', () => {
    const provider = new AnthropicProvider(config);
    const info = provider.getModelInfo();
    expect(info).toEqual({ type: 'anthropic', model: 'claude-sonnet-4-20250514' });
  });

  it('validate fails without API key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const provider = new AnthropicProvider(config);
    const valid = await provider.validate();
    expect(valid).toBe(false);
  });

  it('validate fails with wrong key format', async () => {
    process.env.ANTHROPIC_API_KEY = 'wrong-format';
    const provider = new AnthropicProvider(config);
    const valid = await provider.validate();
    expect(valid).toBe(false);
    delete process.env.ANTHROPIC_API_KEY;
  });
});
