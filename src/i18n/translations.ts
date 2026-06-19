/**
 * 国际化支持
 * 多语言翻译系统
 */

/** 翻译键 */
export type TranslationKey =
  | 'common.ok'
  | 'common.cancel'
  | 'common.save'
  | 'common.delete'
  | 'common.error'
  | 'common.success'
  | 'common.loading'
  | 'agent.thinking'
  | 'agent.acting'
  | 'agent.observing'
  | 'agent.done'
  | 'agent.error'
  | 'tool.executing'
  | 'tool.success'
  | 'tool.failed'
  | 'config.saved'
  | 'config.reloaded'
  | 'channel.connected'
  | 'channel.disconnected'
  | 'plugin.installed'
  | 'plugin.removed'
  | 'workflow.created'
  | 'workflow.executing'
  | 'workflow.completed'
  | 'workflow.failed';

/** 语言代码 */
export type Language = 'zh-CN' | 'en-US' | 'ja-JP';

/** 翻译集合 */
type Translations = Record<TranslationKey, string>;

/** 语言包 */
const languagePacks: Record<Language, Translations> = {
  'zh-CN': {
    'common.ok': '确定',
    'common.cancel': '取消',
    'common.save': '保存',
    'common.delete': '删除',
    'common.error': '错误',
    'common.success': '成功',
    'common.loading': '加载中...',
    'agent.thinking': '思考中...',
    'agent.acting': '执行中...',
    'agent.observing': '观察中...',
    'agent.done': '完成',
    'agent.error': 'Agent 错误',
    'tool.executing': '工具执行中',
    'tool.success': '工具执行成功',
    'tool.failed': '工具执行失败',
    'config.saved': '配置已保存',
    'config.reloaded': '配置已重载',
    'channel.connected': '渠道已连接',
    'channel.disconnected': '渠道已断开',
    'plugin.installed': '插件已安装',
    'plugin.removed': '插件已移除',
    'workflow.created': '工作流已创建',
    'workflow.executing': '工作流执行中',
    'workflow.completed': '工作流已完成',
    'workflow.failed': '工作流执行失败',
  },
  'en-US': {
    'common.ok': 'OK',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.loading': 'Loading...',
    'agent.thinking': 'Thinking...',
    'agent.acting': 'Acting...',
    'agent.observing': 'Observing...',
    'agent.done': 'Done',
    'agent.error': 'Agent Error',
    'tool.executing': 'Executing tool',
    'tool.success': 'Tool executed successfully',
    'tool.failed': 'Tool execution failed',
    'config.saved': 'Configuration saved',
    'config.reloaded': 'Configuration reloaded',
    'channel.connected': 'Channel connected',
    'channel.disconnected': 'Channel disconnected',
    'plugin.installed': 'Plugin installed',
    'plugin.removed': 'Plugin removed',
    'workflow.created': 'Workflow created',
    'workflow.executing': 'Workflow executing',
    'workflow.completed': 'Workflow completed',
    'workflow.failed': 'Workflow execution failed',
  },
  'ja-JP': {
    'common.ok': 'OK',
    'common.cancel': 'キャンセル',
    'common.save': '保存',
    'common.delete': '削除',
    'common.error': 'エラー',
    'common.success': '成功',
    'common.loading': '読み込み中...',
    'agent.thinking': '思考中...',
    'agent.acting': '実行中...',
    'agent.observing': '観察中...',
    'agent.done': '完了',
    'agent.error': 'エージェントエラー',
    'tool.executing': 'ツール実行中',
    'tool.success': 'ツール実行成功',
    'tool.failed': 'ツール実行失敗',
    'config.saved': '設定保存済み',
    'config.reloaded': '設定リロード済み',
    'channel.connected': 'チャネル接続済み',
    'channel.disconnected': 'チャネル切断',
    'plugin.installed': 'プラグインインストール済み',
    'plugin.removed': 'プラグイン削除済み',
    'workflow.created': 'ワークフロー作成済み',
    'workflow.executing': 'ワークフロー実行中',
    'workflow.completed': 'ワークフロー完了',
    'workflow.failed': 'ワークフロー実行失敗',
  },
};

/**
 * 国际化管理器
 */
export class I18n {
  private currentLanguage: Language;
  private translations: Translations;

  constructor(language: Language = 'zh-CN') {
    this.currentLanguage = language;
    this.translations = languagePacks[language];
  }

  /**
   * 翻译
   */
  t(key: TranslationKey, params?: Record<string, string | number>): string {
    let text = this.translations[key] ?? key;

    // 参数替换
    if (params) {
      for (const [param, value] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
      }
    }

    return text;
  }

  /**
   * 切换语言
   */
  setLanguage(language: Language): void {
    this.currentLanguage = language;
    this.translations = languagePacks[language];
  }

  /**
   * 获取当前语言
   */
  getLanguage(): Language {
    return this.currentLanguage;
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): Language[] {
    return Object.keys(languagePacks) as Language[];
  }

  /**
   * 添加自定义翻译
   */
  addTranslations(language: Language, translations: Partial<Translations>): void {
    if (!languagePacks[language]) {
      languagePacks[language] = { ...translations } as Translations;
    } else {
      Object.assign(languagePacks[language], translations);
    }

    if (language === this.currentLanguage) {
      this.translations = languagePacks[language];
    }
  }
}

/** 全局 i18n 实例 */
export const i18n = new I18n();
