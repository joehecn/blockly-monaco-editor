/**
 * 时序控制模块 - 核心实现
 * 
 * 负责实现防抖节流机制，控制用户操作的触发频率和同步时机
 */
import type { DebounceController, ThrottleController, ReplacementController, TimingController, TimingControllerConfig } from './contracts';
import { TIMING_CONSTANTS } from './contracts';

/**
 * 辅助函数：安全地执行setTimeout
 */
function safeSetTimeout(callback: TimerHandler, delay: number): any {
  const timeoutImpl = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
  return timeoutImpl(callback, delay);
}

/**
 * 辅助函数：安全地执行clearTimeout
 */
function safeClearTimeout(timeoutId: any | null): void {
  if (timeoutId !== null) {
    const clearTimeoutImpl = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout;
    clearTimeoutImpl(timeoutId);
  }
}

/**
 * 防抖控制器实现
 */
export class DebounceControllerImpl implements DebounceController {
  // 使用any类型以适应任何环境中setTimeout返回的类型
  private timeoutId: any | null = null;
  private delay: number = TIMING_CONSTANTS.DEFAULT_DEBOUNCE_DELAY;
  private callback: Function = () => {};

  /**
   * 设置防抖控制器
   * @param delay 延迟时间（毫秒）
   * @param callback 回调函数
   */
  setup(delay: number, callback: Function): void {
    // 验证并设置延迟时间
    this.delay = Math.max(
      0, 
      Math.min(
        delay || TIMING_CONSTANTS.DEFAULT_DEBOUNCE_DELAY, 
        TIMING_CONSTANTS.MAX_DEBOUNCE_DELAY
      )
    );
    this.callback = callback || (() => {});
  }

  /**
   * 触发防抖操作
   * @param data 传递给回调函数的数据
   */
  trigger(data?: any): void {
    // 清除之前的定时器
    this.cancel();
    
    // 设置新的定时器
    this.timeoutId = safeSetTimeout(() => {
      this.callback(data);
      this.timeoutId = null;
    }, this.delay);
  }

  /**
   * 取消当前的防抖操作
   */
  cancel(): void {
    safeClearTimeout(this.timeoutId);
    this.timeoutId = null;
  }

  /**
   * 检查是否有待执行的防抖操作
   * @returns 是否有待执行的操作
   */
  isPending(): boolean {
    return this.timeoutId !== null;
  }
}

/**
 * 节流控制器实现
 */
export class ThrottleControllerImpl implements ThrottleController {
  private lastTriggerTime: number = 0;
  private interval: number = TIMING_CONSTANTS.DEFAULT_THROTTLE_INTERVAL;
  private callback: Function = () => {};
  private pendingTrigger: boolean = false;
  // 使用any类型以适应任何环境中setTimeout返回的类型
  private timeoutId: any | null = null;

  /**
   * 设置节流控制器
   * @param interval 时间间隔（毫秒）
   * @param callback 回调函数
   */
  setup(interval: number, callback: Function): void {
    // 验证并设置时间间隔
    this.interval = Math.max(
      TIMING_CONSTANTS.MIN_THROTTLE_INTERVAL, 
      interval || TIMING_CONSTANTS.DEFAULT_THROTTLE_INTERVAL
    );
    this.callback = callback || (() => {});
    this.lastTriggerTime = 0;
    this.pendingTrigger = false;
    this.cancelTimeout();
  }

  /**
   * 触发节流操作
   * @param data 传递给回调函数的数据
   */
  trigger(data?: any): void {
    const now = Date.now();
    const timeSinceLastTrigger = now - this.lastTriggerTime;

    // 如果距离上次触发已经超过了间隔时间，立即触发
    if (timeSinceLastTrigger >= this.interval) {
      this.executeTrigger(data);
    } else {
      // 否则，设置定时器在剩余时间后触发
      this.scheduleDelayedTrigger(this.interval - timeSinceLastTrigger, data);
    }
  }

  /**
   * 检查是否可以触发下一个操作
   * @returns 是否可以触发
   */
  canTrigger(): boolean {
    const now = Date.now();
    return now - this.lastTriggerTime >= this.interval;
  }

  /**
   * 清除当前的节流状态
   */
  clear(): void {
    this.lastTriggerTime = 0;
    this.pendingTrigger = false;
    this.cancelTimeout();
  }

  /**
   * 执行触发操作
   */
  private executeTrigger(data?: any): void {
    this.lastTriggerTime = Date.now();
    this.pendingTrigger = false;
    this.callback(data);
  }

  /**
   * 安排延迟触发
   */
  private scheduleDelayedTrigger(delay: number, data?: any): void {
    // 避免设置多个定时器
    if (!this.pendingTrigger) {
      this.pendingTrigger = true;
      this.timeoutId = safeSetTimeout(() => {
        this.executeTrigger(data);
        this.timeoutId = null;
      }, delay);
    }
  }

  /**
   * 取消超时定时器
   */
  private cancelTimeout(): void {
    safeClearTimeout(this.timeoutId);
    this.timeoutId = null;
  }
}

/**
 * 替换控制器实现
 */
export class ReplacementControllerImpl implements ReplacementController {
  private pendingValue: any = null;
  private hasPending: boolean = false;

  /**
   * 设置待处理的值
   * @param value 待处理的值
   */
  setPendingValue(value: any): void {
    this.pendingValue = value;
    this.hasPending = true;
  }

  /**
   * 处理待处理的值
   * @returns 处理后的值
   */
  processPendingValue(): any {
    if (this.hasPending) {
      const value = this.pendingValue;
      this.clearPendingValue();
      return value;
    }
    return null;
  }

  /**
   * 清除待处理的值
   */
  clearPendingValue(): void {
    this.pendingValue = null;
    this.hasPending = false;
  }

  /**
   * 检查是否有待处理的值
   * @returns 是否有待处理的值
   */
  hasPendingValue(): boolean {
    return this.hasPending;
  }
}

/**
 * 时序控制器实现
 */
export class TimingControllerImpl implements TimingController {
  private debounceController: DebounceController;
  private throttleController: ThrottleController;
  private replacementController: ReplacementController;

  /**
   * 构造函数
   * @param config 配置参数
   */
  constructor(config?: TimingControllerConfig) {
    this.debounceController = new DebounceControllerImpl();
    this.throttleController = new ThrottleControllerImpl();
    this.replacementController = new ReplacementControllerImpl();

    // 应用配置
    const debounceDelay = config?.debounceDelay || TIMING_CONSTANTS.DEFAULT_DEBOUNCE_DELAY;
    const throttleInterval = config?.throttleInterval || TIMING_CONSTANTS.DEFAULT_THROTTLE_INTERVAL;

    // 默认设置（可以在外部重新设置）
    this.debounceController.setup(debounceDelay, () => {});
    this.throttleController.setup(throttleInterval, () => {});
  }

  /**
   * 防抖控制器实例
   */
  get debounce(): DebounceController {
    return this.debounceController;
  }

  /**
   * 节流控制器实例
   */
  get throttle(): ThrottleController {
    return this.throttleController;
  }

  /**
   * 替换控制器实例
   */
  get replacement(): ReplacementController {
    return this.replacementController;
  }

  /**
   * 重置所有控制器状态
   */
  reset(): void {
    this.debounceController.cancel();
    this.throttleController.clear();
    this.replacementController.clearPendingValue();
  }

  /**
   * 销毁控制器实例，清除所有定时器
   */
  destroy(): void {
    this.reset();
    // 可以在这里添加其他清理逻辑
  }
}

/**
 * 创建时序控制器的工厂函数
 * @param config 配置参数
 * @returns 时序控制器实例
 */
export function createTimingController(config?: TimingControllerConfig): TimingController {
  return new TimingControllerImpl(config);
}

/**
 * 创建防抖控制器的工厂函数
 * @param delay 延迟时间
 * @param callback 回调函数
 * @returns 防抖控制器实例
 */
export function createDebounceController(delay?: number, callback?: Function): DebounceController {
  const controller = new DebounceControllerImpl();
  if (delay !== undefined || callback !== undefined) {
    controller.setup(delay || TIMING_CONSTANTS.DEFAULT_DEBOUNCE_DELAY, callback || (() => {}));
  }
  return controller;
}

/**
 * 创建节流控制器的工厂函数
 * @param interval 时间间隔
 * @param callback 回调函数
 * @returns 节流控制器实例
 */
export function createThrottleController(interval?: number, callback?: Function): ThrottleController {
  const controller = new ThrottleControllerImpl();
  if (interval !== undefined || callback !== undefined) {
    controller.setup(interval || TIMING_CONSTANTS.DEFAULT_THROTTLE_INTERVAL, callback || (() => {}));
  }
  return controller;
}

/**
 * 创建替换控制器的工厂函数
 * @returns 替换控制器实例
 */
export function createReplacementController(): ReplacementController {
  return new ReplacementControllerImpl();
}

/**
 * 工具函数：防抖
 * @param func 需要防抖的函数
 * @param delay 延迟时间
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(func: T, delay: number = TIMING_CONSTANTS.DEFAULT_DEBOUNCE_DELAY): (...args: Parameters<T>) => void {
  // 使用any类型以适应任何环境中setTimeout返回的类型
  let timeoutId: any | null = null;
  
  return function(this: any, ...args: Parameters<T>): void {
    safeClearTimeout(timeoutId);
    timeoutId = safeSetTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * 工具函数：节流
 * @param func 需要节流的函数
 * @param interval 时间间隔
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(func: T, interval: number = TIMING_CONSTANTS.DEFAULT_THROTTLE_INTERVAL): (...args: Parameters<T>) => void {
  let lastCall = 0;
  
  return function(this: any, ...args: Parameters<T>): void {
    const now = Date.now();
    if (now - lastCall >= interval) {
      lastCall = now;
      func.apply(this, args);
    }
  };
}

/**
 * TimingManager类：管理多个时序控制器
 */
export class TimingManager {
  private controllers: Map<string, TimingController> = new Map();
  private static instance: TimingManager | null = null;

  /**
   * 获取单例实例
   */
  static getInstance(): TimingManager {
    if (!TimingManager.instance) {
      TimingManager.instance = new TimingManager();
    }
    return TimingManager.instance;
  }

  /**
   * 创建或获取时序控制器
   * @param id 控制器ID
   * @param config 配置参数
   * @returns 时序控制器实例
   */
  getController(id: string, config?: TimingControllerConfig): TimingController {
    if (!this.controllers.has(id)) {
      this.controllers.set(id, createTimingController(config));
    }
    return this.controllers.get(id)!;
  }

  /**
   * 移除指定的时序控制器
   * @param id 控制器ID
   */
  removeController(id: string): void {
    const controller = this.controllers.get(id);
    if (controller) {
      controller.destroy();
      this.controllers.delete(id);
    }
  }

  /**
   * 重置所有时序控制器
   */
  resetAll(): void {
    this.controllers.forEach((controller: TimingController) => {
      controller.reset();
    });
  }

  /**
   * 销毁所有时序控制器
   */
  destroyAll(): void {
    this.controllers.forEach((controller: TimingController) => {
      controller.destroy();
    });
    this.controllers.clear();
  }
}

/**
 * 全局的TimingManager单例实例
 */
export const globalTimingManager = TimingManager.getInstance();