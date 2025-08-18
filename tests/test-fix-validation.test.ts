/**
 * 修复验证测试脚本
 * 用于验证我们修复的错误是否有效
 */
import { describe, expect, it, vi } from 'vitest';
import { createStateManager } from '../src/modules/state-management';
import { createDebounceController } from '../src/core/timing-controller';
import type { SystemState, DataTransformer } from '../src/contracts';

// 测试状态管理器
describe('StateManager Validation Test', () => {
  it('should create a valid StateManager instance', () => {
    const stateManager = createStateManager();
    expect(stateManager).toBeDefined();
    expect(stateManager.getCurrentState()).toBe('ALL_SYNCED');
  });

  it('should transition states correctly', () => {
    const stateManager = createStateManager();
    stateManager.handleBlocklyEdit();
    expect(stateManager.getCurrentState()).toBe('BLOCKLY_DIRTY');
    stateManager.triggerSync();
    expect(stateManager.getCurrentState()).toBe('SYNC_PROCESSING');
    stateManager.handleSyncSuccess();
    expect(stateManager.getCurrentState()).toBe('ALL_SYNCED');
  });
});

// 测试防抖控制器
describe('TimingController Validation Test', () => {
  it('should create a valid DebounceController instance', () => {
    const callback = vi.fn();
    const debounceController = createDebounceController(callback);
    expect(debounceController).toBeDefined();
    expect(debounceController.isPending()).toBe(false);
  });

  it('should execute callback after delay', async () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const debounceController = createDebounceController(callback, { debounceDelay: 100 });

    debounceController.execute('test');
    expect(callback).not.toHaveBeenCalled();
    expect(debounceController.isPending()).toBe(true);

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledWith('test');
    expect(debounceController.isPending()).toBe(false);

    vi.useRealTimers();
  });
});

// 测试契约导入
describe('Contracts Import Validation Test', () => {
  it('should import types correctly', () => {
    // 测试类型导入是否正常工作
    const state: SystemState = 'ALL_SYNCED';
    expect(state).toBe('ALL_SYNCED');

    // 测试接口实现
    const mockTransformer: Partial<DataTransformer<any, any>> = {
      getSupportedDataType: () => 'JSON'
    };
    expect(mockTransformer.getSupportedDataType).toBeDefined();
    expect(mockTransformer.getSupportedDataType!()).toBe('JSON');
  });
});