// 专门用于调试throttle控制器的trailing模式问题
// 该文件会打印出完整的执行过程，而不会被测试框架的输出限制截断

// 导入必要的模块
import { createThrottleController } from '../src/modules/timing-control/index.js';

// 模拟时间提供者
let currentTime = 0;
const timeProvider = () => currentTime;

// 模拟setTimeout和clearTimeout
const originalSetTimeout = setTimeout;
const originalClearTimeout = clearTimeout;

let timeoutCallbacks = [];

// 重写setTimeout
global.setTimeout = (callback, delay) => {
  const timeoutId = Symbol('timeoutId');
  timeoutCallbacks.push({
    id: timeoutId,
    callback,
    delay,
    executeTime: currentTime + delay
  });
  console.log(`🆕 setTimeout: 设置定时器 ${timeoutId.toString().slice(7, 11)}，延迟: ${delay}ms，执行时间: ${currentTime + delay}ms`);
  return timeoutId;
};

// 重写clearTimeout
global.clearTimeout = (timeoutId) => {
  console.log(`🗑️ clearTimeout: 清除定时器 ${timeoutId.toString().slice(7, 11)}`);
  timeoutCallbacks = timeoutCallbacks.filter(t => t.id !== timeoutId);
};

// 推进时间并执行到期的定时器
function advanceTimersByTime(ms) {
  console.log(`⏩ 推进时间: ${currentTime}ms -> ${currentTime + ms}ms`);
  currentTime += ms;
  
  // 找出所有到期的定时器并按执行时间排序
  const expiredTimeouts = timeoutCallbacks
    .filter(t => t.executeTime <= currentTime)
    .sort((a, b) => a.executeTime - b.executeTime);
  
  // 执行到期的定时器
  expiredTimeouts.forEach(timeout => {
    console.log(`🚨 执行定时器 ${timeout.id.toString().slice(7, 11)}，当前时间: ${currentTime}ms`);
    timeout.callback();
    // 从数组中移除已执行的定时器
    timeoutCallbacks = timeoutCallbacks.filter(t => t.id !== timeout.id);
  });
}

// 重置所有状态
function reset() {
  currentTime = 0;
  timeoutCallbacks = [];
  callbackCalls = [];
}

// 记录回调调用
let callbackCalls = [];
const callback = (data) => {
  console.log(`💥 回调被调用: 数据=${data}，时间=${currentTime}ms`);
  callbackCalls.push({ data, time: currentTime });
};

// 运行测试函数
function runTrailingModeTest() {
  console.log('\n=====================================');
  console.log('开始测试: trailing模式 - 多次调用只执行一次');
  console.log('=====================================\n');
  
  // 重置状态
  reset();
  
  // 创建控制器并设置为trailing模式
  console.log('🔧 创建throttle控制器并设置trailing模式');
  const throttleController = createThrottleController({ 
    interval: 100, 
    callback,
    trailing: true 
  });
  
  // 覆盖时间提供者
  throttleController.setTimeProvider(timeProvider);
  
  // 第一次调用
  console.log('\n🔥 第一次调用: time=0ms, data="call 1"');
  throttleController.trigger('call 1');
  console.log(`✅ 第一次调用完成 - 回调调用次数: ${callbackCalls.length}`);
  
  // 第二次调用 - 50ms后
  console.log('\n🔥 第二次调用: time=50ms, data="call 2"');
  advanceTimersByTime(50);
  throttleController.trigger('call 2');
  console.log(`✅ 第二次调用完成 - 回调调用次数: ${callbackCalls.length}`);
  
  // 第三次调用 - 100ms后
  console.log('\n🔥 第三次调用: time=100ms, data="call 3"');
  advanceTimersByTime(50);
  throttleController.trigger('call 3');
  console.log(`✅ 第三次调用完成 - 回调调用次数: ${callbackCalls.length}`);
  
  // 检查在时间窗口内是否没有执行回调
  console.log('\n🔍 验证: 时间窗口内不应执行回调');
  console.log(`当前回调调用次数: ${callbackCalls.length}`);
  
  // 推进时间到间隔后
  console.log('\n⏩ 推进时间到间隔后: time=101ms');
  advanceTimersByTime(1);
  
  // 验证只执行了一次回调，并且是最后一次调用的数据
  console.log('\n🔍 验证: 间隔后应只执行一次回调');
  console.log(`最终回调调用次数: ${callbackCalls.length}`);
  if (callbackCalls.length > 0) {
    console.log(`回调调用数据: ${callbackCalls[0].data}`);
  }
  
  console.log('\n=====================================');
  console.log('测试完成');
  console.log('=====================================\n');
  
  // 还原原始的setTimeout和clearTimeout
  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
}

// 运行测试
runTrailingModeTest();

// 导出必要的函数以便在其他地方使用
export {
  runTrailingModeTest,
  advanceTimersByTime,
  timeProvider,
  callback,
  callbackCalls
};