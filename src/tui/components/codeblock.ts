/**
 * 代码块组件
 * 带语法高亮的代码渲染
 */

import { Colors, colorize } from '../theme.js';
import { getStringWidth, truncateString } from '../utils.js';

/** 语言规则 */
interface LanguageRules {
  keywords: string[];
  strings: string[];
  comments: string[];
  numbers: string[];
  functions: string[];
  types: string[];
  operators: string[];
}

/** 高亮结果 */
interface HighlightedToken {
  text: string;
  type: 'keyword' | 'string' | 'comment' | 'number' | 'function' | 'type' | 'operator' | 'plain';
}

/** 代码块选项 */
export interface CodeBlockOptions {
  maxWidth?: number;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  language?: string;
}

/** 代码块组件 */
export class CodeBlock {
  private maxWidth: number;
  private showLineNumbers: boolean;
  private highlightLines: number[];

  constructor(options: CodeBlockOptions = {}) {
    this.maxWidth = options.maxWidth ?? 80;
    this.showLineNumbers = options.showLineNumbers ?? false;
    this.highlightLines = options.highlightLines ?? [];
  }

  /** 渲染代码块 */
  render(code: string, language?: string): string {
    const lines = code.split('\n');
    const lang = language?.toLowerCase();
    const rules = lang ? this.getLanguageRules(lang) : null;

    const result: string[] = [];

    // 语言标签
    if (lang) {
      result.push(colorize(` ${lang} `, `${Colors.bgBrightBlack}${Colors.brightWhite}`));
    }

    // 计算行号宽度
    const lineNumWidth = String(lines.length).length;

    // 渲染每行
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const isHighlighted = this.highlightLines.includes(lineNum);

      let lineContent = '';
      if (this.showLineNumbers) {
        const num = String(lineNum).padStart(lineNumWidth);
        const numColor = isHighlighted ? Colors.brightYellow : Colors.brightBlack;
        lineContent += colorize(`${num} `, numColor);
      }

      if (rules) {
        lineContent += this.highlightLine(line, rules);
      } else {
        lineContent += line;
      }

      // 截断长行
      const truncated = truncateString(lineContent, this.maxWidth - (this.showLineNumbers ? lineNumWidth + 2 : 0));
      result.push(truncated);
    }

    return result.join('\n');
  }

  /** 高亮单行代码 */
  private highlightLine(line: string, rules: LanguageRules): string {
    const tokens = this.tokenize(line, rules);
    return tokens.map(token => this.colorizeToken(token)).join('');
  }

  /** 分词 */
  private tokenize(line: string, rules: LanguageRules): HighlightedToken[] {
    const tokens: HighlightedToken[] = [];
    let remaining = line;

    while (remaining.length > 0) {
      let matched = false;

      // 检查注释
      for (const comment of rules.comments) {
        if (remaining.startsWith(comment)) {
          tokens.push({ text: remaining, type: 'comment' });
          remaining = '';
          matched = true;
          break;
        }
      }
      if (matched) continue;

      // 检查字符串
      for (const str of rules.strings) {
        const strMatch = remaining.match(new RegExp(`^${str}([^${str}]*?)${str}`));
        if (strMatch) {
          tokens.push({ text: strMatch[0], type: 'string' });
          remaining = remaining.slice(strMatch[0].length);
          matched = true;
          break;
        }
      }
      if (matched) continue;

      // 检查数字
      const numMatch = remaining.match(/^\b(\d+\.?\d*)\b/);
      if (numMatch) {
        tokens.push({ text: numMatch[0], type: 'number' });
        remaining = remaining.slice(numMatch[0].length);
        continue;
      }

      // 检查函数名
      const funcMatch = remaining.match(/^([a-zA-Z_]\w*)\s*\(/);
      if (funcMatch) {
        if (rules.functions.includes(funcMatch[1]) || rules.keywords.includes(funcMatch[1])) {
          tokens.push({ text: funcMatch[1], type: 'keyword' });
        } else {
          tokens.push({ text: funcMatch[1], type: 'function' });
        }
        remaining = remaining.slice(funcMatch[1].length);
        continue;
      }

      // 检查类型
      const typeMatch = remaining.match(/^([A-Z][a-zA-Z0-9]*)\b/);
      if (typeMatch && rules.types.some(t => t === typeMatch[1])) {
        tokens.push({ text: typeMatch[1], type: 'type' });
        remaining = remaining.slice(typeMatch[1].length);
        continue;
      }

      // 检查关键字
      const keywordMatch = remaining.match(/^([a-zA-Z_]\w*)\b/);
      if (keywordMatch && rules.keywords.includes(keywordMatch[1])) {
        tokens.push({ text: keywordMatch[1], type: 'keyword' });
        remaining = remaining.slice(keywordMatch[1].length);
        continue;
      }

      // 检查运算符
      const opMatch = remaining.match(/^[+\-*/%=<>!&|^~?:]+/);
      if (opMatch && rules.operators.some(op => opMatch[0].includes(op))) {
        tokens.push({ text: opMatch[0], type: 'operator' });
        remaining = remaining.slice(opMatch[0].length);
        continue;
      }

      // 普通字符
      tokens.push({ text: remaining[0], type: 'plain' });
      remaining = remaining.slice(1);
    }

    return tokens;
  }

  /** 给 token 着色 */
  private colorizeToken(token: HighlightedToken): string {
    switch (token.type) {
      case 'keyword':
        return colorize(token.text, Colors.brightMagenta);
      case 'string':
        return colorize(token.text, Colors.brightGreen);
      case 'comment':
        return colorize(token.text, Colors.brightBlack);
      case 'number':
        return colorize(token.text, Colors.brightYellow);
      case 'function':
        return colorize(token.text, Colors.brightBlue);
      case 'type':
        return colorize(token.text, Colors.brightCyan);
      case 'operator':
        return colorize(token.text, Colors.brightRed);
      default:
        return token.text;
    }
  }

  /** 获取语言规则 */
  private getLanguageRules(language: string): LanguageRules | null {
    const rules: Record<string, LanguageRules> = {
      typescript: {
        keywords: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'class', 'extends', 'implements', 'interface', 'type', 'enum', 'import', 'export', 'from', 'default', 'new', 'this', 'super', 'typeof', 'instanceof', 'in', 'of', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'void', 'null', 'undefined', 'true', 'false'],
        strings: ['"', "'", '`'],
        comments: ['//', '/*'],
        numbers: [],
        functions: ['console', 'log', 'error', 'warn', 'info', 'debug', 'require', 'import'],
        types: ['string', 'number', 'boolean', 'any', 'void', 'never', 'object', 'Array', 'Map', 'Set', 'Promise', 'Record'],
        operators: ['+', '-', '*', '/', '%', '=', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '&&', '||', '!', '&', '|', '^', '~', '?', ':'],
      },
      javascript: {
        keywords: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'class', 'extends', 'import', 'export', 'from', 'default', 'new', 'this', 'super', 'typeof', 'instanceof', 'in', 'of', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'void', 'null', 'undefined', 'true', 'false'],
        strings: ['"', "'", '`'],
        comments: ['//', '/*'],
        numbers: [],
        functions: ['console', 'log', 'error', 'warn', 'info', 'debug', 'require', 'import'],
        types: [],
        operators: ['+', '-', '*', '/', '%', '=', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '&&', '||', '!', '&', '|', '^', '~', '?', ':'],
      },
      python: {
        keywords: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'yield', 'lambda', 'pass', 'del', 'global', 'nonlocal', 'assert', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is'],
        strings: ['"', "'"],
        comments: ['#'],
        numbers: [],
        functions: ['print', 'len', 'range', 'int', 'str', 'float', 'list', 'dict', 'set', 'tuple', 'type'],
        types: ['int', 'str', 'float', 'bool', 'list', 'dict', 'set', 'tuple', 'None', 'Any', 'Optional', 'Union', 'List', 'Dict', 'Set', 'Tuple'],
        operators: ['+', '-', '*', '/', '%', '=', '==', '!=', '<', '>', '<=', '>=', 'and', 'or', 'not', '&', '|', '^', '~', ':'],
      },
      bash: {
        keywords: ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function', 'return', 'exit', 'local', 'export', 'source', 'alias', 'unalias', 'set', 'unset', 'shift'],
        strings: ['"', "'"],
        comments: ['#'],
        numbers: [],
        functions: ['echo', 'cd', 'ls', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'grep', 'sed', 'awk', 'find', 'xargs', 'chmod', 'chown', 'sudo', 'apt', 'yum', 'brew', 'git', 'npm', 'node', 'python'],
        types: [],
        operators: ['=', '==', '!=', '-eq', '-ne', '-lt', '-le', '-gt', '-ge', '-a', '-o', '-f', '-d', '-e', '-z', '-n'],
      },
      json: {
        keywords: ['true', 'false', 'null'],
        strings: ['"'],
        comments: [],
        numbers: [],
        functions: [],
        types: [],
        operators: [':', ','],
      },
      go: {
        keywords: ['package', 'import', 'func', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'default', 'break', 'continue', 'go', 'defer', 'select', 'chan', 'var', 'const', 'type', 'struct', 'interface', 'map', 'make', 'new', 'len', 'cap', 'append', 'copy', 'delete', 'close', 'panic', 'recover', 'error', 'true', 'false', 'nil'],
        strings: ['"', '`'],
        comments: ['//', '/*'],
        numbers: [],
        functions: ['fmt', 'Println', 'Printf', 'Print', 'Errorf', 'Sprintf', 'Sscanf'],
        types: ['string', 'int', 'int8', 'int16', 'int32', 'int64', 'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'float32', 'float64', 'bool', 'byte', 'rune', 'error', 'any'],
        operators: ['+', '-', '*', '/', '%', '=', '==', '!=', '<', '>', '<=', '>=', '&&', '||', '!', '&', '|', '^', '~', ':', '<-', '...'],
      },
      rust: {
        keywords: ['fn', 'let', 'mut', 'const', 'return', 'if', 'else', 'for', 'while', 'loop', 'break', 'continue', 'match', 'struct', 'enum', 'impl', 'trait', 'pub', 'use', 'mod', 'crate', 'self', 'super', 'where', 'async', 'await', 'move', 'ref', 'as', 'in', 'true', 'false', 'Some', 'None', 'Ok', 'Err', 'Self'],
        strings: ['"', "'"],
        comments: ['//', '/*'],
        numbers: [],
        functions: ['println!', 'print!', 'eprintln!', 'eprint!', 'format!', 'vec!', 'assert!', 'assert_eq!', 'assert_ne!', 'dbg!', 'todo!', 'unimplemented!', 'panic!'],
        types: ['i8', 'i16', 'i32', 'i64', 'i128', 'isize', 'u8', 'u16', 'u32', 'u64', 'u128', 'usize', 'f32', 'f64', 'bool', 'char', 'str', 'String', 'Vec', 'Option', 'Result', 'Box', 'Rc', 'Arc'],
        operators: ['+', '-', '*', '/', '%', '=', '==', '!=', '<', '>', '<=', '>=', '&&', '||', '!', '&', '|', '^', '~', ':', '->', '=>', '..', '..='],
      },
    };

    return rules[language] || null;
  }
}
