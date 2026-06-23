/**
 * 虚拟滚动
 * 高性能滚动列表实现
 */

/** 虚拟滚动选项 */
export interface VirtualScrollOptions {
  totalItems: number;
  itemHeight: number;
  containerHeight: number;
  scrollTop?: number;
  overscan?: number; // 额外渲染的行数
}

/** 可见区域 */
export interface VisibleRange {
  start: number;
  end: number;
  scrollTop: number;
  offsetY: number;
}

/** 虚拟滚动 */
export class VirtualScroll {
  private totalItems: number;
  private itemHeight: number;
  private containerHeight: number;
  private scrollTop: number;
  private overscan: number;

  constructor(options: VirtualScrollOptions) {
    this.totalItems = options.totalItems;
    this.itemHeight = options.itemHeight;
    this.containerHeight = options.containerHeight;
    this.scrollTop = options.scrollTop || 0;
    this.overscan = options.overscan || 5;
  }

  /** 获取可见区域 */
  getVisibleRange(): VisibleRange {
    const start = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.overscan);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    const end = Math.min(this.totalItems, start + visibleCount + this.overscan * 2);

    return {
      start,
      end,
      scrollTop: this.scrollTop,
      offsetY: start * this.itemHeight - this.scrollTop,
    };
  }

  /** 滚动到顶部 */
  scrollToTop(): void {
    this.scrollTop = 0;
  }

  /** 滚动到底部 */
  scrollToBottom(): void {
    this.scrollTop = Math.max(0, this.getTotalHeight() - this.containerHeight);
  }

  /** 向上滚动 */
  scrollUp(lines: number = 1): void {
    this.scrollTop = Math.max(0, this.scrollTop - lines * this.itemHeight);
  }

  /** 向下滚动 */
  scrollDown(lines: number = 1): void {
    const maxScroll = Math.max(0, this.getTotalHeight() - this.containerHeight);
    this.scrollTop = Math.min(maxScroll, this.scrollTop + lines * this.itemHeight);
  }

  /** 滚动到指定项 */
  scrollToItem(index: number): void {
    const itemTop = index * this.itemHeight;
    const itemBottom = itemTop + this.itemHeight;

    if (itemTop < this.scrollTop) {
      this.scrollTop = itemTop;
    } else if (itemBottom > this.scrollTop + this.containerHeight) {
      this.scrollTop = itemBottom - this.containerHeight;
    }
  }

  /** 获取总高度 */
  getTotalHeight(): number {
    return this.totalItems * this.itemHeight;
  }

  /** 获取滚动位置 */
  getScrollTop(): number {
    return this.scrollTop;
  }

  /** 设置滚动位置 */
  setScrollTop(top: number): void {
    const maxScroll = Math.max(0, this.getTotalHeight() - this.containerHeight);
    this.scrollTop = Math.max(0, Math.min(maxScroll, top));
  }

  /** 检查是否在顶部 */
  isAtTop(): boolean {
    return this.scrollTop === 0;
  }

  /** 检查是否在底部 */
  isAtBottom(): boolean {
    return this.scrollTop >= this.getTotalHeight() - this.containerHeight;
  }

  /** 获取滚动进度 */
  getScrollProgress(): number {
    const totalHeight = this.getTotalHeight();
    if (totalHeight <= this.containerHeight) {
      return 1;
    }
    return this.scrollTop / (totalHeight - this.containerHeight);
  }

  /** 更新总项目数 */
  setTotalItems(count: number): void {
    this.totalItems = count;
    // 确保滚动位置有效
    this.setScrollTop(this.scrollTop);
  }

  /** 更新容器高度 */
  setContainerHeight(height: number): void {
    this.containerHeight = height;
    this.setScrollTop(this.scrollTop);
  }
}

/** 滚动指示器 */
export class ScrollIndicator {
  private height: number;
  private totalItems: number;
  private visibleItems: number;
  private scrollTop: number;

  constructor(options: {
    height: number;
    totalItems: number;
    visibleItems: number;
    scrollTop: number;
  }) {
    this.height = options.height;
    this.totalItems = options.totalItems;
    this.visibleItems = options.visibleItems;
    this.scrollTop = options.scrollTop;
  }

  /** 渲染滚动指示器 */
  render(): string[] {
    if (this.totalItems <= this.visibleItems) {
      return [];
    }

    const lines: string[] = [];
    const thumbHeight = Math.max(1, Math.floor((this.visibleItems / this.totalItems) * this.height));
    const thumbPosition = Math.floor((this.scrollTop / (this.totalItems - this.visibleItems)) * (this.height - thumbHeight));

    for (let i = 0; i < this.height; i++) {
      if (i >= thumbPosition && i < thumbPosition + thumbHeight) {
        lines.push('█');
      } else {
        lines.push('│');
      }
    }

    return lines;
  }

  /** 更新状态 */
  update(options: {
    totalItems?: number;
    visibleItems?: number;
    scrollTop?: number;
  }): void {
    if (options.totalItems !== undefined) this.totalItems = options.totalItems;
    if (options.visibleItems !== undefined) this.visibleItems = options.visibleItems;
    if (options.scrollTop !== undefined) this.scrollTop = options.scrollTop;
  }
}

/** 鼠标滚轮事件处理 */
export class ScrollHandler {
  private virtualScroll: VirtualScroll;
  private onScroll?: (scrollTop: number) => void;

  constructor(virtualScroll: VirtualScroll, onScroll?: (scrollTop: number) => void) {
    this.virtualScroll = virtualScroll;
    this.onScroll = onScroll;
  }

  /** 处理滚轮事件 */
  handleWheel(deltaY: number): void {
    if (deltaY > 0) {
      this.virtualScroll.scrollDown(3);
    } else if (deltaY < 0) {
      this.virtualScroll.scrollUp(3);
    }

    if (this.onScroll) {
      this.onScroll(this.virtualScroll.getScrollTop());
    }
  }

  /** 处理键盘滚动 */
  handleKey(action: 'up' | 'down' | 'top' | 'bottom' | 'pageUp' | 'pageDown'): void {
    switch (action) {
      case 'up':
        this.virtualScroll.scrollUp(1);
        break;
      case 'down':
        this.virtualScroll.scrollDown(1);
        break;
      case 'top':
        this.virtualScroll.scrollToTop();
        break;
      case 'bottom':
        this.virtualScroll.scrollToBottom();
        break;
      case 'pageUp':
        this.virtualScroll.scrollUp(this.virtualScroll.getVisibleRange().end - this.virtualScroll.getVisibleRange().start);
        break;
      case 'pageDown':
        this.virtualScroll.scrollDown(this.virtualScroll.getVisibleRange().end - this.virtualScroll.getVisibleRange().start);
        break;
    }

    if (this.onScroll) {
      this.onScroll(this.virtualScroll.getScrollTop());
    }
  }
}
