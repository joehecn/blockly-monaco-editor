// 独立的Throttle控制器调试脚本
// 不依赖于测试框架，直接运行以获取完整的调试信息

// 导入模块
import { ThrottleControllerImpl } from '../dist/modules/timing-control/index.js';

// 创建一个简单的控制台日志工具
const logger = {
  info: (message) => console.log(`\x1b[34m[INFO]\x1b[0m ${message}`),
  warning: (message) => console.log(`\x1b[33m[WARNING]\x1b[0m ${message}`),
  error: (message) => console.log(`\x1b[31m[ERROR]\x1b[0m ${message}`),
  success: (message) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${message}`),
  debug: (message) => console.log(`\x1b[36m[DEBUG]\x1b[0m ${message}`),
  separator: () => console.log('=====================================')
};

// 模拟时间
let currentTime = 1600000000000; // 一个固定的起始时间
const originalDateNow = Date.now;

// 替换Date.now以模拟时间
Date.now = () => currentTime;

// 模拟定时器系统
let timeoutCallbacks = [];

// 模拟setTimeout
const mockSetTimeout = (callback, delay) => {
  const timeoutId = Symbol('timeoutId');
  timeoutCallbacks.push({
    id: timeoutId,
    callback,
    delay,
    executeTime: currentTime + delay
  });
  logger.debug(`设置定时器 ${timeoutId.toString().slice(7, 11)}，延迟: ${delay}ms，执行时间: ${currentTime + delay}ms`);
  return timeoutId;
};

// 模拟clearTimeout
const mockClearTimeout = (timeoutId) => {
  logger.debug(`清除定时器 ${timeoutId.toString().slice(7, 11)}`);
  timeoutCallbacks = timeoutCallbacks.filter(t => t.id !== timeoutId);
};

// 推进时间并执行到期的定时器
function advanceTimersByTime(ms) {
  logger.debug(`推进时间: ${currentTime}ms -> ${currentTime + ms}ms`);
  currentTime += ms;
  
  // 找出所有到期的定时器并按执行时间排序
  const expiredTimeouts = timeoutCallbacks
    .filter(t => t.executeTime <= currentTime)
    .sort((a, b) => a.executeTime - b.executeTime);
  
  // 执行到期的定时器
  expiredTimeouts.forEach(timeout => {
    logger.debug(`执行定时器 ${timeout.id.toString().slice(7, 11)}，当前时间: ${currentTime}ms`);
    try {
      timeout.callback();
    } catch (error) {
      logger.error(`定时器执行出错: ${error.message}`);
    }
    // 从数组中移除已执行的定时器
    timeoutCallbacks = timeoutCallbacks.filter(t => t.id !== timeout.id);
  });
}

// 运行调试函数
async function runDebug() {
  try {
    logger.separator();
    logger.info('开始独立调试: Throttle控制器 - Trailing模式问题');
    logger.separator();
    
    // 创建控制器实例
    const throttleController = new ThrottleControllerImpl();
    
    // 使用控制器提供的setTimeProvider方法设置模拟时间
     throttleController.setTimeProvider(() => currentTime);
    
    // 记录回调调用次数
    let callbackCalls = 0;
    let lastCallbackData = null;
    
    // 创建回调函数
    const callback = (data) => {
      callbackCalls++;
      lastCallbackData = data;
      logger.warning(`💥 回调被调用！调用次数: ${callbackCalls}, 数据: ${data}, 当前时间: ${currentTime}ms`);
      logger.warning('回调调用堆栈:');
      // 获取调用堆栈，但去掉第一行（即当前行）
      const stack = new Error().stack;
      if (stack) {
        const stackLines = stack.split('\n').slice(1);
        logger.warning(stackLines.join('\n'));
      }
    };
    
    // 设置控制器
    logger.info('设置控制器: trailing模式, 间隔100ms');
    throttleController.setup(100, callback, 'trailing');
    logControllerState(throttleController, '设置后的控制器状态');
    
    // 第一次调用
    logger.info('\n第一次调用: trigger("call 1")');
    throttleController.trigger('call 1');
    logger.info(`第一次trigger后回调调用次数: ${callbackCalls}`);
    logControllerState(throttleController, '第一次调用后的控制器状态');
    
    // 推进时间50ms
    logger.info('\n推进时间: 0ms -> 50ms');
    advanceTimersByTime(50);
    
    // 第二次调用
    logger.info('\n第二次调用: trigger("call 2")');
    throttleController.trigger('call 2');
    logger.info(`第二次trigger后回调调用次数: ${callbackCalls}`);
    logControllerState(throttleController, '第二次调用后的控制器状态');
    
    // 推进时间50ms (总共100ms)
    logger.info('\n推进时间: 50ms -> 100ms');
    advanceTimersByTime(50);
    
    // 第三次调用
    logger.info('\n第三次调用: trigger("call 3")');
    throttleController.trigger('call 3');
    logger.info(`第三次trigger后回调调用次数: ${callbackCalls}`);
    logControllerState(throttleController, '第三次调用后的控制器状态');
    
    // 关键检查 - 在时间窗口内不应执行回调
    logger.info('\n关键验证: 时间窗口内回调调用次数应为0');
    logger.info(`当前回调调用次数: ${callbackCalls}`);
    
    // 推进时间到间隔后 (总共101ms)
    logger.info('\n推进时间到间隔后: 100ms -> 101ms');
    advanceTimersByTime(1);
    
    // 验证最终回调执行情况
    logger.info('\n最终验证: 间隔后应只执行一次回调');
    logger.info(`推进时间后回调调用次数: ${callbackCalls}`);
    logger.info(`最后一次回调数据: ${lastCallbackData || '无'}`);
    logControllerState(throttleController, '最终状态');
    
    // 打印调试总结
    logger.separator();
    logger.success('独立调试完成');
    logger.info(`测试结果: 回调被调用了 ${callbackCalls} 次`);
    logger.info(`期望结果: 时间窗口内0次，间隔后1次，总共1次`);
    logger.info(`结论: ${callbackCalls === 1 ? '✅ 测试通过' : '❌ 测试失败'}`);
    logger.separator();
    
  } catch (error) {
    logger.error('调试过程中发生错误:');
    logger.error(error.message);
    logger.error(error.stack);
  } finally {
    // 恢复原始函数
    Date.now = originalDateNow;
  }
}

// 辅助函数: 记录控制器状态
function logControllerState(controller, message) {
  // 尝试以不同方式访问控制器的内部状态
  try {
    // 方法1: 使用Reflect.get尝试访问私有属性
    const state = {
      previous: Reflect.get(controller, 'previous') || '未定义',
      timeoutId: Reflect.get(controller, 'timeoutId') || 'null',
      lastData: Reflect.get(controller, 'lastData') || 'null',
      interval: Reflect.get(controller, 'interval') || '未定义',
      mode: Reflect.get(controller, 'mode') || '未定义'
    };
    
    logger.debug(`\n控制器状态 - ${message}:`);
    logger.debug(`  - 上次执行时间(previous): ${state.previous}`);
    logger.debug(`  - 定时器ID(timeoutId): ${state.timeoutId}`);
    logger.debug(`  - 最后一次数据(lastData): ${state.lastData}`);
    logger.debug(`  - 间隔时间(interval): ${state.interval}`);
    logger.debug(`  - 模式(mode): ${state.mode}`);
  } catch (error) {
    logger.warning(`无法获取控制器状态: ${error.message}`);
  }
}

// 运行调试
runDebug();