/**
 * 动画管理器
 * 管理 TUI 动画效果
 */

import { Colors, colorize } from '../theme.js';

/** 旋转动画帧 */
const SPINNERS: Record<string, string[]> = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['-', '\\', '|', '/'],
  clock: ['🕐', '🕑', '🕒', '🕓', '🕔', 'VI', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'],
  bars: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '▆', '▅', '▄', '▃', '▂'],
  arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  bouncing: ['(    )', '(   )', '  (  )', '   ( )', '    (', '   ( )', '  (  )', ' (   )'],
};

/** 动画类型 */
export type AnimationType = 'spinner' | 'progress' | 'fade' | 'slide';

/** 动画实例 */
interface Animation {
  id: number;
  type: AnimationType;
  frame: number;
  totalFrames: number;
  speed: number;
  startTime: number;
  data: any;
  callback?: (frame: number) => void;
  onComplete?: () => void;
}

/** 动画管理器 */
export class AnimationManager {
  private animations: Map<number, Animation> = new Map();
  private nextId: number = 1;
  private isRunning: boolean = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private frameRate: number = 10; // FPS

  constructor() {}

  /** 创建旋转动画 */
  createSpinner(
    type: keyof typeof SPINNERS = 'dots',
    callback: (frame: string) => void,
    options?: {
      speed?: number;
      color?: string;
      onComplete?: () => void;
    }
  ): number {
    const frames = SPINNERS[type] || SPINNERS.dots;
    const id = this.nextId++;

    const animation: Animation = {
      id,
      type: 'spinner',
      frame: 0,
      totalFrames: frames.length,
      speed: options?.speed || 100,
      startTime: Date.now(),
      data: { frames, color: options?.color || Colors.brightCyan },
      callback: (frame) => {
        const spinnerText = frames[frame % frames.length];
        const color = options?.color || Colors.brightCyan;
        callback(colorize(spinnerText, color));
      },
      onComplete: options?.onComplete,
    };

    this.animations.set(id, animation);
    this.startIfNeeded();

    return id;
  }

  /** 创建进度动画 */
  createProgress(
    total: number,
    callback: (progress: number, bar: string) => void,
    options?: {
      width?: number;
      color?: string;
      onComplete?: () => void;
    }
  ): number {
    const id = this.nextId++;
    const width = options?.width || 20;

    const animation: Animation = {
      id,
      type: 'progress',
      frame: 0,
      totalFrames: total,
      speed: 1,
      startTime: Date.now(),
      data: { width, color: options?.color || Colors.brightGreen },
      callback: (progress) => {
        const percent = Math.floor((progress / total) * 100);
        const filled = Math.floor((progress / total) * width);
        const empty = width - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        callback(percent, colorize(bar, options?.color || Colors.brightGreen));
      },
      onComplete: options?.onComplete,
    };

    this.animations.set(id, animation);
    this.startIfNeeded();

    return id;
  }

  /** 更新进度 */
  updateProgress(id: number, progress: number): void {
    const animation = this.animations.get(id);
    if (animation && animation.type === 'progress') {
      animation.frame = progress;
      if (animation.callback) {
        animation.callback(progress);
      }
      if (progress >= animation.totalFrames) {
        this.completeAnimation(id);
      }
    }
  }

  /** 创建淡入动画 */
  createFadeIn(
    duration: number,
    callback: (opacity: number) => void,
    options?: {
      color?: string;
      onComplete?: () => void;
    }
  ): number {
    const id = this.nextId++;
    const totalFrames = 10;

    const animation: Animation = {
      id,
      type: 'fade',
      frame: 0,
      totalFrames,
      speed: duration / totalFrames,
      startTime: Date.now(),
      data: { duration, color: options?.color || Colors.white },
      callback: (frame) => {
        const opacity = frame / totalFrames;
        callback(opacity);
      },
      onComplete: options?.onComplete,
    };

    this.animations.set(id, animation);
    this.startIfNeeded();

    return id;
  }

  /** 创建滑入动画 */
  createSlideIn(
    direction: 'left' | 'right' | 'up' | 'down',
    duration: number,
    callback: (progress: number) => void,
    options?: {
      onComplete?: () => void;
    }
  ): number {
    const id = this.nextId++;
    const totalFrames = 10;

    const animation: Animation = {
      id,
      type: 'slide',
      frame: 0,
      totalFrames,
      speed: duration / totalFrames,
      startTime: Date.now(),
      data: { direction, duration },
      callback: (frame) => {
        const progress = frame / totalFrames;
        callback(progress);
      },
      onComplete: options?.onComplete,
    };

    this.animations.set(id, animation);
    this.startIfNeeded();

    return id;
  }

  /** 停止动画 */
  stop(id: number): boolean {
    const existed = this.animations.delete(id);
    if (existed) {
      this.stopIfNeeded();
    }
    return existed;
  }

  /** 停止所有动画 */
  stopAll(): void {
    this.animations.clear();
    this.stopIfNeeded();
  }

  /** 完成动画 */
  private completeAnimation(id: number): void {
    const animation = this.animations.get(id);
    if (animation) {
      if (animation.onComplete) {
        animation.onComplete();
      }
      this.animations.delete(id);
      this.stopIfNeeded();
    }
  }

  /** 启动动画循环 */
  private startIfNeeded(): void {
    if (!this.isRunning && this.animations.size > 0) {
      this.isRunning = true;
      this.intervalId = setInterval(() => {
        this.tick();
      }, 1000 / this.frameRate);
    }
  }

  /** 停止动画循环 */
  private stopIfNeeded(): void {
    if (this.isRunning && this.animations.size === 0) {
      this.isRunning = false;
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
  }

  /** 动画帧更新 */
  private tick(): void {
    const now = Date.now();
    const completedIds: number[] = [];

    for (const [id, animation] of this.animations) {
      const elapsed = now - animation.startTime;
      const newFrame = Math.floor(elapsed / animation.speed);

      if (newFrame !== animation.frame) {
        animation.frame = newFrame;

        if (animation.callback) {
          animation.callback(newFrame);
        }

        // 检查是否完成
        if (animation.totalFrames > 0 && newFrame >= animation.totalFrames) {
          completedIds.push(id);
        }
      }
    }

    // 处理完成的动画
    for (const id of completedIds) {
      this.completeAnimation(id);
    }
  }

  /** 设置帧率 */
  setFrameRate(fps: number): void {
    this.frameRate = fps;
    if (this.isRunning) {
      this.stopLoop();
      this.startIfNeeded();
    }
  }

  /** 获取动画数量 */
  getAnimationCount(): number {
    return this.animations.size;
  }

  /** 检查动画是否正在运行 */
  isAnimating(): boolean {
    return this.isRunning;
  }

  /** 停止动画循环 */
  private stopLoop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }
}

/** 工具函数：创建加载指示器 */
export function createLoadingSpinner(
  manager: AnimationManager,
  message: string,
  color?: string
): { id: number; update: (msg: string) => void; stop: () => void } {
  let currentMessage = message;

  const id = manager.createSpinner('dots', (frame) => {
    process.stdout.write(`\r${frame} ${currentMessage}   `);
  }, {
    color,
    speed: 80,
  });

  return {
    id,
    update: (msg: string) => {
      currentMessage = msg;
    },
    stop: () => {
      manager.stop(id);
      process.stdout.write('\r' + ' '.repeat(50) + '\r');
    },
  };
}
