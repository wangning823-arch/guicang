/**
 * 长期记忆 — SQLite 后端
 * 替换 JSON 文件存储，支持索引查询、分页、并发安全
 */

import Database from 'better-sqlite3';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { type MemoryStore, type MemoryEntry, type MemoryQueryOptions, generateId, calculateDecayScore } from './base.js';

/** SQLite 持久化的行结构 */
interface MemoryRow {
  id: string;
  content: string;
  message_json: string | null;
  metadata_json: string;
  created_at: string;
  last_accessed_at: string;
  access_count: number;
  importance: number;
}

export class LongTermSqliteMemory implements MemoryStore {
  readonly type = 'long-term-sqlite';
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string = './data/memory/long-term.db') {
    this.dbPath = dbPath;
  }

  /** 获取或初始化数据库连接 */
  private async getDb(): Promise<Database.Database> {
    if (this.db) return this.db;

    // 确保目录存在
    const dir = dirname(this.dbPath);
    await mkdir(dir, { recursive: true });

    this.db = new Database(this.dbPath);

    // WAL 模式：支持并发读写
    this.db.pragma('journal_mode = WAL');

    // 创建表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        message_json TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL,
        access_count INTEGER NOT NULL DEFAULT 0,
        importance REAL NOT NULL DEFAULT 0.5
      );

      CREATE INDEX IF NOT EXISTS idx_created_at ON memories(created_at);
      CREATE INDEX IF NOT EXISTS idx_last_accessed_at ON memories(last_accessed_at);
      CREATE INDEX IF NOT EXISTS idx_access_count ON memories(access_count);
      CREATE INDEX IF NOT EXISTS idx_importance ON memories(importance);
    `);

    return this.db;
  }

  /** 将 MemoryRow 转换为 MemoryEntry */
  private rowToEntry(row: MemoryRow): MemoryEntry {
    return {
      id: row.id,
      content: row.content,
      message: row.message_json ? JSON.parse(row.message_json) : undefined,
      metadata: JSON.parse(row.metadata_json),
      createdAt: new Date(row.created_at),
      lastAccessedAt: new Date(row.last_accessed_at),
      accessCount: row.access_count,
      importance: row.importance,
    };
  }

  async add(
    entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>,
  ): Promise<MemoryEntry> {
    const db = await this.getDb();

    const id = generateId();
    const now = new Date().toISOString();
    const importance = entry.importance ?? 0.5;

    const stmt = db.prepare(`
      INSERT INTO memories (id, content, message_json, metadata_json, created_at, last_accessed_at, access_count, importance)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `);

    stmt.run(
      id,
      entry.content,
      entry.message ? JSON.stringify(entry.message) : null,
      JSON.stringify(entry.metadata),
      now,
      now,
      importance,
    );

    return {
      id,
      content: entry.content,
      message: entry.message,
      metadata: entry.metadata,
      createdAt: new Date(now),
      lastAccessedAt: new Date(now),
      accessCount: 0,
      importance,
    };
  }

  async query(options?: MemoryQueryOptions): Promise<MemoryEntry[]> {
    const db = await this.getDb();

    // 构建 SQL 查询
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options?.keyword) {
      conditions.push('(content LIKE ? OR metadata_json LIKE ?)');
      const pattern = `%${options.keyword}%`;
      params.push(pattern, pattern);
    }

    if (options?.since) {
      conditions.push('created_at >= ?');
      params.push(options.since.toISOString());
    }

    if (options?.until) {
      conditions.push('created_at <= ?');
      params.push(options.until.toISOString());
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 排序
    let orderBy: string;
    switch (options?.sortBy) {
      case 'recency':
        orderBy = 'ORDER BY created_at DESC';
        break;
      case 'frequency':
        orderBy = 'ORDER BY access_count DESC';
        break;
      case 'relevance':
        // SQLite 不直接支持 exp()，用应用层衰减排序
        orderBy = 'ORDER BY importance DESC, last_accessed_at DESC';
        break;
      default:
        orderBy = 'ORDER BY created_at DESC';
    }

    const limit = options?.limit ?? 10;

    const stmt = db.prepare(`SELECT * FROM memories ${where} ${orderBy} LIMIT ?`);
    const rows = stmt.all(...params, limit) as MemoryRow[];

    let entries = rows.map((r) => this.rowToEntry(r));

    // 衰减排序需要在应用层计算
    if (options?.sortBy === 'relevance') {
      const decayRate = options.decayRate ?? 0.01;
      entries.sort((a, b) => calculateDecayScore(b, decayRate) - calculateDecayScore(a, decayRate));
    }

    return entries;
  }

  async get(id: string): Promise<MemoryEntry | null> {
    const db = await this.getDb();

    const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as MemoryRow | undefined;
    if (!row) return null;

    // 更新访问信息
    const now = new Date().toISOString();
    db.prepare('UPDATE memories SET last_accessed_at = ?, access_count = access_count + 1 WHERE id = ?')
      .run(now, id);

    const entry = this.rowToEntry(row);
    entry.lastAccessedAt = new Date(now);
    entry.accessCount++;

    return entry;
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
    const db = await this.getDb();

    const existing = db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as MemoryRow | undefined;
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.content !== undefined) {
      fields.push('content = ?');
      values.push(updates.content);
    }
    if (updates.message !== undefined) {
      fields.push('message_json = ?');
      values.push(updates.message ? JSON.stringify(updates.message) : null);
    }
    if (updates.metadata !== undefined) {
      fields.push('metadata_json = ?');
      values.push(JSON.stringify(updates.metadata));
    }
    if (updates.importance !== undefined) {
      fields.push('importance = ?');
      values.push(updates.importance);
    }

    if (fields.length > 0) {
      values.push(id);
      db.prepare(`UPDATE memories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as MemoryRow;
    return this.rowToEntry(updated);
  }

  async delete(id: string): Promise<boolean> {
    const db = await this.getDb();
    const result = db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async clear(): Promise<void> {
    const db = await this.getDb();
    db.exec('DELETE FROM memories');
  }

  async count(): Promise<number> {
    const db = await this.getDb();
    const row = db.prepare('SELECT COUNT(*) as cnt FROM memories').get() as { cnt: number };
    return row.cnt;
  }

  /** 关闭数据库连接 */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /** 数据库统计 */
  getStats(): { totalEntries: number; dbSize: number } {
    if (!this.db) return { totalEntries: 0, dbSize: 0 };

    const countRow = this.db.prepare('SELECT COUNT(*) as cnt FROM memories').get() as { cnt: number };
    const pageCount = this.db.pragma('page_count', { simple: true }) as number;
    const pageSize = this.db.pragma('page_size', { simple: true }) as number;

    return {
      totalEntries: countRow.cnt,
      dbSize: pageCount * pageSize,
    };
  }
}
