/**
 * 契约导入测试脚本
 * 用于验证契约模块是否正确配置
 */
import { SystemState } from '../modules/state-management/contracts';
import { DataType } from '../modules/data-transformation/contracts';
import type { DataTransformer } from '../modules/data-transformation/contracts';
import { createStateManager } from '../modules/state-management';
import { createDebounceController } from '../core/timing-controller';

// 测试状态管理契约
console.log('测试状态管理契约:');
const state: SystemState = SystemState.ALL_SYNCED;
console.log(`状态值: ${state}`);

// 测试数据转换契约
console.log('\n测试数据转换契约:');
const mockTransformer: Partial<DataTransformer<any, any>> = {
  getSupportedDataType: () => DataType.JSON
};
console.log(`数据类型: ${mockTransformer.getSupportedDataType?.()}`);

// 测试核心功能导入
console.log('\n测试核心功能导入:');
const stateManager = createStateManager();
console.log(`状态管理器初始状态: ${stateManager.getCurrentState()}`);

const debounceController = createDebounceController(() => {
  console.log('防抖函数执行了!');
});
console.log(`防抖控制器创建: ${!!debounceController}`);

console.log('\n测试完成，所有导入均正常工作!');