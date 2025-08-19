import { vi } from 'vitest';
import { createThrottleController } from '../src/modules/timing-control';

describe('ThrottleController Debug Test', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  it('should debug trailing mode multiple calls within interval', () => {
    const callback = vi.fn();
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
});