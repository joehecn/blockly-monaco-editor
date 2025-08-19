/**
 * 时序控制模块契约实现
 * 定义了防抖、节流和编辑替换机制的核心接口和类型
 */

/**
 * 防抖控制器接口
 * 用于控制用户操作的延迟触发
 */
export interface DebounceController {
  /**
   * 设置防抖控制器
   * @param delay 延迟时间（毫秒）
   * @param callback 回调函数
   */
  setup(delay: number, callback: Function): void;
  
  /**
   * 触发防抖操作
   * @param data 传递给回调函数的数据
   */
  trigger(data?: any): void;
  
  /**
   * 取消当前的防抖操作
   */
  cancel(): void;
  
  /**
   * 检查是否有待执行的防抖操作
   * @returns 是否有待执行的操作
   */
  isPending(): boolean;
}

/**
 * 节流控制器接口
 * 用于限制操作的触发频率
 */
export interface ThrottleController {
  /**
   * 设置节流控制器
   * @param interval 最小执行间隔(ms)
   * @param callback 执行回调
   * @param mode 节流模式:
   *   'leading' - 前缘(立即执行第一次)
   *   'trailing' - 后缘(延迟执行最后一次)
   *   'both' - 混合模式(默认值：同时支持前缘立即执行和后缘延迟执行)
   */
  setup(
    interval: number, 
    callback: Function, 
    mode?: 'leading' | 'trailing' | 'both'
  ): void;
  
  /**
   * 触发节流操作
   * @param data 传递给回调的数据
   * @remark 在间隔内的多次调用，仅最后一次参数会被保留
   */
  trigger(data?: any): void;
  
  /**
   * 检查是否可以触发下一个操作
   * @returns 是否可以触发
   */
  canTrigger(): boolean;
  
  /**
   * 清除当前的节流状态
   */
  clear(): void;
}

/**
 * 编辑替换控制器接口
 * 用于处理同步过程中的编辑冲突
 */
export interface ReplacementController {
  /**
   * 设置待处理的值
   * @param value 待处理的值
   */
  setPendingValue(value: any): void;
  
  /**
   * 处理待处理的值
   * @returns 处理后的值
   */
  processPendingValue(): any;
  
  /**
   * 清除待处理的值
   */
  clearPendingValue(): void;
  
  /**
   * 检查是否有待处理的值
   * @returns 是否有待处理的值
   */
  hasPendingValue(): boolean;
}

/**
 * 时序控制器接口
 * 组合了防抖、节流和替换控制功能
 */
export interface TimingController {
  /**
   * 防抖控制器实例
   */
  debounce: DebounceController;
  
  /**
   * 节流控制器实例
   */
  throttle: ThrottleController;
  
  /**
   * 替换控制器实例
   */
  replacement: ReplacementController;
  
  /**
   * 重置所有控制器状态
   */
  reset(): void;
  
  /**
   * 销毁控制器实例，清除所有定时器
   */
  destroy(): void;
}

/**
 * 时序控制器配置接口
 */
export interface TimingControllerConfig {
  /**
   * 防抖延迟时间（毫秒），默认300ms
   */
  debounceDelay?: number;
  
  /**
   * 节流间隔时间（毫秒），默认100ms
   */
  throttleInterval?: number;
}

/**
 * 时序控制常量
 */
export const TIMING_CONSTANTS = {
  /**
   * 默认防抖延迟时间（毫秒）
   */
  DEFAULT_DEBOUNCE_DELAY: 300,
  
  /**
   * 默认节流间隔时间（毫秒）
   */
  DEFAULT_THROTTLE_INTERVAL: 100,
  
  /**
   * 最大防抖延迟时间（毫秒）
   */
  MAX_DEBOUNCE_DELAY: 2000,
  
  /**
   * 最小节流间隔时间（毫秒）
   */
  MIN_THROTTLE_INTERVAL: 50
};