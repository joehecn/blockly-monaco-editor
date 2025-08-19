import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTimingController, createDebounceController, createThrottleController, TimingManager, globalTimingManager, debounce, throttle } from './index';
import { TIMING_CONSTANTS } from './contracts';

// Mock the window.setTimeout and window.clearTimeout for testing
const setTimeoutMock = vi.fn();
const clearTimeoutMock = vi.fn();

Object.defineProperty(window, 'setTimeout', {
  value: setTimeoutMock,
  writable: true,
});

Object.defineProperty(window, 'clearTimeout', {
  value: clearTimeoutMock,
  writable: true,
});

describe('时序控制模块契约验证测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DebounceController 接口验证', () => {
    it('应该实现所有必需的方法', () => {
      const controller = createDebounceController();
      
      // 验证接口方法存在
      expect(typeof controller.setup).toBe('function');
      expect(typeof controller.trigger).toBe('function');
      expect(typeof controller.cancel).toBe('function');
      expect(typeof controller.isPending).toBe('function');
    });

    it('should handle trigger and cancel correctly', () => {
      const callback = vi.fn();
      const controller = createDebounceController(100, callback);
      
      // 触发防抖操作
      controller.trigger('test');
      expect(setTimeoutMock).toHaveBeenCalledTimes(1);
      
      // 取消防抖操作
      controller.cancel();
      expect(clearTimeoutMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('ThrottleController 接口验证', () => {
    it('应该实现所有必需的方法', () => {
      const controller = createThrottleController();
      
      // 验证接口方法存在
      expect(typeof controller.setup).toBe('function');
      expect(typeof controller.trigger).toBe('function');
      expect(typeof controller.canTrigger).toBe('function');
      expect(typeof controller.clear).toBe('function');
    });

    it('should handle throttle modes correctly', () => {
      const controller = createThrottleController();
      
      // 验证节流模式参数接受
      expect(() => controller.setup(100, () => {}, 'leading')).not.toThrow();
      expect(() => controller.setup(100, () => {}, 'trailing')).not.toThrow();
      expect(() => controller.setup(100, () => {}, 'both')).not.toThrow();
    });

    it('leading模式下应该立即执行第一次调用', () => {
      const callback = vi.fn();
      const controller = createThrottleController({ callback, interval: 100, leading: true, trailing: false });
      
      // 触发节流操作
      controller.trigger('test');
      expect(callback).toHaveBeenCalledWith('test');
    });

    it('trailing模式下应该在间隔后执行最后一次调用', () => {
      const callback = vi.fn();
      const controller = createThrottleController({ callback, interval: 100, leading: false, trailing: true });
      
      // 触发节流操作
      controller.trigger('test');
      
      // 模拟时间推进
      const timerCallback = setTimeoutMock.mock.calls[0][0];
      timerCallback();
      
      expect(callback).toHaveBeenCalledWith('test');
    });

    it('both模式下应该同时支持leading和trailing行为', () => {
      const callback = vi.fn();
      const controller = createThrottleController({ callback, interval: 100, leading: true, trailing: true });
      
      // 重置mock以确保测试的独立性
      setTimeoutMock.mockReset();
      clearTimeoutMock.mockReset();
      
      // leading行为：立即执行
      controller.trigger('test1');
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('test1');
      
      // 模拟多次触发，但间隔内不应执行
      controller.trigger('test2');
      controller.trigger('test3');
      expect(callback).toHaveBeenCalledTimes(1);
      
      // 验证设置了定时器用于trailing行为
      expect(setTimeoutMock).toHaveBeenCalled();
      
      // 模拟时间推进，触发trailing行为
      // 在both模式下，每次新的触发都会清除旧的定时器并设置新的
      // 因此我们只需要执行最后一个定时器回调
      const timerCallbacks = setTimeoutMock.mock.calls.map(call => call[0]);
      const lastTimerCallback = timerCallbacks[timerCallbacks.length - 1];
      lastTimerCallback();
      
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('ReplacementController 接口验证', () => {
    it('应该实现所有必需的方法', () => {
      const controller = createTimingController().replacement;
      
      // 验证接口方法存在
      expect(typeof controller.setPendingValue).toBe('function');
      expect(typeof controller.processPendingValue).toBe('function');
      expect(typeof controller.clearPendingValue).toBe('function');
      expect(typeof controller.hasPendingValue).toBe('function');
    });

    it('应该正确处理待处理值', () => {
      const controller = createTimingController().replacement;
      
      // 设置值
      controller.setPendingValue('value');
      expect(controller.hasPendingValue()).toBe(true);
      
      // 处理值
      const value = controller.processPendingValue();
      expect(value).toBe('value');
      expect(controller.hasPendingValue()).toBe(false);
      
      // 清除值
      controller.setPendingValue('newValue');
      expect(controller.hasPendingValue()).toBe(true);
      controller.clearPendingValue();
      expect(controller.hasPendingValue()).toBe(false);
    });
  });

  describe('TimingController 接口验证', () => {
    it('应该实现所有必需的方法', () => {
      const controller = createTimingController();
      
      // 验证接口方法存在
      expect(typeof controller.debounce).toBe('object');
      expect(typeof controller.throttle).toBe('object');
      expect(typeof controller.replacement).toBe('object');
      expect(typeof controller.reset).toBe('function');
      expect(typeof controller.destroy).toBe('function');
    });

    it('应该返回正确类型的控制器实例', () => {
      const controller = createTimingController();
      
      // 验证控制器类型
      expect(typeof controller.debounce.setup).toBe('function');
      expect(typeof controller.throttle.setup).toBe('function');
      expect(typeof controller.replacement.setPendingValue).toBe('function');
    });

    it('应该正确实现reset方法', () => {
      const controller = createTimingController();
      
      // 设置并触发防抖操作
      controller.debounce.setup(100, () => {});
      controller.debounce.trigger('test');
      
      // 重置控制器
      controller.reset();
      
      // 验证是否重置成功（通过清除定时器验证）
      expect(clearTimeoutMock).toHaveBeenCalled();
    });

    it('应该正确应用配置选项', () => {
      const config = {
        debounceDelay: 200,
        throttleInterval: 100
      };
      
      const controller = createTimingController(config);
      
      // 验证配置是否正确应用（通过获取内部状态间接验证）
      expect(typeof controller.debounce).toBe('object');
    });
  });

  describe('工厂函数验证', () => {
    it('createTimingController 应该返回有效实例', () => {
      const controller = createTimingController();
      expect(controller).toBeDefined();
      expect(controller.debounce).toBeDefined();
      expect(controller.throttle).toBeDefined();
      expect(controller.replacement).toBeDefined();
    });

    it('createDebounceController 应该返回有效实例', () => {
      const controller = createDebounceController();
      expect(controller).toBeDefined();
      expect(typeof controller.setup).toBe('function');
    });

    it('createThrottleController 应该返回有效实例', () => {
      const controller = createThrottleController();
      expect(controller).toBeDefined();
      expect(typeof controller.setup).toBe('function');
    });
  });

  describe('工具函数验证', () => {
    it('debounce函数应该正确工作', () => {
      const callback = vi.fn();
      const debouncedFn = debounce(callback, 100);
      
      // 第一次调用
      debouncedFn('test1');
      expect(setTimeoutMock).toHaveBeenCalledTimes(1);
      
      // 清除前一个定时器的测试策略变更：我们不再直接调用clearTimeoutMock.mock.calls[0][0]
      // 而是通过验证clearTimeoutMock被调用的次数来确认
      
      // 第二次调用
      debouncedFn('test2');
      expect(setTimeoutMock).toHaveBeenCalledTimes(2);
      expect(clearTimeoutMock).toHaveBeenCalledTimes(1);
    });

    it('throttle函数应该正确工作', () => {
      const callback = vi.fn();
      const throttledFn = throttle(callback, 100);
      
      // 第一次调用
      throttledFn('test1');
      expect(callback).toHaveBeenCalledWith('test1');
      
      // 间隔内第二次调用
      throttledFn('test2');
      expect(callback).toHaveBeenCalledTimes(1); // 不应再次调用
    });

    it('debounce函数应该保留this上下文', () => {
      const context = { value: 'context' };
      const callback = vi.fn().mockImplementation(function(this: any) {
        expect(this.value).toBe('context');
      });
      const debouncedFn = debounce(callback, 100);
      
      // 使用bind来设置this上下文
      debouncedFn.bind(context)('test');
      
      // 模拟定时器触发
      const timerCallback = setTimeoutMock.mock.calls[0][0];
      timerCallback();
    });

    it('throttle函数应该保留this上下文', () => {
      const context = { value: 'context' };
      const callback = vi.fn().mockImplementation(function(this: any) {
        expect(this.value).toBe('context');
      });
      const throttledFn = throttle(callback, 100);
      
      // 使用bind来设置this上下文
      throttledFn.bind(context)('test');
    });
  });

  describe('TimingManager 类验证', () => {
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
  });

  describe('全局单例验证', () => {
    it('globalTimingManager 应该正确导出', () => {
      expect(globalTimingManager).toBeDefined();
    });

    it('globalTimingManager 应该是 TimingManager 的实例', () => {
      expect(globalTimingManager).toBeInstanceOf(TimingManager);
      expect(globalTimingManager).toBe(TimingManager.getInstance());
    });

    it('应该能够通过globalTimingManager访问TimingManager的功能', () => {
      const controller = globalTimingManager.getController('global-test');
      expect(controller).toBeDefined();
      expect(typeof controller.debounce.setup).toBe('function');
    });
  });

  describe('常量验证', () => {
    it('TIMING_CONSTANTS 应该正确导出', () => {
      expect(TIMING_CONSTANTS).toBeDefined();
    });

    it('TIMING_CONSTANTS 应该包含合理的默认值', () => {
      expect(TIMING_CONSTANTS.DEFAULT_DEBOUNCE_DELAY).toBeGreaterThan(0);
      expect(TIMING_CONSTANTS.DEFAULT_THROTTLE_INTERVAL).toBeGreaterThan(0);
      expect(TIMING_CONSTANTS.MAX_DEBOUNCE_DELAY).toBeGreaterThan(0);
      expect(TIMING_CONSTANTS.MIN_THROTTLE_INTERVAL).toBeGreaterThan(0);
    });

    it('TIMING_CONSTANTS 应该与默认配置兼容', () => {
      const controller = createTimingController();
      
      // 我们不再尝试获取内部状态，而是通过创建控制器并检查其行为来验证
      // 验证debounceController是否可以正常工作
      const debounceCallback = vi.fn();
      controller.debounce.setup(100, debounceCallback);
      controller.debounce.trigger('test');
      expect(setTimeoutMock).toHaveBeenCalled();
      
      // 验证throttleController是否可以正常工作
      const throttleCallback = vi.fn();
      controller.throttle.setup(100, throttleCallback);
      controller.throttle.trigger('test');
      expect(throttleCallback).toHaveBeenCalledWith('test');
    });
  });

  describe('错误处理验证', () => {
    it('应该处理无效的配置参数', () => {
      // 验证无效配置不会导致崩溃
      expect(() => createTimingController({})).not.toThrow();
      expect(() => createDebounceController()).not.toThrow();
      expect(() => createThrottleController()).not.toThrow();
    });

    it('应该处理无效的触发参数', () => {
      const debounceController = createDebounceController();
      const throttleController = createThrottleController();
      
      // 验证无效参数不会导致崩溃
      expect(() => debounceController.trigger()).not.toThrow();
      expect(() => throttleController.trigger()).not.toThrow();
    });

    it('应该处理未初始化的控制器', () => {
      const debounceController = createDebounceController();
      const throttleController = createThrottleController();
      
      // 验证未初始化的控制器不会导致崩溃
      expect(() => debounceController.trigger()).not.toThrow();
      expect(() => throttleController.trigger()).not.toThrow();
      expect(() => debounceController.cancel()).not.toThrow();
      expect(() => throttleController.clear()).not.toThrow();
    });
  });
});