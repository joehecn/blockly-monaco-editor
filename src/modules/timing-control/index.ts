import type { DebounceController, ThrottleController, ReplacementController, TimingController, TimingControllerConfig } from './contracts';
import { TIMING_CONSTANTS } from './contracts';

function safeSetTimeout(callback: Function, delay: number): any {
  return setTimeout(callback, delay);
}

function safeClearTimeout(timeoutId: any | null): void {
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
  }
}

/**
 * 节流控制器实现类
 * 完全分离三种节流模式：leading、trailing 和 both
 */
export class ThrottleControllerImpl implements ThrottleController {
  private interval: number = TIMING_CONSTANTS.DEFAULT_THROTTLE_INTERVAL;
  private callback: Function = () => {};
  private mode: 'leading' | 'trailing' | 'both' = 'both'; // 默认使用混合模式
  
  private previous: number = -Infinity; // 上一次执行的时间戳
  private timeoutId: any | null = null; // 定时器ID
  private lastData: any = null; // 保存最后一次调用的参数
  private timeProvider: () => number = Date.now; // 时间提供函数
  
  /**
   * 构造函数 - 初始化节流控制器
   */
  constructor() {
    // 初始化默认值
  }

  /**
   * 设置节流控制器
   */
  setup(
    interval: number,
    callback: Function,
    mode?: 'leading' | 'trailing' | 'both'
  ): void {
    this.interval = Math.max(
      TIMING_CONSTANTS.MIN_THROTTLE_INTERVAL,
      interval || TIMING_CONSTANTS.DEFAULT_THROTTLE_INTERVAL
    );
    this.callback = callback || (() => {});
    this.mode = mode || 'both'; // 默认使用混合模式
    this.clear();
  }

  /**
   * 触发节流操作
   * 根据当前设置的模式分别处理：leading、trailing 或 both
   */
  trigger(data?: any): void {
    const now = this.timeProvider();
    const timeSinceLast = now - this.previous;
    const currentData = data;

    // 根据不同的模式进行处理
    if (this.mode === 'leading') {
      this._handleLeadingMode(now, timeSinceLast, currentData);
    } else if (this.mode === 'trailing') {
      this._handleTrailingMode(now, timeSinceLast, currentData);
    } else if (this.mode === 'both') {
      this._handleBothMode(now, timeSinceLast, currentData);
    }
  }

  /**
   * 处理 leading 模式
   * 立即执行第一次调用，然后在间隔时间后才能再次执行
   */
  private _handleLeadingMode(now: number, timeSinceLast: number, data: any): void {
    // 首次调用或间隔时间已过（严格大于间隔时间）
    const shouldExecuteImmediately = this.previous === -Infinity || timeSinceLast > this.interval;
    
    if (shouldExecuteImmediately) {
      // 清除可能存在的定时器
      if (this.timeoutId) {
        safeClearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      
      // 执行回调
      this.previous = now;
      
      if (this.callback && typeof this.callback === 'function') {
        this.callback(data);
      }
    }
    // 在时间窗口内或刚好到达边界，不执行任何操作
  }

  /**
   * 处理 trailing 模式
   * 仅在最后一次触发后的延迟时间后执行
   */
  private _handleTrailingMode(now: number, timeSinceLast: number, currentData: any): void {
    // 1. 清除任何可能存在的定时器
    if (this.timeoutId) {
      safeClearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    // 2. 记录当前的数据（这将是最后一次调用的数据）
    this.lastData = currentData;
    
    // 3. 首次调用时，设置初始 previous 值
    if (this.previous === -Infinity) {
      this.previous = now;
    }
    
    // 4. 计算延迟时间
    const remaining = this.interval - timeSinceLast;
    const delay = Math.max(1, remaining > 0 ? remaining : this.interval); // 确保延迟至少为1ms
    
    // 5. 定义一个内部函数来安全地执行回调
    const safeExecuteCallback = (data: any) => {
      if (this.callback && typeof this.callback === 'function' && data !== null) {
        this.callback(data);
        // 更新previous时间戳
        this.previous = this.timeProvider();
      }
    };
    
    // 6. 设置新的定时器 - 这是trailing模式下唯一应该执行回调的地方
    const timeoutCallback = () => {
      // 执行回调
      safeExecuteCallback(this.lastData);
      
      // 重置状态
      this.timeoutId = null;
      this.lastData = null;
    };
    
    this.timeoutId = safeSetTimeout(timeoutCallback, delay);
  }

  /**
   * 处理 both 模式
   * 立即执行第一次调用，并在时间窗口结束时执行最后一次调用
   */
  private _handleBothMode(now: number, timeSinceLast: number, data: any): void {
    // 首次调用或间隔时间已过
    const shouldExecuteImmediately = this.previous === -Infinity || timeSinceLast >= this.interval;
    
    if (shouldExecuteImmediately) {
      // 清除可能存在的定时器
      if (this.timeoutId) {
        safeClearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      
      // 执行回调
      this.previous = now;
      
      if (this.callback && typeof this.callback === 'function') {
        this.callback(data);
      }
    } else {
      // 在时间窗口内，设置trailing定时器（both模式专用）
      // 清除之前的定时器
      if (this.timeoutId) {
        safeClearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      
      // 更新lastData为当前调用的数据
      this.lastData = data;
      
      // 设置新的定时器（both模式专用实现）
      const delay = Math.max(0, this.interval - (now - this.previous));
      const currentLastData = this.lastData;
      
      this.timeoutId = safeSetTimeout(() => {
        // 执行回调
        if (this.callback && typeof this.callback === 'function' && currentLastData !== null) {
          this.callback(currentLastData);
        }
        
        // 重置状态
        this.timeoutId = null;
        // both模式下不更新previous，保持与leading模式一致的时间窗口
      }, delay);
    }
  }

  /**
   * 检查是否可以触发下一个操作
   */
  canTrigger(): boolean {
    const now = this.timeProvider();
    const remaining = this.interval - (now - this.previous);
    return remaining <= 0;
  }

  /**
   * 清除当前的节流状态
   */
  clear(): void {
    this.previous = -Infinity;
    this.lastData = null;
    
    if (this.timeoutId) {
      safeClearTimeout(this.timeoutId);
    }
    this.timeoutId = null;
  }

  /**
   * 设置时间提供函数（主要用于测试）
   */
  setTimeProvider(provider: () => number): void {
    this.timeProvider = provider;
  }
  
  /**
   * 获取内部状态（主要用于调试和测试）
   */
  getInternalState(): {
    previous: number;
    timeoutId: any | null;
    lastData: any;
    interval: number;
    mode: 'leading' | 'trailing' | 'both';
  } {
    return {
      previous: this.previous,
      timeoutId: this.timeoutId,
      lastData: this.lastData,
      interval: this.interval,
      mode: this.mode
    };
  }
}

/**
 * 防抖控制器实现类
 */
export class DebounceControllerImpl implements DebounceController {
  private timeoutId: any | null = null;
  private delay: number = TIMING_CONSTANTS.DEFAULT_DEBOUNCE_DELAY;
  private callback: Function = () => {};

  /**
   * 设置防抖控制器
   */
  setup(delay: number, callback: Function): void {
    this.delay = delay;
    this.callback = callback;
  }

  /**
   * 触发防抖操作
   */
  trigger(data?: any): void {
    this.cancel();
    this.timeoutId = safeSetTimeout(() => {
      this.callback(data);
      this.timeoutId = null;
    }, this.delay);
  }

  /**
   * 取消防抖操作
   */
  cancel(): void {
    safeClearTimeout(this.timeoutId);
    this.timeoutId = null;
  }

  /**
   * 检查是否有待执行的防抖操作
   */
  isPending(): boolean {
    return this.timeoutId !== null;
  }
}

/**
 * 编辑替换控制器实现类
 */
export class ReplacementControllerImpl implements ReplacementController {
  private pendingValue: any = null;
  private hasPending: boolean = false;

  /**
   * 设置待处理的值
   */
  setPendingValue(value: any): void {
    this.pendingValue = value;
    this.hasPending = true;
  }

  /**
   * 处理待处理的值
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
   */
  hasPendingValue(): boolean {
    return this.hasPending;
  }
}

/**
 * 时序控制器实现类
 * 组合了防抖、节流和替换控制功能
 */
export class TimingControllerImpl implements TimingController {
  debounce: DebounceController = new DebounceControllerImpl();
  throttle: ThrottleController = new ThrottleControllerImpl();
  replacement: ReplacementController = new ReplacementControllerImpl();

  /**
   * 构造函数
   */
  constructor(config?: TimingControllerConfig) {
    if (config?.debounceDelay) {
      this.debounce.setup(config.debounceDelay, () => {});
    }
    if (config?.throttleInterval) {
      this.throttle.setup(config.throttleInterval, () => {});
    }
  }

  /**
   * 重置所有控制器状态
   */
  reset(): void {
    this.debounce.cancel();
    this.throttle.clear();
    this.replacement.clearPendingValue();
  }

  /**
   * 销毁控制器实例，清除所有定时器
   */
  destroy(): void {
    this.reset();
  }
}

export function createTimingController(config?: TimingControllerConfig): TimingController {
  return new TimingControllerImpl(config);
}

export function createDebounceController(delay?: number, callback?: Function): DebounceController {
  const controller = new DebounceControllerImpl();
  if (delay !== undefined || callback !== undefined) {
    controller.setup(delay || TIMING_CONSTANTS.DEFAULT_DEBOUNCE_DELAY, callback || (() => {}));
  }
  return controller;
}

/**
 * 创建节流控制器
 */
export function createThrottleController(config?: number | { interval?: number, callback?: Function, leading?: boolean, trailing?: boolean }, callback?: Function): ThrottleController {
  const controller = new ThrottleControllerImpl();
  
  if (typeof config === 'number') {
    // 兼容旧的调用方式: createThrottleController(interval, callback)
    controller.setup(config, callback || (() => {}));
  } else if (config) {
    // 新的调用方式: createThrottleController({ interval, callback, leading, trailing })
    const mode = (config.leading && config.trailing) ? 'both' : (config.trailing ? 'trailing' : 'leading');
    controller.setup(
      config.interval || TIMING_CONSTANTS.DEFAULT_THROTTLE_INTERVAL,
      config.callback || (() => {}),
      mode
    );
  }
  
  return controller;
}

export function createReplacementController(): ReplacementController {
  return new ReplacementControllerImpl();
}

export function debounce<T extends (...args: any[]) => any>(func: T, _delay: number = TIMING_CONSTANTS.DEFAULT_DEBOUNCE_DELAY): (...args: Parameters<T>) => void {
  let timeoutId: any | null = null;
  
  return function(this: any, ...args: Parameters<T>): void {
    safeClearTimeout(timeoutId);
    timeoutId = safeSetTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, _delay);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  interval: number = TIMING_CONSTANTS.DEFAULT_THROTTLE_INTERVAL
): (...args: Parameters<T>) => void {
  let lastExecTime = -Infinity;
  let timeoutId: any | null = null;
  let pendingArgs: Parameters<T> | null = null;
  let pendingContext: any = null;
  let isPending = false;

  const execute = (args: Parameters<T>, context: any) => {
    func.apply(context, args);
    lastExecTime = Date.now();
  };

  return function (this: any, ...args: Parameters<T>): void {
    const now = Date.now();
    
    pendingContext = this;
    pendingArgs = args;
    isPending = true;
    
    if (now - lastExecTime >= interval) {
      if (timeoutId) {
        safeClearTimeout(timeoutId);
        timeoutId = null;
      }
      execute(args, this);
      isPending = false;
    }
    else {
      // Clear any existing timeout to reset
      if (timeoutId) {
        safeClearTimeout(timeoutId);
        timeoutId = null;
      }
      const delay = interval - (now - lastExecTime);
      
      timeoutId = safeSetTimeout(() => {
        timeoutId = null;
        if (isPending && pendingArgs && pendingContext) {
          execute(pendingArgs, pendingContext);
          isPending = false;
        }
      }, delay);
    }
  };
}

/**
 * 时序管理器类
 * 单例模式，统一管理多个时序控制器
 */
export class TimingManager {
  private controllers: Map<string, TimingController> = new Map();
  private static instance: TimingManager | null = null;

  /**
   * 获取时序管理器单例
   */
  static getInstance(): TimingManager {
    if (!TimingManager.instance) {
      TimingManager.instance = new TimingManager();
    }
    return TimingManager.instance;
  }

  /**
   * 获取指定ID的控制器，如果不存在则创建
   */
  getController(id: string, config?: TimingControllerConfig): TimingController {
    if (!this.controllers.has(id)) {
      this.controllers.set(id, createTimingController(config));
    }
    return this.controllers.get(id)!;
  }

  /**
   * 移除指定ID的控制器
   */
  removeController(id: string): void {
    const controller = this.controllers.get(id);
    if (controller) {
      controller.destroy();
      this.controllers.delete(id);
    }
  }

  /**
   * 重置所有控制器
   */
  resetAll(): void {
    this.controllers.forEach((controller: TimingController) => {
      controller.reset();
    });
  }

  /**
   * 销毁所有控制器
   */
  destroyAll(): void {
    this.controllers.forEach((controller: TimingController) => {
      controller.destroy();
    });
    this.controllers.clear();
  }
}

/**
 * 全局时序管理器实例
 */
export const globalTimingManager = TimingManager.getInstance();
