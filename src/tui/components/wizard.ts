/**
 * 首次运行向导
 * 引导用户完成初始配置
 */

import { TUIEngine, type KeyEvent, type Rect } from '../engine.js';
import { Colors, Theme, colorize, dim, bold } from '../theme.js';
import { getStringWidth, truncateString } from '../utils.js';

/** 向导步骤 */
export interface WizardStep {
  id: string;
  title: string;
  description: string;
  options?: WizardOption[];
  input?: {
    placeholder?: string;
    default?: string;
    type?: 'text' | 'password';
  };
  validation?: (value: string) => boolean | string;
}

/** 向导选项 */
export interface WizardOption {
  label: string;
  value: string;
  description?: string;
  icon?: string;
}

/** 向导结果 */
export interface WizardResult {
  [key: string]: string;
}

/** 向导选项 */
export interface WizardOptions {
  rect: Rect;
  steps?: WizardStep[];
}

/** 首次运行向导 */
export class WelcomeWizard {
  private engine: TUIEngine;
  private rect: Rect;
  private steps: WizardStep[];
  private currentStep: number = 0;
  private result: WizardResult = {};
  private selectedIndex: number = 0;
  private inputValue: string = '';
  private isComplete: boolean = false;
  private onComplete?: (result: WizardResult) => void;
  private onCancel?: () => void;

  constructor(engine: TUIEngine, options: WizardOptions) {
    this.engine = engine;
    this.rect = options.rect;
    this.steps = options.steps || this.getDefaultSteps();
  }

  /** 获取默认步骤 */
  private getDefaultSteps(): WizardStep[] {
    return [
      {
        id: 'welcome',
        title: '欢迎使用归藏',
        description: '这是一个自托管的 AI Agent 框架\n让我们完成一些基本配置',
        options: [
          { label: '开始配置', value: 'start', icon: '🚀' },
          { label: '跳过向导', value: 'skip', icon: '⏭️' },
        ],
      },
      {
        id: 'theme',
        title: '选择主题',
        description: '选择您喜欢的界面主题',
        options: [
          { label: '深色主题', value: 'dark', icon: '🌙', description: '适合夜间使用' },
          { label: '浅色主题', value: 'light', icon: '☀️', description: '适合日间使用' },
        ],
      },
      {
        id: 'keybinding',
        title: '快捷键偏好',
        description: '选择您熟悉的快捷键方案',
        options: [
          { label: '默认方案', value: 'default', icon: '⌨️', description: '标准快捷键' },
          { label: 'Vim 方案', value: 'vim', icon: '📝', description: 'Vim 风格快捷键' },
          { label: 'Emacs 方案', value: 'emacs', icon: '🔧', description: 'Emacs 风格快捷键' },
        ],
      },
      {
        id: 'model',
        title: '默认模型',
        description: '选择默认的 AI 模型',
        options: [
          { label: 'Mimo v2.5', value: 'mimo-v2.5', icon: '🤖', description: '推荐模型' },
          { label: 'Claude 3.5 Sonnet', value: 'claude-3.5-sonnet', icon: '🧠', description: '高质量模型' },
          { label: 'GPT-4', value: 'gpt-4', icon: '💡', description: 'OpenAI 模型' },
        ],
      },
      {
        id: 'apikey',
        title: 'API Key',
        description: '输入您的 API Key（可稍后配置）',
        input: {
          placeholder: 'sk-...',
          type: 'password',
        },
      },
      {
        id: 'complete',
        title: '配置完成！',
        description: '所有配置已完成\n按 Enter 开始使用归藏',
        options: [
          { label: '开始使用', value: 'finish', icon: '✨' },
        ],
      },
    ];
  }

  /** 启动向导 */
  start(): void {
    this.currentStep = 0;
    this.result = {};
    this.isComplete = false;
  }

  /** 渲染向导 */
  render(): void {
    const { x, y, width, height } = this.rect;

    // 清空区域
    this.engine.fillRect(this.rect, ' ', Colors.white);

    // 绘制边框
    this.engine.drawBox(this.rect, Colors.brightCyan);

    // 标题
    const title = `🚀 归藏设置向导`;
    const titleX = x + Math.floor((width - getStringWidth(title)) / 2);
    this.engine.putColorText(titleX, y, colorize(title, `${Colors.bold}${Colors.brightCyan}`));

    // 进度指示器
    const progress = `步骤 ${this.currentStep + 1}/${this.steps.length}`;
    this.engine.putColorText(x + width - getStringWidth(progress) - 2, y + 1, dim(progress));

    const step = this.steps[this.currentStep];
    if (!step) return;

    // 步骤标题
    const stepTitle = step.title;
    this.engine.putColorText(x + 2, y + 3, colorize(stepTitle, `${Colors.bold}${Colors.brightWhite}`));

    // 步骤描述
    const descLines = step.description.split('\n');
    for (let i = 0; i < descLines.length; i++) {
      this.engine.putColorText(x + 2, y + 5 + i, dim(descLines[i]));
    }

    // 选项或输入框
    if (step.options) {
      for (let i = 0; i < step.options.length; i++) {
        const option = step.options[i];
        const isSelected = i === this.selectedIndex;
        const optionY = y + 7 + descLines.length + i;

        let line = '';
        if (isSelected) {
          line = colorize(` ▸ ${option.icon || '○'} ${option.label}`, Colors.brightWhite);
        } else {
          line = `   ${option.icon || '○'} ${option.label}`;
        }

        if (option.description) {
          line += dim(` - ${option.description}`);
        }

        this.engine.putColorText(x + 2, optionY, line);
      }
    } else if (step.input) {
      const inputY = y + 7 + descLines.length;
      const prompt = '> ';
      this.engine.putColorText(x + 2, inputY, colorize(prompt, Colors.brightCyan));

      const displayValue = step.input.type === 'password'
        ? '•'.repeat(this.inputValue.length)
        : this.inputValue;

      this.engine.putColorText(x + 4, inputY, colorize(displayValue + '█', Colors.white));
    }

    // 底部提示
    const helpText = '↑↓:选择  Enter:确认  Esc:取消';
    this.engine.putColorText(x + 2, y + height - 2, dim(helpText));
  }

  /** 处理按键 */
  handleKey(event: KeyEvent): boolean {
    if (this.isComplete) {
      return false;
    }

    const step = this.steps[this.currentStep];
    if (!step) return false;

    // Esc 取消
    if (event.name === 'escape') {
      if (this.onCancel) {
        this.onCancel();
      }
      return true;
    }

    // 选项模式
    if (step.options) {
      return this.handleOptionsKey(event, step);
    }

    // 输入模式
    if (step.input) {
      return this.handleInputKey(event, step);
    }

    return false;
  }

  /** 处理选项按键 */
  private handleOptionsKey(event: KeyEvent, step: WizardStep): boolean {
    if (!step.options) return false;

    if (event.name === 'up') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      return true;
    }

    if (event.name === 'down') {
      this.selectedIndex = Math.min(step.options.length - 1, this.selectedIndex + 1);
      return true;
    }

    if (event.name === 'return') {
      const option = step.options[this.selectedIndex];
      this.result[step.id] = option.value;

      // 检查是否跳过
      if (option.value === 'skip') {
        this.complete();
        return true;
      }

      // 检查是否完成
      if (option.value === 'finish') {
        this.complete();
        return true;
      }

      // 下一步
      this.nextStep();
      return true;
    }

    return false;
  }

  /** 处理输入按键 */
  private handleInputKey(event: KeyEvent, step: WizardStep): boolean {
    if (event.name === 'return') {
      // 验证
      if (step.validation) {
        const result = step.validation(this.inputValue);
        if (typeof result === 'string') {
          // 显示错误，继续输入
          return true;
        }
      }

      this.result[step.id] = this.inputValue;
      this.inputValue = '';
      this.nextStep();
      return true;
    }

    if (event.name === 'backspace') {
      this.inputValue = this.inputValue.slice(0, -1);
      return true;
    }

    if (event.key && !event.ctrl && !event.meta && event.key.length === 1) {
      this.inputValue += event.key;
      return true;
    }

    return false;
  }

  /** 下一步 */
  private nextStep(): void {
    this.currentStep++;
    this.selectedIndex = 0;
    this.inputValue = '';

    if (this.currentStep >= this.steps.length) {
      this.complete();
    }
  }

  /** 完成向导 */
  private complete(): void {
    this.isComplete = true;
    if (this.onComplete) {
      this.onComplete(this.result);
    }
  }

  /** 设置完成回调 */
  onComplete(callback: (result: WizardResult) => void): void {
    this.onComplete = callback;
  }

  /** 设置取消回调 */
  onCancel(callback: () => void): void {
    this.onCancel = callback;
  }

  /** 获取结果 */
  getResult(): WizardResult {
    return { ...this.result };
  }

  /** 检查是否完成 */
  isFinished(): boolean {
    return this.isComplete;
  }

  /** 获取当前步骤索引 */
  getCurrentStep(): number {
    return this.currentStep;
  }

  /** 获取总步骤数 */
  getTotalSteps(): number {
    return this.steps.length;
  }
}
