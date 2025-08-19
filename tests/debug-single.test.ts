import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThrottleControllerImpl } from '../src/modules/timing-control/index';

describe('单一调试测试', () => {
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

  it('单一测试 - trailing模式下的多次调用', () => {
    console.log('=== 测试开始 ===');
    
    // 设置控制器
    throttleController.setup(100, callback, 'trailing');
    console.log('控制器已设置，模式: trailing, 间隔: 100ms');
    
    // 第一次调用
    console.log('\n=== 执行第一次trigger(call 1) ===');
    throttleController.trigger('call 1');
    console.log('第一次trigger后回调调用次数:', callback.mock.calls.length);
    console.log('回调调用详情:', callback.mock.calls);
    
    // 推进时间但不触发定时器（只推进49ms，小于100ms）
    console.log('\n=== 推进时间49ms ===');
    vi.advanceTimersByTime(49);
    console.log('\n=== 执行第二次trigger(call 2) ===');
    throttleController.trigger('call 2');
    console.log('第二次trigger后回调调用次数:', callback.mock.calls.length);
    console.log('回调调用详情:', callback.mock.calls);
    
    // 再次推进时间但不触发新的定时器（只推进49ms，累计98ms，小于51ms的剩余时间）
    console.log('\n=== 推进时间49ms ===');
    vi.advanceTimersByTime(49);
    console.log('\n=== 执行第三次trigger(call 3) ===');
    throttleController.trigger('call 3');
    console.log('第三次trigger后回调调用次数:', callback.mock.calls.length);
    console.log('回调调用详情:', callback.mock.calls);
    
    // 验证回调调用次数 - 在没有推进足够时间触发定时器的情况下，应该为0次
    console.log('\n=== 执行断言 - 期望回调调用次数: 0 ===');
    console.log('当前回调调用次数:', callback.mock.calls.length);
    expect(callback).toHaveBeenCalledTimes(0);
    
    console.log('\n=== 额外测试 - 推进足够时间触发最终回调 ===');
    vi.advanceTimersByTime(101); // 推进足够时间触发最终回调
    console.log('推进时间101ms后回调调用次数:', callback.mock.calls.length);
    console.log('回调调用详情:', callback.mock.calls);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('call 3');
    
    console.log('=== 测试结束 ===');
  });
});