/**
 * 对话面板
 * 交互式聊天界面
 */

import type { TUIEngine, KeyEvent } from '../engine.js';
import { Box as BoxComponent } from '../components/box.js';
import { colorize, Theme } from '../theme.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: string;
  }>;
}

export interface ChatPanelOptions {
  onSend?: (message: string) => void;
  onPaste?: (text: string) => void;
}

/**
 * 获取字符的显示宽度（统一版本）
 * 中文字符和全角字符占2个宽度，其他占1个
 */
function getCharWidth(char: string): number {
  const code = char.codePointAt(0);
  if (!code) return 1;

  // ===== CJK 统一汉字及其扩展 =====
  if (
    (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK统一汉字
    (code >= 0x3400 && code <= 0x4DBF) ||   // CJK扩展A
    (code >= 0x20000 && code <= 0x2A6DF) || // CJK扩展B
    (code >= 0x2A700 && code <= 0x2B73F) || // CJK扩展C
    (code >= 0x2B740 && code <= 0x2B81F) || // CJK扩展D
    (code >= 0x2B820 && code <= 0x2CEAF) || // CJK扩展E
    (code >= 0x2CEB0 && code <= 0x2EBEF) || // CJK扩展F
    (code >= 0x30000 && code <= 0x3134F) || // CJK扩展G
    (code >= 0x31350 && code <= 0x323AF) || // CJK扩展H
    (code >= 0xF900 && code <= 0xFAFF) ||   // CJK兼容汉字
    (code >= 0x2F800 && code <= 0x2FA1F)    // CJK兼容补充
  ) {
    return 2;
  }

  // ===== CJK 标点和符号 =====
  if (
    (code >= 0x3000 && code <= 0x303F) ||   // CJK符号和标点（。、！？等）
    (code >= 0xFF01 && code <= 0xFF60) ||   // 全角ASCII
    (code >= 0xFFE0 && code <= 0xFFE6) ||   // 全角货币
    (code >= 0xFE30 && code <= 0xFE4F) ||   // CJK兼容形式
    (code >= 0x3100 && code <= 0x312F) ||   // 注音符号
    (code >= 0x31A0 && code <= 0x31BF) ||   // 注音扩展
    (code >= 0x3200 && code <= 0x32FF) ||   // 封闭式CJK文字
    (code >= 0x3400 && code <= 0x4DBF) ||   // CJK扩展A（重复但无害）
    (code >= 0x4E00 && code <= 0x9FFF)      // CJK统一汉字（重复但无害）
  ) {
    return 2;
  }

  // ===== Emoji =====
  if (
    (code >= 0x1F300 && code <= 0x1F9FF) || // Emoji
    (code >= 0x1FA00 && code <= 0x1FA6F) || // Emoji扩展A
    (code >= 0x1FA70 && code <= 0x1FAFF) || // Emoji扩展B
    (code >= 0x1F600 && code <= 0x1F64F) || // 表情符号
    (code >= 0x1F680 && code <= 0x1F6FF) || // 交通和地图符号
    (code >= 0x1F1E0 && code <= 0x1F1FF) || // 旗帜符号
    (code >= 0x2600 && code <= 0x27BF) ||   // 杂项符号
    (code >= 0x2300 && code <= 0x23FF) ||   // 技术符号
    (code >= 0x2B50 && code <= 0x2B55) ||   // 星号和圆圈
    (code >= 0x203C && code <= 0x3299)      // CJK特殊符号
  ) {
    return 2;
  }

  // ===== 宽字符块元素 =====
  if (
    (code >= 0x2580 && code <= 0x259F) ||   // 块元素（含 █）
    (code >= 0x25A0 && code <= 0x25FF) ||   // 几何形状
    (code >= 0x2B00 && code <= 0x2BFF)      // 杂项符号和箭头
  ) {
    return 2;
  }

  return 1;
}

export class ChatPanel {
  private box: BoxComponent;
  private messages: ChatMessage[] = [];
  private inputBuffer = '';
  private cursorPos = 0;
  private options: ChatPanelOptions;
  private isActive = false;
  private isProcessing = false;
  private inputFixedY: number; // 输入行固定 Y 坐标
  // 输入历史
  private history: string[] = [];
  private historyIndex = -1; // -1 表示当前输入
  private savedInput = ''; // 保存当前未发送的输入
  // 粘贴缓冲
  private pasteBuffer = '';
  private isPasting = false;

  constructor(x: number, y: number, width: number, height: number, options: ChatPanelOptions = {}, accentColor?: string, inputY?: number) {
    this.box = new BoxComponent(
      { x, y, width, height },
      { title: '[CHAT] 对话', border: true, active: false, accentColor },
    );
    this.options = options;
    // 输入行固定在指定位置，或默认在 box 底部
    this.inputFixedY = inputY ?? (y + height - 1);
  }

  /** 添加消息 */
  addMessage(message: ChatMessage): void {
    this.messages.push(message);

    // 格式化消息
    const timestamp = this.formatTime(message.timestamp);
    const roleIcon = message.role === 'user' ? '[U]' : message.role === 'assistant' ? '[AI]' : '[i]';
    const roleColor = message.role === 'user' ? Theme.primary : Theme.secondary;

    // 添加消息头
    this.box.appendLine(
      colorize(`${roleIcon} ${timestamp}`, roleColor),
    );

    // 清理消息内容（去除 markdown 格式）
    const cleanContent = this.stripMarkdown(message.content);

    // 添加消息内容（自动换行）
    const maxLineLength = (this.box as unknown as { rect: { width: number } }).rect.width - 4;
    const lines = this.wrapText(cleanContent, maxLineLength);

    for (const line of lines) {
      this.box.appendLine(`  ${line}`);
    }

    // 添加工具调用信息
    if (message.toolCalls && message.toolCalls.length > 0) {
      for (const tool of message.toolCalls) {
        const toolIcon = tool.result ? '[OK]' : '...';
        this.box.appendLine(
          colorize(`    └─ ${toolIcon} 调用 ${tool.name}`, Theme.textMuted),
        );
      }
    }

    // 添加空行分隔
    this.box.appendLine('');
  }

  /** 清理 markdown 格式 */
  private stripMarkdown(text: string): string {
    return text
      // 移除粗体标记
      .replace(/\*\*(.*?)\*\*/g, '$1')
      // 移除斜体标记
      .replace(/\*(.*?)\*/g, '$1')
      // 移除代码块
      .replace(/```[\s\S]*?```/g, (match) => {
        return match.replace(/```\w*\n?/g, '').replace(/```/g, '');
      })
      // 移除行内代码
      .replace(/`(.*?)`/g, '$1')
      // 移除链接
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // 移除标题标记
      .replace(/^#{1,6}\s+/gm, '')
      // 移除列表标记
      .replace(/^[\s]*[-*+]\s+/gm, '• ')
      .replace(/^[\s]*\d+\.\s+/gm, '  ')
      // 移除引用标记
      .replace(/^>\s+/gm, '')
      // 移除水平线
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // 移除多余的空行
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /** 包装文本 */
  private wrapText(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      // 计算段落的显示宽度
      let lineWidth = 0;
      for (const char of paragraph) {
        lineWidth += getCharWidth(char);
      }

      if (lineWidth <= maxWidth) {
        lines.push(paragraph);
      } else {
        // 按字符宽度换行
        let currentLine = '';
        let currentWidth = 0;

        for (const char of paragraph) {
          const charWidth = getCharWidth(char);

          if (currentWidth + charWidth > maxWidth) {
            // 尝试在空格处换行
            const lastSpace = currentLine.lastIndexOf(' ');
            if (lastSpace > 0 && currentWidth > maxWidth * 0.5) {
              lines.push(currentLine.slice(0, lastSpace));
              currentLine = currentLine.slice(lastSpace + 1);
              currentWidth = 0;
              // 重新计算当前行宽度
              for (const c of currentLine) {
                currentWidth += getCharWidth(c);
              }
            } else {
              lines.push(currentLine);
              currentLine = '';
              currentWidth = 0;
            }
          }

          currentLine += char;
          currentWidth += charWidth;
        }

        if (currentLine) {
          lines.push(currentLine);
        }
      }
    }

    return lines;
  }

  /** 获取字符串显示宽度 */
  private getStringWidth(str: string): number {
    let width = 0;
    for (const char of str) {
      width += getCharWidth(char);
    }
    return width;
  }

  /** 格式化时间 */
  private formatTime(date: Date): string {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  /** 处理键盘输入 */
  handleKey(event: KeyEvent): void {
    if (!this.isActive) return;

    // 处理粘贴
    if (event.key === '\x1b[200~') {
      // 粘贴开始
      this.isPasting = true;
      this.pasteBuffer = '';
      return;
    }
    if (event.key === '\x1b[201~') {
      // 粘贴结束
      this.isPasting = false;
      if (this.pasteBuffer) {
        // 处理粘贴内容
        this.handlePaste(this.pasteBuffer);
      }
      return;
    }
    if (this.isPasting) {
      // 收集粘贴内容
      this.pasteBuffer += event.key;
      return;
    }

    if (event.name === 'return') {
      // 发送消息
      if (this.inputBuffer.trim()) {
        const input = this.inputBuffer.trim();

        // 检查是否是命令
        if (input.startsWith('/')) {
          this.handleCommand(input);
        } else {
          this.options.onSend?.(input);
          this.addMessage({
            role: 'user',
            content: input,
            timestamp: new Date(),
          });
        }

        // 保存到历史
        this.history.push(input);
        this.inputBuffer = '';
        this.cursorPos = 0;
        this.historyIndex = -1;
        this.savedInput = '';
      }
    } else if (event.name === 'up') {
      // 向上浏览历史
      if (this.history.length > 0) {
        if (this.historyIndex === -1) {
          // 保存当前输入
          this.savedInput = this.inputBuffer;
          this.historyIndex = this.history.length - 1;
        } else if (this.historyIndex > 0) {
          this.historyIndex--;
        }
        this.inputBuffer = this.history[this.historyIndex];
        this.cursorPos = this.inputBuffer.length;
      }
    } else if (event.name === 'down') {
      // 向下浏览历史
      if (this.historyIndex !== -1) {
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          this.inputBuffer = this.history[this.historyIndex];
        } else {
          // 恢复保存的输入
          this.historyIndex = -1;
          this.inputBuffer = this.savedInput;
        }
        this.cursorPos = this.inputBuffer.length;
      }
    } else if (event.name === 'backspace') {
      // 删除字符
      if (this.cursorPos > 0) {
        this.inputBuffer = this.inputBuffer.slice(0, this.cursorPos - 1) + this.inputBuffer.slice(this.cursorPos);
        this.cursorPos--;
      }
    } else if (event.name === 'delete') {
      // 删除光标后的字符
      if (this.cursorPos < this.inputBuffer.length) {
        this.inputBuffer = this.inputBuffer.slice(0, this.cursorPos) + this.inputBuffer.slice(this.cursorPos + 1);
      }
    } else if (event.name === 'left') {
      // 光标左移
      if (this.cursorPos > 0) {
        this.cursorPos--;
      }
    } else if (event.name === 'right') {
      // 光标右移
      if (this.cursorPos < this.inputBuffer.length) {
        this.cursorPos++;
      }
    } else if (event.name === 'home') {
      // 光标移到行首
      this.cursorPos = 0;
    } else if (event.name === 'end') {
      // 光标移到行尾
      this.cursorPos = this.inputBuffer.length;
    } else if (event.ctrl && event.name === 'a') {
      // Ctrl+A: 光标移到行首
      this.cursorPos = 0;
    } else if (event.ctrl && event.name === 'e') {
      // Ctrl+E: 光标移到行尾
      this.cursorPos = this.inputBuffer.length;
    } else if (event.ctrl && event.name === 'u') {
      // Ctrl+U: 清空当前行
      this.inputBuffer = '';
      this.cursorPos = 0;
    } else if (event.ctrl && event.name === 'k') {
      // Ctrl+K: 删除到行尾
      this.inputBuffer = this.inputBuffer.slice(0, this.cursorPos);
    } else if (event.ctrl && event.name === 'w') {
      // Ctrl+W: 删除前一个单词
      if (this.cursorPos > 0) {
        let pos = this.cursorPos - 1;
        while (pos > 0 && this.inputBuffer[pos - 1] === ' ') pos--;
        while (pos > 0 && this.inputBuffer[pos - 1] !== ' ') pos--;
        this.inputBuffer = this.inputBuffer.slice(0, pos) + this.inputBuffer.slice(this.cursorPos);
        this.cursorPos = pos;
      }
    } else if (event.key && !event.ctrl && !event.meta && event.key.length === 1) {
      // 输入字符
      this.inputBuffer = this.inputBuffer.slice(0, this.cursorPos) + event.key + this.inputBuffer.slice(this.cursorPos);
      this.cursorPos++;
    }
  }

  /** 设置激活状态 */
  setActive(active: boolean): void {
    this.isActive = active;
    (this.box as unknown as { options: { active: boolean } }).options.active = active;
  }

  /** 设置处理状态 */
  setProcessing(processing: boolean): void {
    this.isProcessing = processing;
  }

  /** 渲染 */
  render(engine: TUIEngine): void {
    this.box.render(engine);

    // 渲染输入框（固定位置）
    const inputY = this.inputFixedY;
    const inputX = this.box.rect.x + 1;
    const inputWidth = this.box.rect.width - 2;

    // 调试：显示 inputY 位置
    engine.putColorText(0, 0, ` inputY=${inputY} box.y=${this.box.rect.y} box.h=${this.box.rect.height} `, '\x1b[91m');

    // 清空输入行
    engine.fillRect({ x: inputX, y: inputY, width: inputWidth, height: 1 }, ' ');

    if (this.isProcessing) {
      // 显示处理中状态
      const loadingText = '... 正在思考 ...';
      engine.putColorText(inputX, inputY, colorize(loadingText, Theme.warning), Theme.warning);
    } else {
      // 绘制输入提示（显示历史索引）
      let prompt = '> ';
      if (this.historyIndex !== -1) {
        prompt = `[${this.historyIndex + 1}/${this.history.length}] `;
      }
      const promptWidth = this.getStringWidth(prompt);
      engine.putColorText(inputX, inputY, colorize(prompt, this.isActive ? Theme.accent : Theme.textMuted), Theme.accent);

      // 计算可用宽度（减去提示符宽度）
      const availableWidth = inputWidth - promptWidth;

      // 计算光标位置
      let cursorWidth = 0;
      for (let i = 0; i < this.cursorPos && i < this.inputBuffer.length; i++) {
        cursorWidth += getCharWidth(this.inputBuffer[i]);
      }

      // 计算水平滚动偏移
      let scrollOffset = 0;
      if (cursorWidth >= availableWidth) {
        scrollOffset = cursorWidth - availableWidth + 1;
      }

      // 截取输入内容到可用宽度（考虑滚动）
      let displayInput = '';
      let currentWidth = 0;
      let displayedWidth = 0;
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const char = this.inputBuffer[i];
        const charWidth = getCharWidth(char);

        // 跳过滚动前的字符
        if (currentWidth < scrollOffset) {
          currentWidth += charWidth;
          continue;
        }

        // 检查是否超出可用宽度
        if (displayedWidth + charWidth > availableWidth) break;

        displayInput += char;
        displayedWidth += charWidth;
      }

      // 绘制输入内容
      engine.putColorText(inputX + promptWidth, inputY, displayInput, Theme.text);

      // 绘制光标
      if (this.isActive) {
        const cursorX = inputX + promptWidth + cursorWidth - scrollOffset;
        if (cursorX >= inputX + promptWidth && cursorX < inputX + inputWidth) {
          engine.putChar(cursorX, inputY, '_', Theme.accent);
        }
      }
    }
  }

  /** 处理粘贴 */
  private handlePaste(text: string): void {
    // 移除可能的换行符
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 如果是单行，直接插入
    if (!cleanText.includes('\n')) {
      this.inputBuffer = this.inputBuffer.slice(0, this.cursorPos) + cleanText + this.inputBuffer.slice(this.cursorPos);
      this.cursorPos += cleanText.length;
      return;
    }

    // 多行粘贴：第一行插入到当前输入，后续行作为新消息发送
    const lines = cleanText.split('\n');
    if (lines.length > 0) {
      // 第一行追加到当前输入
      this.inputBuffer = this.inputBuffer.slice(0, this.cursorPos) + lines[0] + this.inputBuffer.slice(this.cursorPos);
      this.cursorPos += lines[0].length;
    }

    // 后续行逐行发送
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        this.options.onSend?.(line);
        this.addMessage({
          role: 'user',
          content: line,
          timestamp: new Date(),
        });
        this.history.push(line);
      }
    }
  }

  /** 处理命令 */
  private handleCommand(input: string): void {
    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case '/help':
        this.addMessage({
          role: 'system',
          content: this.getHelpText(),
          timestamp: new Date(),
        });
        break;

      case '/clear':
        this.clearHistory();
        this.addMessage({
          role: 'system',
          content: '对话已清空',
          timestamp: new Date(),
        });
        break;

      case '/status':
        this.addMessage({
          role: 'system',
          content: '系统状态: 正常运行中\n内存: 正常\nCPU: 正常',
          timestamp: new Date(),
        });
        break;

      case '/config':
        if (args[0] === 'set' && args.length >= 3) {
          this.addMessage({
            role: 'system',
            content: `配置已更新: ${args[1]} = ${args.slice(2).join(' ')}`,
            timestamp: new Date(),
          });
        } else {
          this.addMessage({
            role: 'system',
            content: this.getConfigText(),
            timestamp: new Date(),
          });
        }
        break;

      case '/history':
        if (this.messages.length === 0) {
          this.addMessage({
            role: 'system',
            content: '暂无对话历史',
            timestamp: new Date(),
          });
        } else {
          const historyText = this.messages
            .map((m, i) => `${i + 1}. [${m.role}] ${m.content.slice(0, 50)}...`)
            .join('\n');
          this.addMessage({
            role: 'system',
            content: historyText,
            timestamp: new Date(),
          });
        }
        break;

      case '/quit':
        this.addMessage({
          role: 'system',
          content: '正在退出...',
          timestamp: new Date(),
        });
        // 延迟退出，让用户看到消息
        setTimeout(() => process.exit(0), 500);
        break;

      default:
        this.addMessage({
          role: 'system',
          content: `未知命令: ${cmd}\n输入 /help 查看可用命令`,
          timestamp: new Date(),
        });
    }
  }

  /** 获取帮助文本 */
  private getHelpText(): string {
    return `
可用命令:
  /help          - 显示此帮助
  /clear         - 清空对话历史
  /history       - 查看对话历史
  /status        - 查看系统状态
  /config        - 查看配置
  /config set X Y - 修改配置
  /quit          - 退出 TUI

快捷键:
  Up/Down        - 浏览输入历史
  Ctrl+A         - 光标移到行首
  Ctrl+E         - 光标移到行尾
  Ctrl+U         - 清空当前行
  Ctrl+K         - 删除到行尾
  Ctrl+W         - 删除前一个单词
  F1             - 显示帮助
  Tab            - 切换面板焦点
  Ctrl+C         - 退出
`.trim();
  }

  /** 获取配置文本 */
  private getConfigText(): string {
    return `
当前配置:
  主题: 默认
  语言: 中文
  自动保存: 启用
  提示音: 关闭
`.trim();
  }

  /** 获取输入内容 */
  getInput(): string {
    return this.inputBuffer;
  }

  /** 清空输入 */
  clearInput(): void {
    this.inputBuffer = '';
    this.cursorPos = 0;
  }

  /** 清空对话历史 */
  clearHistory(): void {
    this.messages = [];
    this.history = [];
    this.historyIndex = -1;
    this.savedInput = '';
    this.box.setContent([]);
  }

  /** 获取对话历史 */
  getMessages(): ChatMessage[] {
    return this.messages;
  }
}
