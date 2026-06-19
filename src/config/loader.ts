/**
 * 配置加载器
 * 从 TOML 文件和环境变量加载配置
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { GuicangConfig } from './schema.js';
import { DEFAULT_CONFIG } from './schema.js';

/**
 * 简易 TOML 解析器（仅支持扁平结构和嵌套 table）
 * 生产环境应使用 toml npm 包
 */
function parseToml(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentSection: Record<string, unknown> = result;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    // [section] or [section.sub]
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      const parts = sectionMatch[1].split('.');
      let target: Record<string, unknown> = result;
      for (const part of parts) {
        if (!target[part]) target[part] = {};
        target = target[part] as Record<string, unknown>;
      }
      currentSection = target;
      continue;
    }

    // key = value
    const kvMatch = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (kvMatch) {
      const [, key, rawValue] = kvMatch;
      let value: unknown = rawValue.trim();

      // 类型推断
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (value === 'null') value = null;
      else if (/^-?\d+$/.test(value as string)) value = Number(value);
      else if (/^-?\d+\.\d+$/.test(value as string)) value = Number(value);
      else if ((value as string).startsWith('"') && (value as string).endsWith('"')) {
        value = (value as string).slice(1, -1);
      }

      currentSection[key] = value;
    }
  }

  return result;
}

/**
 * 从环境变量覆盖配置
 */
function applyEnvOverrides(config: GuicangConfig): void {
  const logLevel = process.env.GUICANG_LOG_LEVEL;
  if (logLevel && ['debug', 'info', 'warn', 'error'].includes(logLevel)) {
    config.logLevel = logLevel as GuicangConfig['logLevel'];
  }

  const defaultProvider = process.env.GUICANG_DEFAULT_PROVIDER;
  if (defaultProvider) {
    config.defaultProvider = defaultProvider;
  }
}

/**
 * 加载配置文件
 * @param configPath 配置文件路径，默认为 ./guicang.toml
 */
export async function loadConfig(configPath?: string): Promise<GuicangConfig> {
  const resolvedPath = resolve(configPath ?? './guicang.toml');

  let config: GuicangConfig;
  try {
    const content = await readFile(resolvedPath, 'utf-8');
    const parsed = parseToml(content);
    config = { ...DEFAULT_CONFIG, ...parsed } as GuicangConfig;
  } catch {
    // 配置文件不存在时使用默认配置
    config = { ...DEFAULT_CONFIG };
  }

  applyEnvOverrides(config);
  return config;
}

export { parseToml };
