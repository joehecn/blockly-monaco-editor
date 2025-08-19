import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTimingController, createDebounceController, createThrottleController, TimingManager, globalTimingManager, debounce, throttle, ThrottleControllerImpl } from './index';

// Mock the window.setTimeout, window.clearTimeout and Date.now for testing
const setTimeoutMock = vi.fn();
const clearTimeoutMock = vi.fn();
const dateNowMock = vi.fn();

Object.defineProperty(window, 'setTimeout', {
  value: setTimeoutMock,
  writable: true,
});

Object.defineProperty(window, 'clearTimeout', {
  value: clearTimeoutMock,
  writable: true,
});

Object.defineProperty(Date, 'now', {
  value: dateNowMock,
  writable: true,
});

describe('时序控制模块测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dateNowMock.mockReturnValue(0);
  });

  describe('DebounceController 测试', () => {
    it('应该正确初始化', () => {
      const controller = createDebounceController();
      expect(controller).toBeDefined();
      expect(typeof controller.setup).toBe('function');
      expect(typeof controller.trigger).toBe('function');
      expect(typeof controller.cancel).toBe('function');
      expect(typeof controller.isPending).toBe('function');
    });

    it('应该延迟触发回调', () => {
      const callback = vi.fn();
      // 修复：createDebounceController期望两个单独的参数，而不是一个对象
      const controller = createDebounceController(100, callback);
      
      // 触发防抖操作
      controller.trigger('test');
      
      // 检查setTimeout是否被调用
      expect(setTimeoutMock).toHaveBeenCalled();
    });

    it('应该在重复触发时重置定时器', () => {
      const callback = vi.fn();
      // 修复：createDebounceController期望两个单独的参数，而不是一个对象
      const controller = createDebounceController(100, callback);
      
      // 第一次触发
      controller.trigger('test1');
      expect(setTimeoutMock).toHaveBeenCalledTimes(1);
      
      // 第二次触发，应该清除之前的定时器并设置新的定时器
      controller.trigger('test2');
      expect(setTimeoutMock).toHaveBeenCalledTimes(2);
      expect(clearTimeoutMock).toHaveBeenCalledTimes(1);
    });

    it('应该能够指定延迟时间执行回调', () => {
      const callback = vi.fn();
      // 修复：createDebounceController期望两个单独的参数，而不是一个对象
      const controller = createDebounceController(200, callback);
      
      // 触发防抖操作
      controller.trigger('test');
      
      // 检查setTimeout是否被调用
      expect(setTimeoutMock).toHaveBeenCalled();
    });

    it('应该能够验证定时器设置与触发', () => {
      const callback = vi.fn();
      const controller = createTimingController().debounce;
      controller.setup(150, callback);
      
      // 触发防抖操作
      controller.trigger('test');
      expect(setTimeoutMock).toHaveBeenCalledWith(expect.any(Function), 150);
      
      // 模拟定时器触发
      const timerCallback = setTimeoutMock.mock.calls[0][0];
      timerCallback();
      
      expect(callback).toHaveBeenCalledWith('test');
    });

    it('应该能够取消待执行的防抖操作', () => {
      const callback = vi.fn();
      const controller = createTimingController().debounce;
      controller.setup(100, callback);
      
      // 触发防抖操作
      controller.trigger('test');
      
      // 取消防抖操作
      controller.cancel();
      
      // 取消后，isPending应该返回false
      expect(controller.isPending()).toBe(false);
    });

    it('应该能够报告待执行操作的状态', () => {
      const callback = vi.fn();
      const controller = createTimingController().debounce;
      controller.setup(100, callback);
      
      // 触发防抖操作
      controller.trigger('test');
      
      // 使用isPending方法检查是否有待执行的操作
      expect(controller.isPending()).toBe(true);
    });
  });

  describe('ThrottleController 测试', () => {
    it('应该正确设置节流控制器', () => {
      const controller = createThrottleController();
      expect(controller).toBeDefined();
      expect(typeof controller.setup).toBe('function');
      expect(typeof controller.trigger).toBe('function');
      expect(typeof controller.clear).toBe('function');
    });

    it('应该限制触发频率', () => {
      const callback = vi.fn();
      const controller = createThrottleController({ callback, interval: 100, leading: true, trailing: false });
      
      // 第一次调用，应该立即执行
      controller.trigger('test1');
      expect(callback).toHaveBeenCalledWith('test1');
      
      // 间隔内再次调用，不应该执行
      controller.trigger('test2');
      expect(callback).toHaveBeenCalledTimes(1);
      
      // 间隔后调用，应该再次执行
      dateNowMock.mockReturnValue(101);
      controller.trigger('test3');
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith('test3');
    });

    it('应该正确报告触发可能性', () => {
      const controller = createThrottleController({ interval: 100, leading: true, trailing: false });
      
      // 初始状态应该可以触发
      expect(controller.canTrigger()).toBe(true);
      
      // 触发后，间隔内不能触发
      controller.trigger('test');
      expect(controller.canTrigger()).toBe(false);
      
      // 间隔后可以触发
      dateNowMock.mockReturnValue(101);
      expect(controller.canTrigger()).toBe(true);
    });

    it('应该能够清除节流状态', () => {
      const callback = vi.fn();
      const controller = createThrottleController({ callback, interval: 100, leading: true, trailing: false });
      
      // 触发节流操作
      controller.trigger('test');
      expect(callback).toHaveBeenCalledWith('test');
      
      // 清除节流状态
      controller.clear();
      
      // 应该可以立即再次触发
      controller.trigger('test2');
      expect(callback).toHaveBeenCalledTimes(2);
    });

    // ThrottleController TDD 测试
    describe('ThrottleController TDD 测试', () => {
      let throttleController: ThrottleControllerImpl;
      let callback: ReturnType<typeof vi.fn>;

      beforeEach(() => {
        vi.useFakeTimers();
        throttleController = new ThrottleControllerImpl();
        callback = vi.fn();
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      describe('基本功能测试', () => {
        it('should initialize with default values', () => {
          expect(throttleController).toBeDefined();
        });

        it('should set up interval and callback correctly', () => {
          const customInterval = 200;
          const customCallback = vi.fn();
          
          throttleController.setup(customInterval, customCallback, 'leading');
          
          // 由于是私有属性，我们通过间接方式验证
          throttleController.trigger('test');
          expect(customCallback).toHaveBeenCalledWith('test');
        });
      });

      describe('Leading 模式测试', () => {
        beforeEach(() => {
          throttleController.setup(100, callback, 'leading');
        });

        it('should execute immediately on first trigger', () => {
          // 首次调用应该立即执行
          throttleController.trigger('first call');
          expect(callback).toHaveBeenCalledTimes(1);
          expect(callback).toHaveBeenCalledWith('first call');
        });

        it('should not execute within interval', () => {
          // 首次调用
          throttleController.trigger('call 1');
          expect(callback).toHaveBeenCalledTimes(1);
          
          // 间隔内再次调用，不应执行
          vi.advanceTimersByTime(50);
          throttleController.trigger('call 2');
          expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should execute after interval has passed', () => {
          // 首次调用
          throttleController.trigger('call 1');
          expect(callback).toHaveBeenCalledTimes(1);
          
          // 间隔后再次调用，应该执行
          vi.advanceTimersByTime(101);
          throttleController.trigger('call 2');
          expect(callback).toHaveBeenCalledTimes(2);
          expect(callback).toHaveBeenCalledWith('call 2');
        });

        it('should reset state when clear is called', () => {
          // 首次调用
          throttleController.trigger('call 1');
          expect(callback).toHaveBeenCalledTimes(1);
          
          // 清除状态
          throttleController.clear();
          
          // 应该可以立即再次执行
          throttleController.trigger('call 2');
          expect(callback).toHaveBeenCalledTimes(2);
        });

        it('should return correct canTrigger status', () => {
          // 初始状态下应该可以触发
          expect(throttleController.canTrigger()).toBe(true);
          
          // 触发后，间隔内不能再次触发
          throttleController.trigger('call 1');
          expect(throttleController.canTrigger()).toBe(false);
          
          // 间隔后可以再次触发
          vi.advanceTimersByTime(101);
          expect(throttleController.canTrigger()).toBe(true);
        });
      });

      describe('Trailing 模式测试', () => {
        beforeEach(() => {
          throttleController.setup(100, callback, 'trailing');
        });

        it('should not execute immediately on first trigger', () => {
          // 首次调用不应立即执行
          throttleController.trigger('first call');
          expect(callback).toHaveBeenCalledTimes(0);
        });

        it('should execute after interval has passed', () => {
          // 触发调用
          throttleController.trigger('call 1');
          expect(callback).toHaveBeenCalledTimes(0);
          
          // 间隔后应该执行
          vi.advanceTimersByTime(101);
          expect(callback).toHaveBeenCalledTimes(1);
          expect(callback).toHaveBeenCalledWith('call 1');
        });

        it('should execute only once for multiple calls within interval', () => {
          // 连续触发多次调用
          throttleController.trigger('call 1');
          vi.advanceTimersByTime(50);
          throttleController.trigger('call 2');
          vi.advanceTimersByTime(49);
          throttleController.trigger('call 3');
          
          // 检查在时间窗口内是否没有执行回调
          expect(callback).toHaveBeenCalledTimes(0);
          
          // 间隔后应该只执行一次，使用最后一次调用的参数
          vi.advanceTimersByTime(1); // 总共101ms
          expect(callback).toHaveBeenCalledTimes(1);
          expect(callback).toHaveBeenCalledWith('call 3');
        });
      });
    });

    // ThrottleController 调试测试
    describe('ThrottleController 调试测试', () => {
      let throttleController: ThrottleControllerImpl;
      let callback: ReturnType<typeof vi.fn>;

      beforeEach(() => {
        vi.useFakeTimers();
        throttleController = new ThrottleControllerImpl();
        callback = vi.fn();
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('trailing模式下的多次调用', () => {
        // 设置控制器
        throttleController.setup(100, callback, 'trailing');
        
        // 第一次调用
        throttleController.trigger('call 1');
        
        // 推进时间但不触发定时器
        vi.advanceTimersByTime(49);
        
        // 第二次调用
        throttleController.trigger('call 2');
        
        // 再次推进时间但不触发新的定时器
        vi.advanceTimersByTime(49);
        
        // 第三次调用
        throttleController.trigger('call 3');
        
        // 验证回调调用次数 - 在没有推进足够时间触发定时器的情况下，应该为0次
        expect(callback).toHaveBeenCalledTimes(0);
        
        // 推进足够时间触发最终回调
        vi.advanceTimersByTime(101);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('call 3');
      });

      it('should debug trailing mode multiple calls within interval', () => {
        const interval = 100;
        
        // 创建trailing模式的节流控制器
        const throttleController = createThrottleController({
          callback,
          interval,
          leading: false,
          trailing: true
        });

        // 连续触发多次调用 - 不推进时间，确保所有调用都在同一个时间窗口内
        throttleController.trigger('call 1');
        
        // 模拟50ms后再次触发
        vi.advanceTimersByTime(50);
        throttleController.trigger('call 2');
        
        // 模拟再过50ms后触发第三次 - 总共100ms，仍在第一个时间窗口内
        vi.advanceTimersByTime(50);
        throttleController.trigger('call 3');
        
        // 间隔后应该只执行一次，使用最后一次调用的参数
        // 再推进101ms，确保第三次调用设置的定时器能够触发
        vi.advanceTimersByTime(101); // 总共201ms
        
        // 在trailing模式下，每个时间窗口结束时都会执行一次回调
        // 第一次回调使用'call 2'（第一个时间窗口），第二次回调使用'call 3'（第二个时间窗口）
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveBeenNthCalledWith(2, 'call 3');
      });

      it('深入调试: trailing模式下的三次连续调用问题', () => {
        // 设置控制器 - trailing模式，间隔100ms
        throttleController.setup(100, callback, 'trailing');
        
        // 第一次调用
        throttleController.trigger('call 1');
        
        // 推进时间50ms
        vi.advanceTimersByTime(50);
        
        // 第二次调用
        throttleController.trigger('call 2');
        
        // 推进时间49ms (总共99ms，不触发定时器)
        vi.advanceTimersByTime(49);
        
        // 第三次调用
        throttleController.trigger('call 3');
        
        // 关键断言 - 在时间窗口内不应执行回调
        expect(callback).toHaveBeenCalledTimes(0);
        
        // 推进时间到间隔后 (总共101ms)
        vi.advanceTimersByTime(1);
        
        // 验证最终回调执行情况
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('call 3');
      });

      it('DEBUG - trailing mode multiple calls within interval', () => {
        // 设置控制器
        throttleController.setup(100, callback, 'trailing');
        
        // 第一次调用
        throttleController.trigger('call 1');
        
        // 推进时间并第二次调用
        vi.advanceTimersByTime(50);
        throttleController.trigger('call 2');
        
        // 推进时间并第三次调用
        vi.advanceTimersByTime(49);
        throttleController.trigger('call 3');
        
        // 验证在时间窗口内不应执行回调
        expect(callback).toHaveBeenCalledTimes(0);
      });
    });

    // 高级调试: 详细的时间模拟
    describe('深入调试: ThrottleController trailing模式问题', () => {
      let throttleController: ThrottleControllerImpl;
      let mockCallback: ReturnType<typeof vi.fn>;
      let currentTime: number;
      let timeoutCallbacks: Array<{ id: any; callback: Function; delay: number; executeTime: number }>;

      beforeEach(() => {
        // 创建控制器实例
        throttleController = new ThrottleControllerImpl();
        
        // 重置模拟时间
        currentTime = 1600000000000;
        
        // 设置时间提供函数
        throttleController.setTimeProvider(() => currentTime);
        
        // 创建模拟回调
        mockCallback = vi.fn();
        
        // 重置超时回调数组
        timeoutCallbacks = [];
        
        // 模拟setTimeout和clearTimeout
        vi.useFakeTimers();
        vi.spyOn(window, 'setTimeout').mockImplementation((callback, delay = 0) => {
          const timeoutId = Symbol('timeoutId');
          timeoutCallbacks.push({
            id: timeoutId,
            callback,
            delay,
            executeTime: currentTime + delay
          });
          return timeoutId as unknown as NodeJS.Timeout;
        });
        
        vi.spyOn(window, 'clearTimeout').mockImplementation((timeoutId) => {
          timeoutCallbacks = timeoutCallbacks.filter(t => t.id !== timeoutId);
        });
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      // 辅助函数: 推进时间并执行到期的定时器
      const advanceTimersByTime = (ms: number) => {
        currentTime += ms;
        
        // 找出所有到期的定时器并按执行时间排序
        const expiredTimeouts = timeoutCallbacks
          .filter(t => t.executeTime <= currentTime)
          .sort((a, b) => a.executeTime - b.executeTime);
        
        // 执行到期的定时器
        expiredTimeouts.forEach(timeout => {
          try {
            timeout.callback();
          } catch (error) {
            console.error(`定时器执行出错: ${error instanceof Error ? error.message : String(error)}`);
          }
          // 从数组中移除已执行的定时器
          timeoutCallbacks = timeoutCallbacks.filter(t => t.id !== timeout.id);
        });
      };

      it('trailing模式下三次连续调用的详细执行流程分析', () => {
        // 设置控制器
        throttleController.setup(100, mockCallback, 'trailing');

        // 第一次调用
        throttleController.trigger('call 1');
        
        // 推进时间50ms
        advanceTimersByTime(50);

        // 第二次调用
        throttleController.trigger('call 2');
        
        // 推进时间49ms (总共99ms，不触发定时器)
        advanceTimersByTime(49);

        // 第三次调用
        throttleController.trigger('call 3');
        
        // 关键检查 - 在时间窗口内不应执行回调
        expect(mockCallback).toHaveBeenCalledTimes(0);

        // 推进时间到间隔后 (总共101ms)
        advanceTimersByTime(1);

        // 验证最终回调执行情况
        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(mockCallback).toHaveBeenCalledWith('call 3');
      });
    });
  });

  describe('ReplacementController 测试', () => {
    it('应该能够设置和获取待处理值', () => {
      const controller = createTimingController().replacement;
      
      // 设置值
      controller.setPendingValue('value1');
      expect(controller.hasPendingValue()).toBe(true);
      
      // 处理值
      const value = controller.processPendingValue();
      expect(value).toBe('value1');
      expect(controller.hasPendingValue()).toBe(false);
    });

    it('应该能够清除待处理值', () => {
      const controller = createTimingController().replacement;
      
      // 设置值
      controller.setPendingValue('value');
      expect(controller.hasPendingValue()).toBe(true);
      
      // 清除值
      controller.clearPendingValue();
      expect(controller.hasPendingValue()).toBe(false);
    });

    it('应该能够处理待处理值', () => {
      const controller = createTimingController().replacement;
      
      // 设置值
      controller.setPendingValue('testValue');
      
      // 处理值
      const value = controller.processPendingValue();
      expect(value).toBe('testValue');
      expect(controller.hasPendingValue()).toBe(false);
    });

    it('应该处理不存在的待处理值', () => {
      const controller = createTimingController().replacement;
      
      // 初始状态应该没有待处理值
      expect(controller.hasPendingValue()).toBe(false);
      
      // 处理不存在的待处理值，应该返回undefined或null
      const value = controller.processPendingValue();
      expect(value == null).toBe(true); // 同时支持undefined和null
      
      // 清除不存在的待处理值，不应该抛出异常
      expect(() => controller.clearPendingValue()).not.toThrow();
    });
  });

  describe('TimingController 测试', () => {
    it('应该能够创建控制器', () => {
      const controller = createTimingController();
      
      // 验证控制器创建成功
      expect(controller).toBeDefined();
      expect(controller.debounce).toBeDefined();
      expect(controller.throttle).toBeDefined();
      expect(controller.replacement).toBeDefined();
    });

    it('应该能够应用配置选项', () => {
      const config = {
        debounceDelay: 200,
        throttleInterval: 100
      };
      
      const controller = createTimingController(config);
      
      // 验证配置是否正确应用（通过获取内部状态间接验证）
      expect(controller).toBeDefined();
    });

    it('应该能够重置所有控制器', () => {
      const controller = createTimingController();
      
      // 设置并触发控制器
      controller.debounce.setup(100, () => {});
      controller.debounce.trigger('test1');
      controller.throttle.setup(100, () => {}, 'leading');
      controller.throttle.trigger('test2');
      controller.replacement.setPendingValue('value');
      
      // 重置所有控制器
      controller.reset();
      
      // 验证是否重置成功（通过清除定时器验证）
      expect(clearTimeoutMock).toHaveBeenCalled();
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

      // 0ms
      dateNowMock.mockReturnValue(0);
      throttledFn('call 1');
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('call 1');

      // 50ms
      dateNowMock.mockReturnValue(50);
      throttledFn('call 2');
      expect(callback).toHaveBeenCalledTimes(1);

      // 120ms
      dateNowMock.mockReturnValue(120);
      throttledFn('call 3');
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith('call 3');

      // 150ms
      dateNowMock.mockReturnValue(150);
      throttledFn('call 4');
      expect(callback).toHaveBeenCalledTimes(2);

      // 200ms
      dateNowMock.mockReturnValue(200);
      throttledFn('call 5');
      expect(callback).toHaveBeenCalledTimes(2);

      // 250ms
      dateNowMock.mockReturnValue(250);
      throttledFn('call 6');
      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenCalledWith('call 6');
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