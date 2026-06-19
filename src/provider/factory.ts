/**
 * Provider 工厂
 * 根据配置创建对应的 provider 实例
 */

import type { ProviderConfig } from '../config/schema.js';
import { BaseProvider } from './base.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { MimoProvider } from './mimo.js';
import { OllamaProvider } from './ollama.js';
import { GoogleProvider } from './google.js';
import { AzureProvider, type AzureProviderConfig } from './azure.js';

/** 已注册的 provider 类型 */
const PROVIDER_REGISTRY = new Map<string, new (config: ProviderConfig) => BaseProvider>([
  ['openai', OpenAIProvider],
  ['anthropic', AnthropicProvider],
  ['mimo', MimoProvider],
  ['ollama', OllamaProvider],
  ['google', GoogleProvider],
]);

/**
 * 注册自定义 provider
 */
export function registerProvider(
  type: string,
  cls: new (config: ProviderConfig) => BaseProvider,
): void {
  PROVIDER_REGISTRY.set(type, cls);
}

/**
 * 根据配置创建 provider 实例
 */
export function createProvider(config: ProviderConfig): BaseProvider {
  // Azure 需要特殊处理
  if (config.type === 'azure') {
    return new AzureProvider(config as AzureProviderConfig);
  }

  const ProviderClass = PROVIDER_REGISTRY.get(config.type);
  if (!ProviderClass) {
    throw new Error(
      `Unknown provider type: ${config.type}. Available: ${[...PROVIDER_REGISTRY.keys()].join(', ')}`,
    );
  }
  return new ProviderClass(config);
}

/**
 * 获取所有已注册的 provider 类型
 */
export function getRegisteredProviders(): string[] {
  return [...PROVIDER_REGISTRY.keys()];
}
