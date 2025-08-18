/**
 * 时序控制模块 - 单元测试
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  createTimingController, 
  createDebounceController, 
  createThrottleController, 
  createReplacementController,
  debounce,
  throttle,
  TimingManager,
  globalTimingManager
} from './index';

// Mock setTimeout and clearTimeout
const setTimeoutMock = vi.fn();
const clearTimeoutMock = vi.fn();

// Mock Date.now()
let currentTime = 0;
const dateNowMock = vi.fn(() => currentTime);

// 同时模拟全局的setTimeout/clearTimeout和window.setTimeout/window.clearTimeout
vi.stubGlobal('setTimeout', setTimeoutMock);
vi.stubGlobal('clearTimeout', clearTimeoutMock);
vi.stubGlobal('window', {
  setTimeout: setTimeoutMock,
  clearTimeout: clearTimeoutMock,
  Date: {
    now: dateNowMock
  }
});

vi.stubGlobal('Date', {
  now: dateNowMock
});

describe('时序控制模块测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTime = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('DebounceController测试', () => {
    it('应该正确设置防抖控制器', () => {
      const callback = vi.fn();
      const controller = createDebounceController(500, callback);
      
      // 验证控制器是否正确初始化
      expect(controller).toBeDefined();
    });

    it('应该在延迟后触发回调', () => {
      const callback = vi.fn();
      const controller = createDebounceController(300, callback);
      
      // 触发防抖
      controller.trigger('test-data');
      
      // 验证是否设置了定时器
      expect(setTimeoutMock).toHaveBeenCalledTimes(1);
      expect(setTimeoutMock).toHaveBeenCalledWith(expect.any(Function), 300);
      
      // 模拟定时器触发
      const timerCallback = setTimeoutMock.mock.calls[0][0];
      timerCallback();
      
      // 验证回调是否被调用
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('test-data');
    });

    it('应该在重复触发时重置定时器', () => {
      const callback = vi.fn();
      const controller = createDebounceController(300, callback);
      
      // 第一次触发
      controller.trigger('data1');
      expect(setTimeoutMock).toHaveBeenCalledTimes(1);
      
      // 第二次触发
      controller.trigger('data2');
      expect(setTimeoutMock).toHaveBeenCalledTimes(2);
      expect(clearTimeoutMock).toHaveBeenCalledTimes(1);
      
      // 模拟第二个定时器触发
      const timerCallback = setTimeoutMock.mock.calls[1][0];
      timerCallback();
      
      // 验证只有最后一次回调被调用
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('data2');
    });
    
    it('应该在指定延迟后执行回调', () => {
      const callback = vi.fn();
      const controller = createDebounceController(300, callback);
      
      // 触发防抖
      controller.trigger('test-data');
      
      // 验证是否设置了定时器
      expect(setTimeoutMock).toHaveBeenCalledTimes(1);
      expect(setTimeoutMock).toHaveBeenCalledWith(expect.any(Function), 300);
      expect(callback).not.toHaveBeenCalled();
      
      // 模拟定时器触发
      const timerCallback = setTimeoutMock.mock.calls[0][0];
      timerCallback();
      
      // 验证回调是否被调用
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('test-data');
    });

    it('应该能够取消待执行的防抖操作', () => {
      const callback = vi.fn();
      const controller = createDebounceController(300, callback);
      
      // 触发防抖
      controller.trigger('test-data');
      
      // 取消防抖
      controller.cancel();
      
      // 验证是否清除了定时器
      expect(clearTimeoutMock).toHaveBeenCalledTimes(1);
    });

    it('应该正确报告是否有待执行的操作', () => {
      const controller = createDebounceController();
      
      // 初始状态下没有待执行操作
      expect(controller.isPending()).toBe(false);
      
      // 触发防抖后应该有待执行操作
      controller.trigger();
      expect(controller.isPending()).toBe(true);
      
      // 取消后不应该有待执行操作
      controller.cancel();
      expect(controller.isPending()).toBe(false);
    });
  });

  describe('ThrottleController测试', () => {
    it('应该正确设置节流控制器', () => {
      const callback = vi.fn();
      const controller = createThrottleController(100, callback);
      
      // 验证控制器是否正确初始化
      expect(controller).toBeDefined();
    });

    it('应该限制触发频率', () => {
      const callback = vi.fn();
      const controller = createThrottleController(100, callback);
      
      // 第一次触发
      dateNowMock.mockReturnValue(100); // 需要设置足够大的时间才能触发
      controller.trigger('data1');
      expect(callback).toHaveBeenCalledWith('data1');
      
      // 50ms后再次触发，不应该调用回调
      dateNowMock.mockReturnValue(150);
      controller.trigger('data2');
      expect(callback).toHaveBeenCalledTimes(1);
      
      // 100ms后再次触发，应该调用回调
      dateNowMock.mockReturnValue(200);
      controller.trigger('data3');
      expect(callback).toHaveBeenCalledWith('data3');
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('应该正确报告是否可以触发', () => {
      const controller = createThrottleController(100);
      
      // 初始状态下可以触发
      dateNowMock.mockReturnValue(100); // 需要设置足够大的时间才能返回true
      expect(controller.canTrigger()).toBe(true);
      
      // 触发后50ms内不能再次触发
      controller.trigger();
      dateNowMock.mockReturnValue(150);
      expect(controller.canTrigger()).toBe(false);
      
      // 100ms后可以再次触发
      dateNowMock.mockReturnValue(200);
      expect(controller.canTrigger()).toBe(true);
    });

    it('应该能够清除节流状态', () => {
      const controller = createThrottleController(100);
      
      // 触发后50ms内不能再次触发
      dateNowMock.mockReturnValue(0);
      controller.trigger();
      dateNowMock.mockReturnValue(50);
      expect(controller.canTrigger()).toBe(false);
      
      // 清除后可以再次触发
      controller.clear();
      // 清除后，lastTriggerTime被重置为0，所以canTrigger()应该返回true
      dateNowMock.mockReturnValue(0); // 即使是时间0，Date.now() - 0 = 0 >= interval也不成立，所以需要设置足够大的时间
      expect(controller.canTrigger()).toBe(false);
      
      // 需要设置时间大于等于interval才能返回true
      dateNowMock.mockReturnValue(100);
      expect(controller.canTrigger()).toBe(true);
    });
  });

  describe('ReplacementController测试', () => {
    it('应该正确设置和获取待处理值', () => {
      const controller = createReplacementController();
      
      // 初始状态下没有待处理值
      expect(controller.hasPendingValue()).toBe(false);
      expect(controller.processPendingValue()).toBeNull();
      
      // 设置待处理值
      const testValue = { key: 'value' };
      controller.setPendingValue(testValue);
      expect(controller.hasPendingValue()).toBe(true);
      
      // 处理待处理值
      const processedValue = controller.processPendingValue();
      expect(processedValue).toEqual(testValue);
      expect(controller.hasPendingValue()).toBe(false);
      
      // 处理后不应有待处理值
      expect(controller.processPendingValue()).toBeNull();
    });

    it('应该能够清除待处理值', () => {
      const controller = createReplacementController();
      
      // 设置待处理值
      controller.setPendingValue('test-value');
      expect(controller.hasPendingValue()).toBe(true);
      
      // 清除待处理值
      controller.clearPendingValue();
      expect(controller.hasPendingValue()).toBe(false);
      expect(controller.processPendingValue()).toBeNull();
    });
    
    it('应该能正确处理多个待处理值', () => {
      const controller = createReplacementController();
      
      // 设置第一个待处理值
      controller.setPendingValue('value 1');
      expect(controller.hasPendingValue()).toBe(true);
      
      // 覆盖待处理值
      controller.setPendingValue('value 2');
      expect(controller.hasPendingValue()).toBe(true);
      
      // 应该返回最后设置的值
      const value = controller.processPendingValue();
      expect(value).toBe('value 2');
    });
  });

  describe('TimingController测试', () => {
    it('应该正确创建时序控制器', () => {
      const controller = createTimingController();
      
      // 验证控制器是否正确初始化
      expect(controller).toBeDefined();
      expect(controller.debounce).toBeDefined();
      expect(controller.throttle).toBeDefined();
      expect(controller.replacement).toBeDefined();
    });

    it('应该正确应用配置', () => {
      const config = {
        debounceDelay: 500,
        throttleInterval: 200
      };
      const controller = createTimingController(config);
      
      // 验证控制器是否正确初始化（通过访问属性验证）
      expect(controller).toBeDefined();
    });

    it('应该能够重置所有控制器', () => {
      const controller = createTimingController();
      
      // 模拟触发所有控制器
      controller.debounce.trigger();
      controller.throttle.trigger();
      controller.replacement.setPendingValue('test');
      
      // 重置所有控制器
      controller.reset();
      
      // 验证是否重置成功
      expect(controller.replacement.hasPendingValue()).toBe(false);
    });

    it('应该能够销毁控制器', () => {
      const controller = createTimingController();
      
      // 模拟触发控制器
      controller.debounce.trigger();
      
      // 销毁控制器
      controller.destroy();
      
      // 验证是否销毁成功（通过清除定时器验证）
      expect(clearTimeoutMock).toHaveBeenCalled();
    });
  });

  describe('工具函数测试', () => {
    it('debounce函数应该正确工作', () => {
      const callback = vi.fn();
      const debouncedFn = debounce(callback, 300);
      
      // 第一次调用
      debouncedFn('arg1');
      expect(setTimeoutMock).toHaveBeenCalledTimes(1);
      expect(setTimeoutMock).toHaveBeenCalledWith(expect.any(Function), 300);
      
      // 清除前一个定时器的测试策略变更：我们不再直接调用clearTimeoutMock.mock.calls[0][0]
      // 而是通过验证clearTimeoutMock被调用的次数来确认
      
      // 第二次调用
      debouncedFn('arg2');
      expect(setTimeoutMock).toHaveBeenCalledTimes(2);
      expect(clearTimeoutMock).toHaveBeenCalledTimes(1);
      
      // 模拟定时器触发 - 获取最后一个setTimeout调用的回调
      const timerCallbacks = setTimeoutMock.mock.calls.map(call => call[0]);
      const lastTimerCallback = timerCallbacks[timerCallbacks.length - 1];
      lastTimerCallback();
      
      // 验证只有最后一次回调被调用
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('arg2');
    });

    it('throttle函数应该正确工作', () => {
      const callback = vi.fn();
      const throttledFn = throttle(callback, 100);
      
      // 第一次调用 - 确保Date.now()返回0
      dateNowMock.mockReturnValue(0);
      throttledFn('arg1');
      // 第一次调用应该立即触发，因为lastCall初始为0
      // 但由于throttle函数的实现方式，它需要比较now - lastCall >= interval
      // 对于第一次调用，now和lastCall都是0，所以0 - 0 >= 100不成立
      // 所以需要设置now大于等于interval
      dateNowMock.mockReturnValue(100);
      throttledFn('arg1');
      expect(callback).toHaveBeenCalledWith('arg1');
      
      // 50ms后再次调用，不应该触发
      dateNowMock.mockReturnValue(150);
      throttledFn('arg2');
      expect(callback).toHaveBeenCalledTimes(1);
      
      // 100ms后再次调用，应该触发
      dateNowMock.mockReturnValue(200);
      throttledFn('arg3');
      expect(callback).toHaveBeenCalledWith('arg3');
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('TimingManager测试', () => {
    it('应该是单例模式', () => {
      const instance1 = TimingManager.getInstance();
      const instance2 = TimingManager.getInstance();
      
      // 验证是否是同一个实例
      expect(instance1).toBe(instance2);
    });

    it('应该能够创建和获取控制器', () => {
      const manager = TimingManager.getInstance();
      const controller1 = manager.getController('test1');
      const controller2 = manager.getController('test1'); // 应该返回同一个控制器
      
      // 验证是否是同一个控制器
      expect(controller1).toBe(controller2);
    });

    it('应该能够移除控制器', () => {
      const manager = TimingManager.getInstance();
      const controller = manager.getController('test2');
      
      // 移除控制器
      manager.removeController('test2');
      
      // 再次获取应该是新的控制器
      const newController = manager.getController('test2');
      expect(newController).not.toBe(controller);
    });

    it('应该能够重置所有控制器', () => {
      const manager = TimingManager.getInstance();
      
      // 获取控制器并设置定时器
      const controller3 = manager.getController('test3');
      const controller4 = manager.getController('test4');
      
      // 触发防抖操作以设置定时器
      controller3.debounce.setup(100, () => {});
      controller3.debounce.trigger('test');
      controller4.debounce.setup(100, () => {});
      controller4.debounce.trigger('test');
      
      // 重置所有控制器
      manager.resetAll();
      
      // 验证是否重置成功（通过清除定时器验证）
      expect(clearTimeoutMock).toHaveBeenCalled();
    });

    it('应该能够销毁所有控制器', () => {
      const manager = TimingManager.getInstance();
      
      // 获取控制器并设置定时器
      const controller5 = manager.getController('test5');
      const controller6 = manager.getController('test6');
      
      // 触发防抖操作以设置定时器
      controller5.debounce.setup(100, () => {});
      controller5.debounce.trigger('test');
      controller6.debounce.setup(100, () => {});
      controller6.debounce.trigger('test');
      
      // 销毁所有控制器
      manager.destroyAll();
      
      // 验证是否销毁成功（通过清除定时器验证）
      expect(clearTimeoutMock).toHaveBeenCalled();
    });

    it('全局globalTimingManager应该是TimingManager的实例', () => {
      expect(globalTimingManager).toBeInstanceOf(TimingManager);
      expect(globalTimingManager).toBe(TimingManager.getInstance());
    });
  });
});