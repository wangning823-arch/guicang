import { describe, it, expect } from 'vitest';
import { createProvider, getRegisteredProviders } from '../src/provider/factory.js';
import { OllamaProvider } from '../src/provider/ollama.js';
import { GoogleProvider } from '../src/provider/google.js';
import { AzureProvider } from '../src/provider/azure.js';
import type { ProviderConfig } from '../src/config/schema.js';

describe('Provider Registry', () => {
  it('registers all providers', () => {
    const providers = getRegisteredProviders();
    expect(providers).toContain('openai');
    expect(providers).toContain('anthropic');
    expect(providers).toContain('mimo');
    expect(providers).toContain('ollama');
    expect(providers).toContain('google');
  });

  it('creates Ollama provider', () => {
    const config: ProviderConfig = {
      type: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'llama3',
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.type).toBe('ollama');
  });

  it('creates Google provider', () => {
    const config: ProviderConfig = {
      type: 'google',
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-pro',
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(GoogleProvider);
    expect(provider.type).toBe('google');
  });

  it('creates Azure provider', () => {
    const config: ProviderConfig = {
      type: 'azure',
      baseUrl: 'https://myresource.openai.azure.com',
      model: 'gpt-4o',
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(AzureProvider);
    expect(provider.type).toBe('azure');
  });
});

describe('Ollama Provider', () => {
  const config: ProviderConfig = {
    type: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama3',
  };

  it('has correct type', () => {
    const provider = new OllamaProvider(config);
    expect(provider.type).toBe('ollama');
  });

  it('returns model info', () => {
    const provider = new OllamaProvider(config);
    const info = provider.getModelInfo();
    expect(info).toEqual({ type: 'ollama', model: 'llama3' });
  });

  it('validate fails when Ollama not running', async () => {
    const provider = new OllamaProvider(config);
    const valid = await provider.validate();
    expect(valid).toBe(false);
  });
});

describe('Google Provider', () => {
  const config: ProviderConfig = {
    type: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-pro',
  };

  it('has correct type', () => {
    const provider = new GoogleProvider(config);
    expect(provider.type).toBe('google');
  });

  it('validate fails without API key', async () => {
    delete process.env.GOOGLE_API_KEY;
    const provider = new GoogleProvider(config);
    const valid = await provider.validate();
    expect(valid).toBe(false);
  });

  it('chat throws without API key', async () => {
    delete process.env.GOOGLE_API_KEY;
    const provider = new GoogleProvider(config);
    await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
      'API key is required',
    );
  });
});

describe('Azure Provider', () => {
  const config: ProviderConfig = {
    type: 'azure',
    baseUrl: 'https://myresource.openai.azure.com',
    model: 'gpt-4o',
  };

  it('has correct type', () => {
    const provider = new AzureProvider(config);
    expect(provider.type).toBe('azure');
  });

  it('validate fails without API key', async () => {
    delete process.env.AZURE_OPENAI_API_KEY;
    const provider = new AzureProvider(config);
    const valid = await provider.validate();
    expect(valid).toBe(false);
  });

  it('chat throws without API key', async () => {
    delete process.env.AZURE_OPENAI_API_KEY;
    const provider = new AzureProvider(config);
    await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
      'API key is required',
    );
  });
});
