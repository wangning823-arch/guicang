/**
 * 书签管理器
 * 管理聊天消息书签
 */

/** 书签 */
export interface Bookmark {
  id: string;
  messageId: string;
  content: string;
  note?: string;
  tags: string[];
  createdAt: Date;
}

/** 书签管理器 */
export class BookmarkManager {
  private bookmarks: Map<string, Bookmark> = new Map();
  private nextId: number = 1;

  constructor() {}

  /** 添加书签 */
  addBookmark(messageId: string, content: string, note?: string, tags: string[] = []): Bookmark {
    const id = `bookmark_${this.nextId++}`;
    const bookmark: Bookmark = {
      id,
      messageId,
      content,
      note,
      tags,
      createdAt: new Date(),
    };

    this.bookmarks.set(id, bookmark);
    return bookmark;
  }

  /** 删除书签 */
  removeBookmark(id: string): boolean {
    return this.bookmarks.delete(id);
  }

  /** 获取所有书签 */
  getAllBookmarks(): Bookmark[] {
    return Array.from(this.bookmarks.values());
  }

  /** 获取书签 */
  getBookmark(id: string): Bookmark | undefined {
    return this.bookmarks.get(id);
  }

  /** 添加标签 */
  addTag(bookmarkId: string, tag: string): boolean {
    const bookmark = this.bookmarks.get(bookmarkId);
    if (bookmark && !bookmark.tags.includes(tag)) {
      bookmark.tags.push(tag);
      return true;
    }
    return false;
  }

  /** 移除标签 */
  removeTag(bookmarkId: string, tag: string): boolean {
    const bookmark = this.bookmarks.get(bookmarkId);
    if (bookmark) {
      const index = bookmark.tags.indexOf(tag);
      if (index > -1) {
        bookmark.tags.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /** 按标签过滤 */
  filterByTag(tag: string): Bookmark[] {
    return this.getAllBookmarks().filter(b => b.tags.includes(tag));
  }

  /** 搜索书签 */
  search(query: string): Bookmark[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllBookmarks().filter(b =>
      b.content.toLowerCase().includes(lowerQuery) ||
      (b.note && b.note.toLowerCase().includes(lowerQuery)) ||
      b.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  /** 获取所有标签 */
  getAllTags(): string[] {
    const tags = new Set<string>();
    for (const bookmark of this.bookmarks.values()) {
      for (const tag of bookmark.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags);
  }

  /** 导出书签 */
  exportBookmarks(): string {
    return JSON.stringify(Array.from(this.bookmarks.values()), null, 2);
  }

  /** 导入书签 */
  importBookmarks(data: string): boolean {
    try {
      const bookmarks: Bookmark[] = JSON.parse(data);
      for (const bookmark of bookmarks) {
        this.bookmarks.set(bookmark.id, bookmark);
      }
      return true;
    } catch {
      return false;
    }
  }
}
