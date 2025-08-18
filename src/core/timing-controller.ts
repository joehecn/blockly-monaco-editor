/**
 * 防抖节流控制组件
 * 实现状态管理中所需的防抖和节流功能，优化编辑器交互性能
 */

/**
 * 防抖节流配置选项
 */
export interface DebounceThrottleOptions {
  /**
   * 防抖延迟时间（毫秒）
   * 默认：300ms
   */
  debounceDelay?: number;
  
  /**
   * 节流时间间隔（毫秒）
   * 默认：100ms
   */
  throttleInterval?: number;
  
  /**
   * 是否立即执行第一次调用
   * 仅对防抖函数有效
   * 默认：false
   */
  leadingEdge?: boolean;
  
  /**
   * 是否在延迟结束后执行
   * 仅对防抖函数有效
   * 默认：true
   */
  trailingEdge?: boolean;
  
  /**
   * 是否在等待期间取消前一个定时器
   * 仅对节流函数有效
   * 默认：true
   */
  cancelPrevious?: boolean;
}

/**
 * 定时器控制接口
 */
export interface TimerController {
  /**
   * 执行防抖/节流函数
   * @param args 传递给回调函数的参数
   */
  execute(...args: any[]): void;
  
  /**
   * 取消当前等待的执行
   */
  cancel(): void;
  
  /**
   * 立即执行回调（不等待延迟）
   */
  flush(): void;
  
  /**
   * 销毁控制器，清理资源
   */
  destroy(): void;
  
  /**
   * 获取当前控制器的状态
   * @returns 是否有等待执行的任务
   */
  isPending(): boolean;
}

/**
 * 防抖节流控制器类
 * 提供防抖和节流功能，用于优化编辑器交互
 */
export class TimingController implements TimerController {
  private timerId: number | null = null;
  private lastExecTime = 0;
  private isDestroyed = false;
  private readonly callback: (...args: any[]) => void;
  private readonly options: Required<DebounceThrottleOptions>;
  private readonly type: 'debounce' | 'throttle';
  private args: any[] = [];

  /**
   * 构造函数
   * @param type 控制器类型：防抖或节流
   * @param callback 要执行的回调函数
   * @param options 配置选项
   */
  constructor(
    type: 'debounce' | 'throttle',
    callback: (...args: any[]) => void,
    options: DebounceThrottleOptions = {}
  ) {
    if (typeof callback !== 'function') {
      throw new Error('回调必须是一个函数');
    }

    this.type = type;
    this.callback = callback;
    this.options = {
      debounceDelay: options.debounceDelay ?? 300,
      throttleInterval: options.throttleInterval ?? 100,
      leadingEdge: options.leadingEdge ?? false,
      trailingEdge: options.trailingEdge ?? true,
      cancelPrevious: options.cancelPrevious ?? true
    };
  }

  /**
   * 执行防抖/节流函数
   * @param args 传递给回调函数的参数
   */
  execute(...args: any[]): void {
    if (this.isDestroyed) {
      console.warn('尝试执行已销毁的TimingController');
      return;
    }

    this.args = args;

    if (this.type === 'debounce') {
      this.executeDebounce();
    } else {
      this.executeThrottle();
    }
  }

  /**
   * 取消当前等待的执行
   */
  cancel(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * 立即执行回调（不等待延迟）
   */
  flush(): void {
    this.cancel();
    this.lastExecTime = Date.now();
    this.callback.apply(null, this.args);
  }

  /**
   * 销毁控制器，清理资源
   */
  destroy(): void {
    this.cancel();
    this.isDestroyed = true;
    this.args = [];
  }

  /**
   * 获取当前控制器的状态
   * @returns 是否有等待执行的任务
   */
  isPending(): boolean {
    return this.timerId !== null;
  }

  /**
   * 内部方法：执行防抖逻辑
   */
  private executeDebounce(): void {
    const now = Date.now();
    // @ts-ignore - 预留用于未来优化
    const _elapsed = now - this.lastExecTime; // 计算时间差，预留用于未来优化

    // 取消之前的定时器
    if (this.options.cancelPrevious) {
      this.cancel();
    }

    // 前缘执行
    if (this.options.leadingEdge && !this.timerId) {
      this.lastExecTime = now;
      this.callback(...this.args);
      return;
    }

    // 后缘执行
    if (this.options.trailingEdge) {
      this.timerId = window.setTimeout(() => {
        this.lastExecTime = Date.now();
        this.timerId = null;
        this.callback(...this.args);
      }, this.options.debounceDelay);
    }
  }

  /**
   * 内部方法：执行节流逻辑
   */
  private executeThrottle(): void {
    const now = Date.now();
    const elapsed = now - this.lastExecTime;

    // 在前缘立即执行
    if (this.options.leadingEdge && elapsed >= this.options.throttleInterval) {
      this.lastExecTime = now;
      this.callback(...this.args);
      return;
    }

    // 取消之前的定时器
    if (this.options.cancelPrevious && this.timerId) {
      clearTimeout(this.timerId);
    }

    // 在后缘执行
    if (this.options.trailingEdge && !this.timerId) {
      this.timerId = window.setTimeout(() => {
        this.lastExecTime = Date.now();
        this.timerId = null;
        this.callback(...this.args);
      }, Math.max(0, this.options.throttleInterval - elapsed));
    }
  }
}

/**
 * 创建防抖函数控制器
 * @param callback 要防抖的函数
 * @param options 防抖选项
 * @returns 防抖控制器实例
 */
export function createDebounceController(
  callback: (...args: any[]) => void,
  options: Omit<DebounceThrottleOptions, 'throttleInterval'> = {}
): TimerController {
  return new TimingController('debounce', callback, options);
}

/**
 * 创建节流函数控制器
 * @param callback 要节流的函数
 * @param options 节流选项
 * @returns 节流控制器实例
 */
export function createThrottleController(
  callback: (...args: any[]) => void,
  options: Omit<DebounceThrottleOptions, 'debounceDelay'> = {}
): TimerController {
  return new TimingController('throttle', callback, options);
}

/**
 * 防抖工具函数
 * @param callback 要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @param options 额外选项
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300,
  options: Omit<DebounceThrottleOptions, 'debounceDelay' | 'throttleInterval'> = {}
): (...args: Parameters<T>) => void {
  const controller = createDebounceController(callback, {
    ...options,
    debounceDelay: delay
  });

  const debouncedFn = (...args: Parameters<T>) => {
    controller.execute(...args);
  };

  // 添加取消和立即执行方法
  (debouncedFn as any).cancel = () => controller.cancel();
  (debouncedFn as any).flush = () => controller.flush();
  (debouncedFn as any).destroy = () => controller.destroy();
  (debouncedFn as any).isPending = () => controller.isPending();

  return debouncedFn as (...args: Parameters<T>) => void;
}

/**
 * 节流工具函数
 * @param callback 要节流的函数
 * @param interval 时间间隔（毫秒）
 * @param options 额外选项
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  callback: T,
  interval: number = 100,
  options: Omit<DebounceThrottleOptions, 'debounceDelay' | 'throttleInterval'> = {}
): (...args: Parameters<T>) => void {
  const controller = createThrottleController(callback, {
    ...options,
    throttleInterval: interval
  });

  const throttledFn = (...args: Parameters<T>) => {
    controller.execute(...args);
  };

  // 添加取消和立即执行方法
  (throttledFn as any).cancel = () => controller.cancel();
  (throttledFn as any).flush = () => controller.flush();
  (throttledFn as any).destroy = () => controller.destroy();
  (throttledFn as any).isPending = () => controller.isPending();

  return throttledFn as (...args: Parameters<T>) => void;
}

/**
 * 防抖节流管理器
 * 管理多个防抖节流控制器的集合
 */
export class TimingManager {
  private controllers: Map<string, TimerController> = new Map();
  private isDestroyed = false;

  /**
   * 创建并注册一个防抖控制器
   * @param id 控制器唯一ID
   * @param callback 回调函数
   * @param options 防抖选项
   * @returns 防抖控制器实例
   */
  createDebounce(
    id: string,
    callback: (...args: any[]) => void,
    options: Omit<DebounceThrottleOptions, 'throttleInterval'> = {}
  ): TimerController {
    if (this.isDestroyed) {
      throw new Error('TimingManager已销毁，无法创建新控制器');
    }

    const controller = createDebounceController(callback, options);
    this.controllers.set(id, controller);
    return controller;
  }

  /**
   * 创建并注册一个节流控制器
   * @param id 控制器唯一ID
   * @param callback 回调函数
   * @param options 节流选项
   * @returns 节流控制器实例
   */
  createThrottle(
    id: string,
    callback: (...args: any[]) => void,
    options: Omit<DebounceThrottleOptions, 'debounceDelay'> = {}
  ): TimerController {
    if (this.isDestroyed) {
      throw new Error('TimingManager已销毁，无法创建新控制器');
    }

    const controller = createThrottleController(callback, options);
    this.controllers.set(id, controller);
    return controller;
  }

  /**
   * 获取已注册的控制器
   * @param id 控制器ID
   * @returns 控制器实例或undefined
   */
  getController(id: string): TimerController | undefined {
    return this.controllers.get(id);
  }

  /**
   * 取消指定控制器的执行
   * @param id 控制器ID
   * @returns 是否成功取消
   */
  cancel(id: string): boolean {
    const controller = this.controllers.get(id);
    if (controller) {
      controller.cancel();
      return true;
    }
    return false;
  }

  /**
   * 立即执行指定控制器的回调
   * @param id 控制器ID
   * @returns 是否成功执行
   */
  flush(id: string): boolean {
    const controller = this.controllers.get(id);
    if (controller) {
      controller.flush();
      return true;
    }
    return false;
  }

  /**
   * 取消所有控制器的执行
   */
  cancelAll(): void {
    this.controllers.forEach(controller => controller.cancel());
  }

  /**
   * 移除指定控制器
   * @param id 控制器ID
   * @returns 是否成功移除
   */
  removeController(id: string): boolean {
    const controller = this.controllers.get(id);
    if (controller) {
      controller.destroy();
      return this.controllers.delete(id);
    }
    return false;
  }

  /**
   * 移除并销毁所有控制器
   */
  removeAllControllers(): void {
    this.controllers.forEach(controller => controller.destroy());
    this.controllers.clear();
  }

  /**
   * 获取管理器中控制器的数量
   * @returns 控制器数量
   */
  getControllerCount(): number {
    return this.controllers.size;
  }

  /**
   * 检查是否存在待执行的控制器
   * @returns 是否有待执行的控制器
   */
  hasPendingControllers(): boolean {
    for (const controller of this.controllers.values()) {
      if (controller.isPending()) {
        return true;
      }
    }
    return false;
  }

  /**
   * 销毁管理器，清理所有资源
   */
  destroy(): void {
    this.removeAllControllers();
    this.isDestroyed = true;
  }
}

/**
 * 创建全局的防抖节流管理器实例
 */
export const globalTimingManager = new TimingManager();