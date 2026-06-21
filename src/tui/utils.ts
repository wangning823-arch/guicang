/**
 * TUI 工具函数
 * 共享的字符宽度计算和字符串处理函数
 */

/**
 * 获取字符的显示宽度
 * 中文字符和全角字符占2个宽度，其他占1个
 */
export function getCharWidth(char: string): number {
  const code = char.codePointAt(0);
  if (!code) return 1;

  // CJK统一汉字及其扩展
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

  // CJK标点和符号
  if (
    (code >= 0x3000 && code <= 0x303F) ||   // CJK符号和标点
    (code >= 0xFF01 && code <= 0xFF60) ||   // 全角ASCII
    (code >= 0xFFE0 && code <= 0xFFE6) ||   // 全角货币
    (code >= 0xFE30 && code <= 0xFE4F) ||   // CJK兼容形式
    (code >= 0x3100 && code <= 0x312F) ||   // 注音符号
    (code >= 0x31A0 && code <= 0x31BF) ||   // 注音扩展
    (code >= 0x3200 && code <= 0x32FF)      // 封闭式CJK文字
  ) {
    return 2;
  }

  // Emoji
  if (
    (code >= 0x1F300 && code <= 0x1F9FF) || // Emoji主区块
    (code >= 0x1FA00 && code <= 0x1FA6F) || // Emoji扩展A
    (code >= 0x1FA70 && code <= 0x1FAFF) || // Emoji扩展B
    (code >= 0x2600 && code <= 0x27BF) ||   // 杂项符号
    (code >= 0x2300 && code <= 0x23FF) ||   // 技术符号
    (code >= 0x2B50 && code <= 0x2B55) ||   // 星号和圆圈
    (code >= 0x203C && code <= 0x3299)      // CJK特殊符号
  ) {
    return 2;
  }

  // 宽字符块元素
  if (
    (code >= 0x2580 && code <= 0x259F) ||   // 块元素
    (code >= 0x25A0 && code <= 0x25FF) ||   // 几何形状
    (code >= 0x2B00 && code <= 0x2BFF)      // 杂项符号和箭头
  ) {
    return 2;
  }

  return 1;
}

/**
 * 获取字符串的显示宽度
 * 忽略 ANSI 转义序列
 */
export function getStringWidth(str: string): number {
  let width = 0;
  let inEscape = false;

  for (const char of str) {
    // 处理ANSI转义序列
    if (char === '\x1b') {
      inEscape = true;
      continue;
    }
    if (inEscape) {
      if (char === 'm') {
        inEscape = false;
      }
      continue;
    }

    width += getCharWidth(char);
  }

  return width;
}

/**
 * 截断字符串到指定宽度
 * 考虑多字节字符和ANSI转义序列
 */
export function truncateString(str: string, maxWidth: number): string {
  let width = 0;
  let result = '';
  let inEscape = false;

  for (const char of str) {
    // 处理ANSI转义序列
    if (char === '\x1b') {
      inEscape = true;
      result += char;
      continue;
    }
    if (inEscape) {
      result += char;
      if (char === 'm') {
        inEscape = false;
      }
      continue;
    }

    const charWidth = getCharWidth(char);
    if (width + charWidth > maxWidth) {
      break;
    }
    result += char;
    width += charWidth;
  }

  return result;
}
