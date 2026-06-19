import { describe, it, expect } from 'vitest';
import { NaturalLanguageConfig } from '../src/config/natural-language.js';

describe('NaturalLanguageConfig', () => {
  const parser = new NaturalLanguageConfig();

  describe('provider configuration', () => {
    it('should parse provider from Chinese', () => {
      const result = parser.parse('使用 OpenAI 作为提供商');
      expect(result.intent).toBe('set_provider');
      expect(result.key).toBe('defaultProvider');
      expect(result.value).toBe('openai');
    });

    it('should parse provider switch', () => {
      const result = parser.parse('切换到 Anthropic 提供商');
      expect(result.intent).toBe('set_provider');
      expect(result.value).toBe('anthropic');
    });
  });

  describe('model configuration', () => {
    it('should parse model from Chinese', () => {
      const result = parser.parse('切换到 GPT-4 模型');
      expect(result.intent).toBe('set_model');
      expect(result.key).toBe('model');
      expect(result.value).toBe('gpt-4');
    });

    it('should parse model with equals', () => {
      const result = parser.parse('模型设为 Claude-3');
      expect(result.intent).toBe('set_model');
      expect(result.value).toBe('claude-3');
    });
  });

  describe('API key configuration', () => {
    it('should parse API key', () => {
      const result = parser.parse('设置 API 密钥为 sk-abc123');
      expect(result.intent).toBe('set_api_key');
      expect(result.key).toBe('apiKey');
      expect(result.value).toBe('sk-abc123');
    });
  });

  describe('temperature configuration', () => {
    it('should parse temperature from Chinese', () => {
      const result = parser.parse('温度设为 0.7');
      expect(result.intent).toBe('set_temperature');
      expect(result.key).toBe('temperature');
      expect(result.value).toBe(0.7);
    });

    it('should parse temperature with "把"', () => {
      const result = parser.parse('把温度设为 0.5');
      expect(result.intent).toBe('set_temperature');
      expect(result.value).toBe(0.5);
    });
  });

  describe('max tokens configuration', () => {
    it('should parse max tokens', () => {
      const result = parser.parse('最大 token 数设为 4096');
      expect(result.intent).toBe('set_max_tokens');
      expect(result.key).toBe('maxTokens');
      expect(result.value).toBe(4096);
    });
  });

  describe('timeout configuration', () => {
    it('should parse timeout', () => {
      const result = parser.parse('超时时间设为 30 秒');
      expect(result.intent).toBe('set_timeout');
      expect(result.key).toBe('timeout');
      expect(result.value).toBe(30000);
    });
  });

  describe('feature toggle', () => {
    it('should parse enable feature', () => {
      const result = parser.parse('启用流式输出');
      expect(result.intent).toBe('enable_feature');
      expect(result.key).toBe('流式输出');
      expect(result.value).toBe(true);
    });

    it('should parse disable feature', () => {
      const result = parser.parse('关闭调试模式');
      expect(result.intent).toBe('disable_feature');
      expect(result.key).toBe('调试模式');
      expect(result.value).toBe(false);
    });

    it('should parse "打开"', () => {
      const result = parser.parse('打开日志');
      expect(result.intent).toBe('enable_feature');
      expect(result.key).toBe('日志');
    });

    it('should parse "开启"', () => {
      const result = parser.parse('开启缓存');
      expect(result.intent).toBe('enable_feature');
      expect(result.key).toBe('缓存');
    });
  });

  describe('tool management', () => {
    it('should parse add tool', () => {
      const result = parser.parse('添加网页搜索工具');
      expect(result.intent).toBe('add_tool');
      expect(result.key).toBe('tools');
      expect(result.value).toBe('网页搜索');
    });

    it('should parse remove tool', () => {
      const result = parser.parse('移除文件读取工具');
      expect(result.intent).toBe('remove_tool');
      expect(result.key).toBe('tools');
      expect(result.value).toBe('文件读取');
    });
  });

  describe('channel configuration', () => {
    it('should parse channel', () => {
      const result = parser.parse('使用 HTTP 渠道');
      expect(result.intent).toBe('set_channel');
      expect(result.key).toBe('channel');
      expect(result.value).toBe('http');
    });
  });

  describe('port configuration', () => {
    it('should parse port', () => {
      const result = parser.parse('端口设为 8080');
      expect(result.intent).toBe('set_port');
      expect(result.key).toBe('port');
      expect(result.value).toBe(8080);
    });
  });

  describe('English input', () => {
    it('should parse English model config', () => {
      const result = parser.parse('model: gpt-4');
      expect(result.intent).toBe('set_model');
      expect(result.value).toBe('gpt-4');
    });

    it('should parse English temperature', () => {
      const result = parser.parse('temperature: 0.8');
      expect(result.intent).toBe('set_temperature');
      expect(result.value).toBe(0.8);
    });

    it('should parse English max tokens', () => {
      const result = parser.parse('max_tokens: 2048');
      expect(result.intent).toBe('set_max_tokens');
      expect(result.value).toBe(2048);
    });
  });

  describe('unknown input', () => {
    it('should return unknown for unrecognized input', () => {
      const result = parser.parse('今天天气怎么样');
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe(0);
    });
  });

  describe('examples', () => {
    it('should return examples', () => {
      const examples = parser.getExamples();
      expect(examples.length).toBeGreaterThan(0);
      expect(examples[0]).toHaveProperty('intent');
      expect(examples[0]).toHaveProperty('example');
      expect(examples[0]).toHaveProperty('description');
    });
  });
});
