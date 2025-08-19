import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThrottleControllerImpl } from '../src/modules/timing-control/index';

describe('Throttle 控制器 - Trailing 模式问题专用调试', () => {
  let throttleController: ThrottleControllerImpl;
  let callback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    throttleController = new ThrottleControllerImpl();
    callback = vi.fn().mockImplementation((data) => {
      // 移除详细的回调执行日志
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 添加一个辅助方法来获取控制器状态
  const logControllerState = (message: string) => {
    // 访问私有属性的技巧（用于调试）
    const state = (throttleController as any).getInternalState ? 
      (throttleController as any).getInternalState() : 
      {
        previous: (throttleController as any).previous,
        timeoutId: (throttleController as any).timeoutId,
        lastData: (throttleController as any).lastData,
        interval: (throttleController as any).interval,
        mode: (throttleController as any).mode
      };
    
    // 注释掉详细的状态日志，只在必要时启用调试
    // console.log(`\n📊 ${message}:`);
    // console.log(`  - 上次执行时间(previous): ${state.previous}`);
    // console.log(`  - 定时器ID(timeoutId): ${state.timeoutId}`);
    // console.log(`  - 最后一次数据(lastData): ${state.lastData}`);
    // console.log(`  - 间隔时间(interval): ${state.interval}`);
    // console.log(`  - 模式(mode): ${state.mode}`);
  };

  it('深入调试: trailing模式下的三次连续调用问题', () => {
    // 设置控制器 - trailing模式，间隔100ms
    throttleController.setup(100, callback, 'trailing');
    logControllerState('设置后的控制器状态');
    
    // 第一次调用
    throttleController.trigger('call 1');
    logControllerState('第一次调用后的控制器状态');
    
    // 推进时间50ms
    vi.advanceTimersByTime(50);
    
    // 第二次调用
    throttleController.trigger('call 2');
    logControllerState('第二次调用后的控制器状态');
    
    // 推进时间49ms (总共99ms，不触发定时器)
    vi.advanceTimersByTime(49);
    
    // 第三次调用
    throttleController.trigger('call 3');
    logControllerState('第三次调用后的控制器状态');
    
    // 关键断言 - 在时间窗口内不应执行回调
    expect(callback).toHaveBeenCalledTimes(0);
    
    // 推进时间到间隔后 (总共101ms)
    vi.advanceTimersByTime(1);
    
    // 验证最终回调执行情况
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('call 3');
    logControllerState('最终状态');
  });
});