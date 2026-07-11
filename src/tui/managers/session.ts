/**
 * 会话管理器
 * 管理聊天会话
 */

import { ChatMessage } from '../panels/chat.js';

/** 会话信息 */
export interface Session {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/** 会话信息摘要 */
export interface SessionInfo {
  id: string;
  name: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 会话管理器 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private currentSessionId: string | null = null;
  private listeners: Array<(session: Session) => void> = [];

  constructor() {
    // 创建默认会话
    this.createSession('默认会话');
  }

  /** 创建新会话 */
  createSession(name?: string): Session {
    const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const session: Session = {
      id,
      name: name || `会话 ${this.sessions.size + 1}`,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(id, session);
    return session;
  }

  /** 获取当前会话 */
  getCurrentSession(): Session | null {
    if (this.currentSessionId) {
      return this.sessions.get(this.currentSessionId) || null;
    }
    return null;
  }

  /** 设置当前会话 */
  setCurrentSession(id: string): boolean {
    if (this.sessions.has(id)) {
      this.currentSessionId = id;
      const session = this.sessions.get(id)!;
      this.notifyListeners(session);
      return true;
    }
    return false;
  }

  /** 获取所有会话 */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /** 获取会话信息摘要 */
  getSessionInfos(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      name: s.name,
      messageCount: s.messages.length,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  /** 获取会话 */
  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /** 删除会话 */
  deleteSession(id: string): boolean {
    if (this.sessions.size <= 1) {
      return false; // 至少保留一个会话
    }
    const deleted = this.sessions.delete(id);
    if (deleted && this.currentSessionId === id) {
      // 切换到第一个可用会话
      const firstId = this.sessions.keys().next().value;
      if (firstId) {
        this.currentSessionId = firstId;
      }
    }
    return deleted;
  }

  /** 重命名会话 */
  renameSession(id: string, name: string): boolean {
    const session = this.sessions.get(id);
    if (session) {
      session.name = name;
      session.updatedAt = new Date();
      return true;
    }
    return false;
  }

  /** 添加消息到会话 */
  addMessage(sessionId: string, message: ChatMessage): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages.push(message);
      session.updatedAt = new Date();
    }
  }

  /** 获取会话消息 */
  getMessages(sessionId: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    return session ? session.messages : [];
  }

  /** 搜索会话 */
  searchSessions(query: string): SessionInfo[] {
    const lowerQuery = query.toLowerCase();
    return this.getSessionInfos().filter(s =>
      s.name.toLowerCase().includes(lowerQuery)
    );
  }

  /** 分叉会话 */
  forkSession(id: string, fromMessageIndex?: number): Session | null {
    const sourceSession = this.sessions.get(id);
    if (!sourceSession) {
      return null;
    }

    const newSession = this.createSession(`${sourceSession.name} (分叉)`);
    if (fromMessageIndex !== undefined) {
      newSession.messages = sourceSession.messages.slice(0, fromMessageIndex);
    } else {
      newSession.messages = [...sourceSession.messages];
    }

    return newSession;
  }

  /** 导出会话为 JSON */
  exportSession(id: string): string | null {
    const session = this.sessions.get(id);
    if (!session) {
      return null;
    }

    return JSON.stringify(session, null, 2);
  }

  /** 导出会话为 Markdown */
  exportSessionAsMarkdown(id: string): string | null {
    const session = this.sessions.get(id);
    if (!session) {
      return null;
    }

    const lines: string[] = [
      `# ${session.name}`,
      '',
      `创建时间: ${session.createdAt.toISOString()}`,
      `更新时间: ${session.updatedAt.toISOString()}`,
      `消息数量: ${session.messages.length}`,
      '',
      '---',
      '',
    ];

    for (const msg of session.messages) {
      const role = msg.role === 'user' ? '**用户**' : '**AI**';
      lines.push(`${role}:`);
      lines.push('');
      lines.push(msg.content);
      lines.push('');
    }

    return lines.join('\n');
  }

  /** 导入会话 */
  importSession(data: string): Session | null {
    try {
      const session: Session = JSON.parse(data);
      if (session.id && session.messages) {
        session.createdAt = new Date(session.createdAt);
        session.updatedAt = new Date(session.updatedAt);
        this.sessions.set(session.id, session);
        return session;
      }
    } catch {
      // JSON 解析失败
    }
    return null;
  }

  /** 监听会话变化 */
  onSessionChange(listener: (session: Session) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /** 通知监听者 */
  private notifyListeners(session: Session): void {
    for (const listener of this.listeners) {
      listener(session);
    }
  }
}
