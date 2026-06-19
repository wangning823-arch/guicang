import { describe, it, expect, beforeEach } from 'vitest';
import { I18n } from '../src/i18n/translations.js';

describe('I18n', () => {
  let i18n: I18n;

  beforeEach(() => {
    i18n = new I18n();
  });

  describe('basic translation', () => {
    it('should translate to Chinese by default', () => {
      expect(i18n.t('common.ok')).toBe('确定');
      expect(i18n.t('common.cancel')).toBe('取消');
    });

    it('should return key if translation missing', () => {
      expect(i18n.t('nonexistent.key' as any)).toBe('nonexistent.key');
    });
  });

  describe('language switching', () => {
    it('should switch to English', () => {
      i18n.setLanguage('en-US');
      expect(i18n.t('common.ok')).toBe('OK');
      expect(i18n.t('common.cancel')).toBe('Cancel');
    });

    it('should switch to Japanese', () => {
      i18n.setLanguage('ja-JP');
      expect(i18n.t('common.ok')).toBe('OK');
      expect(i18n.t('common.save')).toBe('保存');
    });

    it('should report current language', () => {
      expect(i18n.getLanguage()).toBe('zh-CN');
      i18n.setLanguage('en-US');
      expect(i18n.getLanguage()).toBe('en-US');
    });
  });

  describe('parameter substitution', () => {
    it('should replace parameters', () => {
      i18n.addTranslations('zh-CN', {
        'common.ok': '值是 {value}',
      });

      expect(i18n.t('common.ok', { value: 42 })).toBe('值是 42');
    });

    it('should replace multiple parameters', () => {
      i18n.addTranslations('zh-CN', {
        'common.ok': '{name} 有 {count} 个项目',
      });

      expect(i18n.t('common.ok', { name: '用户', count: 5 })).toBe('用户 有 5 个项目');
    });
  });

  describe('supported languages', () => {
    it('should list supported languages', () => {
      const langs = i18n.getSupportedLanguages();
      expect(langs).toContain('zh-CN');
      expect(langs).toContain('en-US');
      expect(langs).toContain('ja-JP');
    });
  });

  describe('custom translations', () => {
    it('should add custom translations', () => {
      i18n.addTranslations('zh-CN', {
        'common.ok': '好的',
      });

      expect(i18n.t('common.ok')).toBe('好的');
    });

    it('should add translations for new language', () => {
      i18n.addTranslations('ko-KR' as any, {
        'common.ok': '확인',
      });

      i18n.setLanguage('ko-KR' as any);
      expect(i18n.t('common.ok')).toBe('확인');
    });
  });

  describe('agent translations', () => {
    it('should translate agent states', () => {
      expect(i18n.t('agent.thinking')).toBe('思考中...');
      expect(i18n.t('agent.acting')).toBe('执行中...');
      expect(i18n.t('agent.observing')).toBe('观察中...');
      expect(i18n.t('agent.done')).toBe('完成');
    });

    it('should translate in English', () => {
      i18n.setLanguage('en-US');
      expect(i18n.t('agent.thinking')).toBe('Thinking...');
      expect(i18n.t('agent.done')).toBe('Done');
    });
  });

  describe('tool translations', () => {
    it('should translate tool states', () => {
      expect(i18n.t('tool.executing')).toBe('工具执行中');
      expect(i18n.t('tool.success')).toBe('工具执行成功');
      expect(i18n.t('tool.failed')).toBe('工具执行失败');
    });
  });

  describe('workflow translations', () => {
    it('should translate workflow states', () => {
      expect(i18n.t('workflow.created')).toBe('工作流已创建');
      expect(i18n.t('workflow.executing')).toBe('工作流执行中');
      expect(i18n.t('workflow.completed')).toBe('工作流已完成');
      expect(i18n.t('workflow.failed')).toBe('工作流执行失败');
    });
  });
});
