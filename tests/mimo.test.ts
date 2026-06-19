import { describe, it, expect } from 'vitest';
import { MimoProvider } from '../src/provider/mimo.js';
import { createProvider, getRegisteredProviders } from '../src/provider/factory.js';
import type { ProviderConfig } from '../src/config/schema.js';
import type { Message } from '../src/core/types.js';

describe('Mimo Provider', () => {
  const config: ProviderConfig = {
    type: 'mimo',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic',
    model: 'mimo-v2.5',
    timeout: 5000,
    maxRetries: 1,
  };

  it('has correct type', () => {
    const provider = new MimoProvider(config);
    expect(provider.type).toBe('mimo');
  });

  it('returns model info', () => {
    const provider = new MimoProvider(config);
    const info = provider.getModelInfo();
    expect(info).toEqual({ type: 'mimo', model: 'mimo-v2.5' });
  });

  it('validate fails without API key', async () => {
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    const provider = new MimoProvider(config);
    const valid = await provider.validate();
    expect(valid).toBe(false);
  });

  it('validate fails with wrong key format', async () => {
    process.env.ANTHROPIC_AUTH_TOKEN = 'wrong-format';
    const provider = new MimoProvider(config);
    const valid = await provider.validate();
    expect(valid).toBe(false);
    delete process.env.ANTHROPIC_AUTH_TOKEN;
  });

  it('validate succeeds with correct key format', async () => {
    process.env.ANTHROPIC_AUTH_TOKEN = 'tp-valid-key';
    const provider = new MimoProvider(config);
    const valid = await provider.validate();
    expect(valid).toBe(true);
    delete process.env.ANTHROPIC_AUTH_TOKEN;
  });

  it('chat throws without API key', async () => {
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    const provider = new MimoProvider(config);
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    await expect(provider.chat(messages)).rejects.toThrow('API key is required');
  });
});

describe('Mimo Provider Factory', () => {
  it('creates Mimo provider via factory', () => {
    const config: ProviderConfig = {
      type: 'mimo',
      baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic',
      model: 'mimo-v2.5',
    };
    const provider = createProvider(config);
    expect(provider.type).toBe('mimo');
  });

  it('mimo is registered', () => {
    const providers = getRegisteredProviders();
    expect(providers).toContain('mimo');
  });
});
