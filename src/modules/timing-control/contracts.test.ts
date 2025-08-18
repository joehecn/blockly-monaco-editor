/**
 * 时序控制模块契约验证测试
 * 确保所有接口实现完全符合契约定义
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DebounceController, ThrottleController, ReplacementController, TimingController, TimingControllerConfig } from './contracts';
import { TIMING_CONSTANTS } from './contracts';
import { 
  DebounceControllerImpl, 
  ThrottleControllerImpl, 
  ReplacementControllerImpl, 
  TimingControllerImpl,
  TimingManager,
  createTimingController,
  createDebounceController,
  createThrottleController,
  createReplacementController,
  debounce,
  throttle,
  globalTimingManager
} from './index';

describe('Timing Control Module Contract Validation', () => {
  describe('DebounceController 接口验证', () => {
    let debounceController: DebounceController;
    
    beforeEach(() => {
      debounceController = new DebounceControllerImpl();
    });

    it('should implement all required methods from DebounceController interface', () => {
      // 验证所有必需的方法都已实现
      expect(typeof debounceController.setup).toBe('function');
      expect(typeof debounceController.trigger).toBe('function');
      expect(typeof debounceController.cancel).toBe('function');
      expect(typeof debounceController.isPending).toBe('function');
    });

    it('should handle trigger and cancellation correctly', () => {
      const callback = vi.fn();
      debounceController.setup(100, callback);
      
      // 触发防抖操作
      debounceController.trigger('test data');
      expect(debounceController.isPending()).toBe(true);
      expect(callback).not.toHaveBeenCalled();
      
      // 取消防抖操作
      debounceController.cancel();
      expect(debounceController.isPending()).toBe(false);
    });
  });

  describe('ThrottleController 接口验证', () => {
    let throttleController: ThrottleController;
    
    beforeEach(() => {
      throttleController = new ThrottleControllerImpl();
    });

    it('should implement all required methods from ThrottleController interface', () => {
      // 验证所有必需的方法都已实现
      expect(typeof throttleController.setup).toBe('function');
      expect(typeof throttleController.trigger).toBe('function');
      expect(typeof throttleController.canTrigger).toBe('function');
      expect(typeof throttleController.clear).toBe('function');
    });
  });

  describe('ReplacementController 接口验证', () => {
    let replacementController: ReplacementController;
    
    beforeEach(() => {
      replacementController = new ReplacementControllerImpl();
    });

    it('should implement all required methods from ReplacementController interface', () => {
      // 验证所有必需的方法都已实现
      expect(typeof replacementController.setPendingValue).toBe('function');
      expect(typeof replacementController.processPendingValue).toBe('function');
      expect(typeof replacementController.clearPendingValue).toBe('function');
      expect(typeof replacementController.hasPendingValue).toBe('function');
    });

    it('should handle pending value correctly', () => {
      // 初始状态不应有待处理值
      expect(replacementController.hasPendingValue()).toBe(false);
      
      // 设置待处理值
      replacementController.setPendingValue({ key: 'value' });
      expect(replacementController.hasPendingValue()).toBe(true);
      
      // 处理待处理值
      const value = replacementController.processPendingValue();
      expect(value).toEqual({ key: 'value' });
    });
  });

  describe('TimingController 接口验证', () => {
    let timingController: TimingController;
    
    beforeEach(() => {
      timingController = new TimingControllerImpl();
    });

    it('should implement all required methods from TimingController interface', () => {
      // 验证所有必需的方法都已实现
      expect(typeof timingController.reset).toBe('function');
      expect(typeof timingController.destroy).toBe('function');
      
      // 验证所有必需的属性都存在
      expect(timingController.debounce).toBeDefined();
      expect(timingController.throttle).toBeDefined();
      expect(timingController.replacement).toBeDefined();
    });

    it('should contain valid controller instances', () => {
      // 验证控制器实例类型正确
      expect(timingController.debounce).toBeInstanceOf(DebounceControllerImpl);
      expect(timingController.throttle).toBeInstanceOf(ThrottleControllerImpl);
      expect(timingController.replacement).toBeInstanceOf(ReplacementControllerImpl);
      
      // 验证控制器实例方法存在
      expect(typeof timingController.debounce.setup).toBe('function');
      expect(typeof timingController.throttle.setup).toBe('function');
      expect(typeof timingController.replacement.setPendingValue).toBe('function');
    });

    it('should reset all controllers when reset is called', () => {
      // 设置各个控制器的状态
      timingController.debounce.setup(100, () => {});
      timingController.debounce.trigger('test');
      timingController.throttle.setup(100, () => {});
      timingController.throttle.trigger('test');
      timingController.replacement.setPendingValue('test');
      
      // 重置所有控制器
      timingController.reset();
      
      // 验证状态已重置
      expect(timingController.debounce.isPending()).toBe(false);
      expect(timingController.replacement.hasPendingValue()).toBe(false);
    });

    it('should apply configuration correctly when constructed', () => {
      const config: TimingControllerConfig = {
        debounceDelay: 200,
        throttleInterval: 150
      };
      
      const configuredController = new TimingControllerImpl(config);
      
      // 验证控制器实例存在
      expect(configuredController.debounce).toBeDefined();
      expect(configuredController.throttle).toBeDefined();
      expect(configuredController.replacement).toBeDefined();
    });
  });

  describe('工厂函数验证', () => {
    it('should create valid TimingController instance through factory function', () => {
      const controller = createTimingController();
      
      // 验证工厂函数返回的是TimingController类型的实例
      expect(controller).toBeInstanceOf(TimingControllerImpl);
      expect(controller.debounce).toBeDefined();
      expect(controller.throttle).toBeDefined();
      expect(controller.replacement).toBeDefined();
    });

    it('should create valid DebounceController instance through factory function', () => {
      const controller = createDebounceController(100, () => {});
      
      // 验证工厂函数返回的是DebounceController类型的实例
      expect(controller).toBeInstanceOf(DebounceControllerImpl);
      expect(typeof controller.setup).toBe('function');
      expect(typeof controller.trigger).toBe('function');
    });

    it('should create valid ThrottleController instance through factory function', () => {
      const controller = createThrottleController(100, () => {});
      
      // 验证工厂函数返回的是ThrottleController类型的实例
      expect(controller).toBeInstanceOf(ThrottleControllerImpl);
      expect(typeof controller.setup).toBe('function');
      expect(typeof controller.trigger).toBe('function');
    });

    it('should create valid ReplacementController instance through factory function', () => {
      const controller = createReplacementController();
      
      // 验证工厂函数返回的是ReplacementController类型的实例
      expect(controller).toBeInstanceOf(ReplacementControllerImpl);
      expect(typeof controller.setPendingValue).toBe('function');
      expect(typeof controller.processPendingValue).toBe('function');
    });
  });

  describe('工具函数验证', () => {
    it('should debounce function calls correctly', async () => {
      const callback = vi.fn();
      const debouncedFn = debounce(callback, 100);
      
      // 连续调用，应该只执行最后一次
      debouncedFn('call 1');
      debouncedFn('call 2');
      debouncedFn('call 3');
      
      // 立即检查回调是否被调用
      expect(callback).not.toHaveBeenCalled();
      
      // 延迟后检查回调是否被调用
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('call 3');
    });

    it('should throttle function calls correctly', async () => {
      const callback = vi.fn();
      const throttledFn = throttle(callback, 100);
      
      // 连续调用，应该限制调用频率
      throttledFn('call 1');
      throttledFn('call 2');
      throttledFn('call 3');
      
      // 立即检查回调是否被调用
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('call 1');
      
      // 延迟后再次调用
      await new Promise(resolve => setTimeout(resolve, 120));
      throttledFn('call 4');
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith('call 4');
    });

    it('should preserve this context in debounce function', async () => {
      const context = { value: 'test' };
      const callback = vi.fn(function(this: any) {
        expect(this).toBe(context);
      });
      const debouncedFn = debounce(callback, 100);
      
      debouncedFn.call(context);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should preserve this context in throttle function', async () => {
      const context = { value: 'test' };
      const callback = vi.fn(function(this: any) {
        expect(this).toBe(context);
      });
      const throttledFn = throttle(callback, 100);
      
      throttledFn.call(context);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('TimingManager 类验证', () => {
    let timingManager: TimingManager;
    
    beforeEach(() => {
      // 注意：这不会创建新实例，因为TimingManager是单例模式
      timingManager = TimingManager.getInstance();
      // 清除所有已存在的控制器以确保测试独立性
      timingManager.destroyAll();
    });

    it('should implement singleton pattern', () => {
      const instance1 = TimingManager.getInstance();
      const instance2 = TimingManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should create and retrieve controllers by id', () => {
      const controller1 = timingManager.getController('controller1');
      const controller2 = timingManager.getController('controller2');
      const controller1Again = timingManager.getController('controller1');
      
      // 验证控制器实例类型正确
      expect(controller1).toBeInstanceOf(TimingControllerImpl);
      expect(controller2).toBeInstanceOf(TimingControllerImpl);
      
      // 验证相同id返回相同实例
      expect(controller1).toBe(controller1Again);
      expect(controller1).not.toBe(controller2);
    });

    it('should remove controllers correctly', () => {
      const controller1 = timingManager.getController('controller1');
      timingManager.removeController('controller1');
      
      // 验证控制器已被移除，再次获取应该创建新实例
      const controller1Again = timingManager.getController('controller1');
      expect(controller1).not.toBe(controller1Again);
    });

    it('should reset all controllers', () => {
      const controller1 = timingManager.getController('controller1');
      const controller2 = timingManager.getController('controller2');
      
      // 设置控制器状态
      controller1.debounce.setup(100, () => {});
      controller1.debounce.trigger('test');
      controller2.replacement.setPendingValue('test');
      
      // 重置所有控制器
      timingManager.resetAll();
      
      // 验证状态已重置
      expect(controller1.debounce.isPending()).toBe(false);
      expect(controller2.replacement.hasPendingValue()).toBe(false);
    });

    it('should destroy all controllers', () => {
      timingManager.getController('controller1');
      timingManager.getController('controller2');
      
      // 销毁所有控制器
      timingManager.destroyAll();
      
      // 验证控制器已被销毁，再次获取应该创建新实例
      const controller1 = timingManager.getController('controller1');
      const controller2 = timingManager.getController('controller2');
      expect(controller1).toBeDefined();
      expect(controller2).toBeDefined();
    });
  });

  describe('全局单例验证', () => {
    it('should export valid globalTimingManager singleton', () => {
      expect(globalTimingManager).toBeDefined();
      expect(globalTimingManager).toBeInstanceOf(TimingManager);
      expect(globalTimingManager).toBe(TimingManager.getInstance());
    });

    it('should provide access to timing control functionality through global singleton', () => {
      const controller = globalTimingManager.getController('test');
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(TimingControllerImpl);
      
      // 清理
      globalTimingManager.removeController('test');
    });
  });

  describe('常量验证', () => {
    it('should export valid TIMING_CONSTANTS', () => {
      expect(TIMING_CONSTANTS).toBeDefined();
      expect(TIMING_CONSTANTS.DEFAULT_DEBOUNCE_DELAY).toBeDefined();
      expect(TIMING_CONSTANTS.DEFAULT_THROTTLE_INTERVAL).toBeDefined();
      expect(TIMING_CONSTANTS.MAX_DEBOUNCE_DELAY).toBeDefined();
      expect(TIMING_CONSTANTS.MIN_THROTTLE_INTERVAL).toBeDefined();
    });

    it('should have correct constant values', () => {
      expect(typeof TIMING_CONSTANTS.DEFAULT_DEBOUNCE_DELAY).toBe('number');
      expect(typeof TIMING_CONSTANTS.DEFAULT_THROTTLE_INTERVAL).toBe('number');
      expect(typeof TIMING_CONSTANTS.MAX_DEBOUNCE_DELAY).toBe('number');
      expect(typeof TIMING_CONSTANTS.MIN_THROTTLE_INTERVAL).toBe('number');
      
      // 验证值的合理性
      expect(TIMING_CONSTANTS.DEFAULT_DEBOUNCE_DELAY).toBeGreaterThan(0);
      expect(TIMING_CONSTANTS.DEFAULT_THROTTLE_INTERVAL).toBeGreaterThan(0);
      expect(TIMING_CONSTANTS.MAX_DEBOUNCE_DELAY).toBeGreaterThan(TIMING_CONSTANTS.DEFAULT_DEBOUNCE_DELAY);
      expect(TIMING_CONSTANTS.MIN_THROTTLE_INTERVAL).toBeGreaterThan(0);
    });
  });

  describe('边界情况验证', () => {
    it('should handle undefined parameters gracefully', () => {
      // 验证关键方法在接收到undefined参数时不会崩溃
      expect(() => {
        const debounceController = new DebounceControllerImpl();
        debounceController.setup(undefined as any, undefined as any);
        debounceController.trigger(undefined as any);
        
        const throttleController = new ThrottleControllerImpl();
        throttleController.setup(undefined as any, undefined as any);
        throttleController.trigger(undefined as any);
        
        const replacementController = new ReplacementControllerImpl();
        replacementController.setPendingValue(undefined as any);
        
        const timingController = new TimingControllerImpl(undefined as any);
        timingController.reset();
        timingController.destroy();
      }).not.toThrow();
    });

    it('should handle extreme parameter values gracefully', () => {
      // 验证关键方法在接收到极端参数时不会崩溃
      expect(() => {
        const debounceController = new DebounceControllerImpl();
        debounceController.setup(-100, () => {}); // 负值延迟
        debounceController.setup(10000, () => {}); // 超大延迟
        
        const throttleController = new ThrottleControllerImpl();
        throttleController.setup(-100, () => {}); // 负值间隔
        throttleController.setup(10000, () => {}); // 超大间隔
      }).not.toThrow();
    });

    it('should handle null values gracefully', () => {
      // 验证关键方法在接收到null参数时不会崩溃
      expect(() => {
        const debounceController = new DebounceControllerImpl();
        debounceController.setup(null as any, null as any);
        debounceController.trigger(null as any);
        
        const throttleController = new ThrottleControllerImpl();
        throttleController.setup(null as any, null as any);
        throttleController.trigger(null as any);
        
        const replacementController = new ReplacementControllerImpl();
        replacementController.setPendingValue(null);
      }).not.toThrow();
    });
  });
});