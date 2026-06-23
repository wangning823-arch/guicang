/**
 * Markdown 渲染器
 * 在终端中渲染 Markdown 内容
 */

import { Colors, Theme, colorize, bold, dim } from '../theme.js';
import { getStringWidth, truncateString } from '../utils.js';

/** 渲染后的块 */
export interface RenderedBlock {
  type: 'text' | 'heading' | 'code' | 'list' | 'quote' | 'hr' | 'link';
  content: string;
  level?: number;
  language?: string;
  ordered?: boolean;
}

/** Markdown 渲染器选项 */
export interface MarkdownRendererOptions {
  maxWidth?: number;
  showLineNumbers?: boolean;
  theme?: 'dark' | 'light';
}

/** Markdown 渲染器 */
export class MarkdownRenderer {
  private maxWidth: number;
  private showLineNumbers: boolean;

  constructor(options: MarkdownRendererOptions = {}) {
    this.maxWidth = options.maxWidth ?? 80;
    this.showLineNumbers = options.showLineNumbers ?? false;
  }

  /** 渲染 Markdown 文本 */
  render(text: string): string {
    const blocks = this.parseBlocks(text);
    return blocks.map(block => this.renderBlock(block)).join('\n');
  }

  /** 解析为块 */
  private parseBlocks(text: string): RenderedBlock[] {
    const blocks: RenderedBlock[] = [];
    const lines = text.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // 空行
      if (line.trim() === '') {
        i++;
        continue;
      }

      // 水平分割线
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
        blocks.push({ type: 'hr', content: '' });
        i++;
        continue;
      }

      // 标题
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        blocks.push({
          type: 'heading',
          content: headingMatch[2],
          level: headingMatch[1].length,
        });
        i++;
        continue;
      }

      // 代码块
      if (line.trim().startsWith('```')) {
        const language = line.trim().slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        blocks.push({
          type: 'code',
          content: codeLines.join('\n'),
          language: language || undefined,
        });
        i++; // 跳过结束的 ```
        continue;
      }

      // 引用
      if (line.trim().startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().slice(1).trim());
          i++;
        }
        blocks.push({
          type: 'quote',
          content: quoteLines.join('\n'),
        });
        continue;
      }

      // 列表
      const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)/);
      if (listMatch) {
        const ordered = /^\d+\./.test(listMatch[2]);
        const listItems: string[] = [];
        while (i < lines.length) {
          const itemMatch = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.+)/);
          if (itemMatch) {
            listItems.push(itemMatch[3]);
            i++;
          } else if (lines[i].trim() === '') {
            i++;
          } else {
            break;
          }
        }
        blocks.push({
          type: 'list',
          content: listItems.join('\n'),
          ordered,
        });
        continue;
      }

      // 普通文本
      blocks.push({ type: 'text', content: line });
      i++;
    }

    return blocks;
  }

  /** 渲染单个块 */
  private renderBlock(block: RenderedBlock): string {
    switch (block.type) {
      case 'heading':
        return this.renderHeading(block.content, block.level!);
      case 'code':
        return this.renderCode(block.content, block.language);
      case 'list':
        return this.renderList(block.content, block.ordered!);
      case 'quote':
        return this.renderQuote(block.content);
      case 'hr':
        return this.renderHR();
      case 'text':
      default:
        return this.renderText(block.content);
    }
  }

  /** 渲染标题 */
  private renderHeading(text: string, level: number): string {
    const content = this.renderInline(text);
    switch (level) {
      case 1:
        return `\n${colorize(content, `${Colors.bold}${Colors.brightCyan}`)}\n${colorize('═'.repeat(Math.min(getStringWidth(content), this.maxWidth)), Colors.brightCyan)}`;
      case 2:
        return `\n${colorize(content, `${Colors.bold}${Colors.brightBlue}`)}\n${colorize('─'.repeat(Math.min(getStringWidth(content), this.maxWidth)), Colors.brightBlue)}`;
      case 3:
        return `\n${colorize(content, `${Colors.bold}${Colors.brightMagenta}`)}`;
      case 4:
        return `\n${colorize(content, `${Colors.bold}${Colors.brightYellow}`)}`;
      case 5:
        return `\n${colorize(content, `${Colors.bold}${Colors.brightGreen}`)}`;
      case 6:
        return `\n${colorize(content, `${Colors.bold}${Colors.brightRed}`)}`;
      default:
        return `\n${bold(content)}`;
    }
  }

  /** 渲染代码块 */
  private renderCode(code: string, language?: string): string {
    const lines = code.split('\n');
    const maxLineWidth = Math.max(...lines.map(l => getStringWidth(l)));
    const codeWidth = Math.min(Math.max(maxLineWidth + 2, 20), this.maxWidth);

    const result: string[] = [];

    // 语言标签
    if (language) {
      result.push(colorize(` ${language} `, `${Colors.bgBrightBlack}${Colors.brightWhite}`));
    }

    // 代码内容
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const paddedLine = line.padEnd(maxLineWidth);
      const truncated = truncateString(paddedLine, codeWidth - 2);

      let lineContent = ` ${truncated} `;
      if (this.showLineNumbers) {
        const lineNum = String(i + 1).padStart(3);
        lineContent = ` ${colorize(lineNum, Colors.brightBlack)} ${truncated} `;
      }

      result.push(colorize(lineContent, Colors.bgBlack));
    }

    return result.join('\n');
  }

  /** 渲染列表 */
  private renderList(content: string, ordered: boolean): string {
    const items = content.split('\n');
    return items.map((item, index) => {
      const bullet = ordered ? colorize(`${index + 1}.`, Colors.brightCyan) : colorize('•', Colors.brightCyan);
      return `  ${bullet} ${this.renderInline(item)}`;
    }).join('\n');
  }

  /** 渲染引用 */
  private renderQuote(content: string): string {
    const lines = content.split('\n');
    return lines.map(line => {
      return colorize(` ▎ `, Colors.brightBlue) + colorize(line, Colors.brightBlack);
    }).join('\n');
  }

  /** 渲染水平分割线 */
  private renderHR(): string {
    return colorize('─'.repeat(this.maxWidth), Colors.brightBlack);
  }

  /** 渲染普通文本 */
  private renderText(text: string): string {
    return this.renderInline(text);
  }

  /** 渲染内联样式 */
  private renderInline(text: string): string {
    // 代码
    text = text.replace(/`([^`]+)`/g, (_, code) => {
      return colorize(` ${code} `, `${Colors.bgBrightBlack}${Colors.brightWhite}`);
    });

    // 粗体
    text = text.replace(/\*\*(.+?)\*\*/g, (_, content) => {
      return bold(content);
    });

    // 斜体
    text = text.replace(/\*(.+?)\*/g, (_, content) => {
      return colorize(content, Colors.italic);
    });

    // 删除线
    text = text.replace(/~~(.+?)~~/g, (_, content) => {
      return colorize(content, Colors.strikethrough);
    });

    // 链接
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, display, url) => {
      return colorize(display, Colors.brightCyan) + dim(` (${url})`);
    });

    return text;
  }
}
