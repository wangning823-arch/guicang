/**
 * 帮助面板
 * 显示快捷键和命令说明
 */

import type { TUIEngine } from '../engine.js';
import { Box as BoxComponent } from '../components/box.js';
import { colorize, Theme } from '../theme.js';

interface HelpSection {
  title: string;
  items: Array<{ key: string; desc: string }>;
}

export class HelpPanel {
  private box: BoxComponent;
  private visible = false;
  private scrollOffset = 0;

  constructor(x: number, y: number, width: number, height: number) {
    this.box = new BoxComponent(
      { x, y, width, height },
      { title: '❓ 帮助', border: true },
    );
  }

  /** 切换显示/隐藏 */
  toggle(): void {
    this.visible = !this.visible;
  }

  /** 显示 */
  show(): void {
    this.visible = true;
  }

  /** 隐藏 */
  hide(): void {
    this.visible = false;
  }

  /** 是否可见 */
  isVisible(): boolean {
    return this.visible;
  }

  /** 获取帮助内容 */
  private getHelpContent(): HelpSection[] {
    return [
      {
        title: '快捷键',
        items: [
          { key: 'F1', desc: '显示/隐藏帮助' },
          { key: 'F5', desc: '刷新所有面板' },
          { key: 'Tab', desc: '切换面板焦点' },
          { key: 'Ctrl+C', desc: '退出 TUI' },
          { key: '↑/↓', desc: '滚动当前面板' },
          { key: 'PgUp/PgDn', desc: '快速滚动' },
        ],
      },
      {
        title: '对话命令',
        items: [
          { key: '/help', desc: '显示帮助' },
          { key: '/clear', desc: '清空对话历史' },
          { key: '/history', desc: '查看对话历史' },
          { key: '/agent list', desc: '列出所有 Agent' },
          { key: '/agent spawn', desc: '创建新 Agent' },
          { key: '/agent kill <id>', desc: '终止 Agent' },
          { key: '/tools', desc: '查看可用工具' },
          { key: '/config', desc: '查看配置' },
          { key: '/config set <key> <value>', desc: '修改配置' },
          { key: '/status', desc: '查看系统状态' },
          { key: '/metrics', desc: '查看性能指标' },
          { key: '/quit', desc: '退出 TUI' },
        ],
      },
      {
        title: '面板说明',
        items: [
          { key: '💬 对话', desc: '与 Agent 交互，显示消息历史' },
          { key: '📊 系统状态', desc: '显示健康状态、内存、CPU' },
          { key: '📈 性能指标', desc: '请求统计、延迟、Token 使用' },
          { key: '🔢 Token 统计', desc: 'Token 用量、成本估算' },
          { key: '🤖 Agent 列表', desc: '运行中的 Agent 状态' },
          { key: '🔧 最近工具', desc: '工具调用记录' },
          { key: '📋 日志', desc: '实时日志流' },
        ],
      },
    ];
  }

  /** 渲染 */
  render(engine: TUIEngine): void {
    if (!this.visible) return;

    this.box.setContent([]);
    const sections = this.getHelpContent();

    for (const section of sections) {
      this.box.appendLine(colorize(`  ${section.title}`, Theme.panelTitle));
      this.box.appendLine(colorize('  ─────────────────────────', Theme.textDim));

      for (const item of section.items) {
        const key = colorize(item.key.padEnd(20), Theme.primary);
        this.box.appendLine(`    ${key} ${item.desc}`);
      }

      this.box.appendLine('');
    }

    this.box.render(engine);
  }
}
