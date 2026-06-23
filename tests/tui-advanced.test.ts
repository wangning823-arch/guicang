/**
 * TUI 高级功能测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AnimationManager } from '../src/tui/managers/animation.js';
import { BookmarkManager } from '../src/tui/managers/bookmark.js';
import { VirtualScroll, ScrollIndicator } from '../src/tui/utils/virtual-scroll.js';

describe('AnimationManager', () => {
  let manager: AnimationManager;

  beforeEach(() => {
    manager = new AnimationManager();
  });

  it('should create animation manager', () => {
    expect(manager.getAnimationCount()).toBe(0);
    expect(manager.isAnimating()).toBe(false);
  });

  it('should create spinner animation', () => {
    const id = manager.createSpinner('dots', () => {});
    expect(id).toBeGreaterThan(0);
    expect(manager.getAnimationCount()).toBe(1);
    expect(manager.isAnimating()).toBe(true);
    manager.stopAll();
  });

  it('should create progress animation', () => {
    const id = manager.createProgress(100, () => {});
    expect(id).toBeGreaterThan(0);
    manager.stopAll();
  });

  it('should stop animation', () => {
    const id = manager.createSpinner('dots', () => {});
    expect(manager.getAnimationCount()).toBe(1);
    manager.stop(id);
    expect(manager.getAnimationCount()).toBe(0);
  });

  it('should stop all animations', () => {
    manager.createSpinner('dots', () => {});
    manager.createProgress(100, () => {});
    manager.stopAll();
    expect(manager.getAnimationCount()).toBe(0);
  });

  it('should set frame rate', () => {
    manager.setFrameRate(30);
    // 不抛出错误即成功
  });
});

describe('BookmarkManager', () => {
  let manager: BookmarkManager;

  beforeEach(() => {
    manager = new BookmarkManager();
  });

  it('should add bookmark', () => {
    const bookmark = manager.addBookmark('msg1', 'Hello world', '测试书签', ['test']);
    expect(bookmark.id).toBeDefined();
    expect(bookmark.messageId).toBe('msg1');
    expect(bookmark.content).toBe('Hello world');
    expect(bookmark.note).toBe('测试书签');
    expect(bookmark.tags).toContain('test');
  });

  it('should get all bookmarks', () => {
    manager.addBookmark('msg1', 'content1');
    manager.addBookmark('msg2', 'content2');
    expect(manager.getAllBookmarks().length).toBe(2);
  });

  it('should remove bookmark', () => {
    const bookmark = manager.addBookmark('msg1', 'content');
    const removed = manager.removeBookmark(bookmark.id);
    expect(removed).toBe(true);
    expect(manager.getAllBookmarks().length).toBe(0);
  });

  it('should add tag', () => {
    const bookmark = manager.addBookmark('msg1', 'content');
    const added = manager.addTag(bookmark.id, 'important');
    expect(added).toBe(true);
    expect(bookmark.tags).toContain('important');
  });

  it('should not add duplicate tag', () => {
    const bookmark = manager.addBookmark('msg1', 'content', undefined, ['test']);
    const added = manager.addTag(bookmark.id, 'test');
    expect(added).toBe(false);
  });

  it('should remove tag', () => {
    const bookmark = manager.addBookmark('msg1', 'content', undefined, ['test']);
    const removed = manager.removeTag(bookmark.id, 'test');
    expect(removed).toBe(true);
    expect(bookmark.tags).not.toContain('test');
  });

  it('should filter by tag', () => {
    manager.addBookmark('msg1', 'content1', undefined, ['tag1']);
    manager.addBookmark('msg2', 'content2', undefined, ['tag2']);
    manager.addBookmark('msg3', 'content3', undefined, ['tag1', 'tag2']);

    const filtered = manager.filterByTag('tag1');
    expect(filtered.length).toBe(2);
  });

  it('should search bookmarks', () => {
    manager.addBookmark('msg1', 'Hello world');
    manager.addBookmark('msg2', 'Goodbye world');
    manager.addBookmark('msg3', 'Hello there');

    const results = manager.search('hello');
    expect(results.length).toBe(2);
  });

  it('should get all tags', () => {
    manager.addBookmark('msg1', 'content', undefined, ['tag1', 'tag2']);
    manager.addBookmark('msg2', 'content', undefined, ['tag2', 'tag3']);

    const tags = manager.getAllTags();
    expect(tags).toContain('tag1');
    expect(tags).toContain('tag2');
    expect(tags).toContain('tag3');
  });

  it('should export and import bookmarks', () => {
    manager.addBookmark('msg1', 'content1');
    manager.addBookmark('msg2', 'content2');

    const exported = manager.exportBookmarks();
    const newManager = new BookmarkManager();
    const imported = newManager.importBookmarks(exported);

    expect(imported).toBe(true);
    expect(newManager.getAllBookmarks().length).toBe(2);
  });
});

describe('VirtualScroll', () => {
  let scroll: VirtualScroll;

  beforeEach(() => {
    scroll = new VirtualScroll({
      totalItems: 100,
      itemHeight: 20,
      containerHeight: 400,
    });
  });

  it('should get visible range', () => {
    const range = scroll.getVisibleRange();
    expect(range.start).toBe(0);
    expect(range.end).toBeGreaterThan(0);
    expect(range.end).toBeLessThanOrEqual(100);
  });

  it('should scroll to top', () => {
    scroll.scrollDown(50);
    scroll.scrollToTop();
    expect(scroll.getScrollTop()).toBe(0);
  });

  it('should scroll to bottom', () => {
    scroll.scrollToBottom();
    expect(scroll.isAtBottom()).toBe(true);
  });

  it('should scroll up', () => {
    scroll.scrollDown(50);
    const before = scroll.getScrollTop();
    scroll.scrollUp(10);
    expect(scroll.getScrollTop()).toBeLessThan(before);
  });

  it('should scroll down', () => {
    const before = scroll.getScrollTop();
    scroll.scrollDown(10);
    expect(scroll.getScrollTop()).toBeGreaterThan(before);
  });

  it('should scroll to item', () => {
    scroll.scrollToItem(50);
    const range = scroll.getVisibleRange();
    expect(range.start).toBeLessThanOrEqual(50);
    expect(range.end).toBeGreaterThan(50);
  });

  it('should not scroll past bounds', () => {
    scroll.scrollUp(100);
    expect(scroll.getScrollTop()).toBe(0);

    scroll.scrollToBottom();
    scroll.scrollDown(100);
    expect(scroll.isAtBottom()).toBe(true);
  });

  it('should calculate scroll progress', () => {
    expect(scroll.getScrollProgress()).toBe(0);
    scroll.scrollToBottom();
    expect(scroll.getScrollProgress()).toBe(1);
  });

  it('should update total items', () => {
    scroll.setTotalItems(200);
    scroll.scrollToBottom();
    expect(scroll.isAtBottom()).toBe(true);
  });

  it('should check if at top', () => {
    expect(scroll.isAtTop()).toBe(true);
    scroll.scrollDown(1);
    expect(scroll.isAtTop()).toBe(false);
  });
});

describe('ScrollIndicator', () => {
  it('should render nothing when all items visible', () => {
    const indicator = new ScrollIndicator({
      height: 20,
      totalItems: 10,
      visibleItems: 20,
      scrollTop: 0,
    });
    const lines = indicator.render();
    expect(lines.length).toBe(0);
  });

  it('should render indicator when items overflow', () => {
    const indicator = new ScrollIndicator({
      height: 20,
      totalItems: 100,
      visibleItems: 20,
      scrollTop: 0,
    });
    const lines = indicator.render();
    expect(lines.length).toBe(20);
    expect(lines.some(l => l === '█')).toBe(true);
  });

  it('should update state', () => {
    const indicator = new ScrollIndicator({
      height: 20,
      totalItems: 100,
      visibleItems: 20,
      scrollTop: 0,
    });
    indicator.update({ scrollTop: 50 });
    // 不抛出错误即成功
  });
});
