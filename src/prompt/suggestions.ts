/**
 * 智能提示系统
 * 上下文感知的命令建议
 */

/** 建议类型 */
export type SuggestionType = 'command' | 'tool' | 'config' | 'workflow' | 'help';

/** 建议项 */
export interface Suggestion {
  id: string;
  type: SuggestionType;
  label: string;
  description: string;
  command?: string;
  icon: string;
  priority: number;
  context?: string[];
}

/** 上下文信息 */
export interface PromptContext {
  currentInput: string;
  recentCommands: string[];
  activeTools: string[];
  userProfile?: string;
}

/**
 * 智能提示系统
 */
export class SmartPrompt {
  private suggestions: Suggestion[] = [];
  private commandHistory: string[] = [];

  constructor() {
    this.loadDefaultSuggestions();
  }

  /**
   * 获取建议
   */
  getSuggestions(context: PromptContext): Suggestion[] {
    const input = context.currentInput.toLowerCase();

    // 过滤和排序建议
    let filtered = this.suggestions.filter((s) => {
      // 如果有输入，检查是否匹配
      if (input) {
        return (
          s.label.toLowerCase().includes(input) ||
          s.description.toLowerCase().includes(input) ||
          s.command?.toLowerCase().includes(input)
        );
      }
      return true;
    });

    // 按优先级排序
    filtered.sort((a, b) => b.priority - a.priority);

    // 根据上下文调整优先级
    if (context.recentCommands.length > 0) {
      filtered = this.boostByRecentCommands(filtered, context.recentCommands);
    }

    return filtered.slice(0, 10);
  }

  /**
   * 添加到历史
   */
  addToHistory(command: string): void {
    this.commandHistory.push(command);
    if (this.commandHistory.length > 100) {
      this.commandHistory.shift();
    }
  }

  /**
   * 获取历史命令
   */
  getHistory(limit = 20): string[] {
    return this.commandHistory.slice(-limit);
  }

  /**
   * 获取热门命令
   */
  getPopularCommands(limit = 10): Array<{ command: string; count: number }> {
    const counts = new Map<string, number>();
    for (const cmd of this.commandHistory) {
      counts.set(cmd, (counts.get(cmd) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * 添加自定义建议
   */
  addSuggestion(suggestion: Suggestion): void {
    this.suggestions.push(suggestion);
  }

  /**
   * 移除建议
   */
  removeSuggestion(id: string): boolean {
    const before = this.suggestions.length;
    this.suggestions = this.suggestions.filter((s) => s.id !== id);
    return this.suggestions.length < before;
  }

  /**
   * 根据最近命令提升优先级
   */
  private boostByRecentCommands(
    suggestions: Suggestion[],
    recentCommands: string[],
  ): Suggestion[] {
    const recentSet = new Set(recentCommands.slice(-5));

    return suggestions.map((s) => {
      const boost = recentSet.has(s.command ?? '') ? 2 : 0;
      return { ...s, priority: s.priority + boost };
    });
  }

  /**
   * 加载默认建议
   */
  private loadDefaultSuggestions(): void {
    this.suggestions = [
      // 工具相关
      {
        id: 'tool-file-read',
        type: 'tool',
        label: '读取文件',
        description: '读取本地文件内容',
        command: 'read_file',
        icon: '📄',
        priority: 8,
      },
      {
        id: 'tool-shell',
        type: 'tool',
        label: '执行命令',
        description: '执行 Shell 命令',
        command: 'shell',
        icon: '💻',
        priority: 9,
      },
      {
        id: 'tool-web-search',
        type: 'tool',
        label: '搜索网页',
        description: '搜索互联网信息',
        command: 'web_search',
        icon: '🔍',
        priority: 7,
      },

      // 配置相关
      {
        id: 'config-provider',
        type: 'config',
        label: '切换提供商',
        description: '切换 LLM 提供商',
        command: 'provider',
        icon: '⚙️',
        priority: 5,
      },
      {
        id: 'config-model',
        type: 'config',
        label: '切换模型',
        description: '切换 LLM 模型',
        command: 'model',
        icon: '🤖',
        priority: 6,
      },
      {
        id: 'config-temperature',
        type: 'config',
        label: '调整温度',
        description: '调整生成温度参数',
        command: 'temperature',
        icon: '🌡️',
        priority: 4,
      },

      // 工作流相关
      {
        id: 'workflow-create',
        type: 'workflow',
        label: '创建工作流',
        description: '创建新的工作流',
        command: 'create_workflow',
        icon: '🔄',
        priority: 6,
      },
      {
        id: 'workflow-run',
        type: 'workflow',
        label: '运行工作流',
        description: '执行现有工作流',
        command: 'run_workflow',
        icon: '▶️',
        priority: 7,
      },

      // 帮助
      {
        id: 'help-commands',
        type: 'help',
        label: '查看命令列表',
        description: '显示所有可用命令',
        command: '/help',
        icon: '❓',
        priority: 3,
      },
      {
        id: 'help-status',
        type: 'help',
        label: '查看系统状态',
        description: '显示当前系统状态',
        command: '/status',
        icon: '📊',
        priority: 3,
      },
    ];
  }
}

/** 全局智能提示系统 */
export const smartPrompt = new SmartPrompt();
