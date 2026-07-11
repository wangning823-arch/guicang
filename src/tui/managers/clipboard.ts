/**
 * 剪贴板管理器
 * 系统剪贴板和内部剪贴板集成
 */

import { execSync } from 'node:child_process';

/** 剪贴板管理器 */
export class ClipboardManager {
  private internalBuffer: string[] = [];
  private maxHistory: number = 20;
  private listeners: Array<(text: string) => void> = [];

  constructor(maxHistory: number = 20) {
    this.maxHistory = maxHistory;
  }

  /** 复制到系统剪贴板 */
  async copy(text: string): Promise<boolean> {
    try {
      // 尝试使用系统命令
      if (process.platform === 'darwin') {
        execSync('pbcopy', { input: text });
        this.addToHistory(text);
        return true;
      } else if (process.platform === 'linux') {
        // 尝试 xclip
        try {
          execSync('xclip -selection clipboard', { input: text });
          this.addToHistory(text);
          return true;
        } catch {
          // 尝试 xsel
          try {
            execSync('xsel --clipboard --input', { input: text });
            this.addToHistory(text);
            return true;
          } catch {
            // 没有剪贴板工具
            this.addToHistory(text);
            return false;
          }
        }
      } else if (process.platform === 'win32') {
        execSync('clip', { input: text });
        this.addToHistory(text);
        return true;
      }
    } catch {
      // 复制失败，但仍然添加到历史
      this.addToHistory(text);
      return false;
    }
    return false;
  }

  /** 从系统剪贴板粘贴 */
  async paste(): Promise<string | null> {
    try {
      if (process.platform === 'darwin') {
        return execSync('pbpaste', { encoding: 'utf-8' });
      } else if (process.platform === 'linux') {
        try {
          return execSync('xclip -selection clipboard -o', { encoding: 'utf-8' });
        } catch {
          try {
            return execSync('xsel --clipboard --output', { encoding: 'utf-8' });
          } catch {
            return null;
          }
        }
      } else if (process.platform === 'win32') {
        return execSync('powershell -command "Get-Clipboard"', { encoding: 'utf-8' });
      }
    } catch {
      return null;
    }
    return null;
  }

  /** 复制到内部缓冲区 */
  yank(text: string): void {
    this.addToHistory(text);
  }

  /** 从内部缓冲区粘贴 */
  pasteInternal(): string | null {
    if (this.internalBuffer.length > 0) {
      return this.internalBuffer[this.internalBuffer.length - 1];
    }
    return null;
  }

  /** 获取剪贴板历史 */
  getHistory(): string[] {
    return [...this.internalBuffer];
  }

  /** 选择历史记录 */
  selectFromHistory(index: number): string | null {
    if (index >= 0 && index < this.internalBuffer.length) {
      const text = this.internalBuffer[index];
      // 移到末尾
      this.internalBuffer.splice(index, 1);
      this.internalBuffer.push(text);
      return text;
    }
    return null;
  }

  /** 清空历史 */
  clearHistory(): void {
    this.internalBuffer = [];
  }

  /** 添加到历史 */
  private addToHistory(text: string): void {
    // 避免重复
    const index = this.internalBuffer.indexOf(text);
    if (index !== -1) {
      this.internalBuffer.splice(index, 1);
    }

    this.internalBuffer.push(text);

    // 限制历史大小
    if (this.internalBuffer.length > this.maxHistory) {
      this.internalBuffer.shift();
    }

    this.notifyListeners(text);
  }

  /** 监听复制事件 */
  onCopy(listener: (text: string) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /** 通知监听者 */
  private notifyListeners(text: string): void {
    for (const listener of this.listeners) {
      listener(text);
    }
  }
}
