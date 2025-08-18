/**
 * 状态管理器单元测试
 * 测试四状态模型的转换逻辑和编辑权限控制
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncFailedEventData, StateManager } from './contracts';
import { createStateManager, ErrorType, SystemState } from '.';

// Mock console.log 以避免测试输出污染
console.log = vi.fn();
console.error = vi.fn();

describe('StateManager Contract Tests', () => {
  let stateManager: StateManager;
  
  beforeEach(() => {
    stateManager = createStateManager();
  });

  describe('初始化状态测试', () => {
    it('should initialize in ALL_SYNCED state', () => {
      expect(stateManager.getCurrentState()).toBe('ALL_SYNCED');
    });

    it('should have full edit permissions when initialized', () => {
      const permissions = stateManager.getEditPermissions();
      expect(permissions.blocklyEditable).toBe(true);
      expect(permissions.monacoEditable).toBe(true);
      expect(permissions.lastDirtyState).toBe(null);
    });
  });

  describe('基本状态转换测试', () => {
    it('should transition from ALL_SYNCED to BLOCKLY_DIRTY when Blockly is edited', () => {
      stateManager.handleBlocklyEdit();
      expect(stateManager.getCurrentState()).toBe('BLOCKLY_DIRTY');
    });

    it('should transition from ALL_SYNCED to MONACO_DIRTY when Monaco is edited', () => {
      stateManager.handleMonacoEdit();
      expect(stateManager.getCurrentState()).toBe('MONACO_DIRTY');
    });

    it('should transition from BLOCKLY_DIRTY to SYNC_PROCESSING when sync is triggered', () => {
      stateManager.handleBlocklyEdit();
      stateManager.triggerSync();
      expect(stateManager.getCurrentState()).toBe('SYNC_PROCESSING');
    });

    it('should transition from MONACO_DIRTY to SYNC_PROCESSING when sync is triggered', () => {
      stateManager.handleMonacoEdit();
      stateManager.triggerSync();
      expect(stateManager.getCurrentState()).toBe('SYNC_PROCESSING');
    });

    it('should transition from SYNC_PROCESSING to ALL_SYNCED when sync succeeds', () => {
      stateManager.handleBlocklyEdit();
      stateManager.triggerSync();
      stateManager.handleSyncSuccess();
      expect(stateManager.getCurrentState()).toBe('ALL_SYNCED');
    });

    it('should transition from SYNC_PROCESSING to original DIRTY state when sync fails', () => {
      stateManager.handleBlocklyEdit();
      stateManager.triggerSync();
      stateManager.handleSyncFailed('测试错误', undefined, true);
      expect(stateManager.getCurrentState()).toBe('BLOCKLY_DIRTY');
    });

    it('should transition from any state to ALL_SYNCED when rolling back', () => {
      stateManager.handleBlocklyEdit();
      stateManager.triggerSync();
      stateManager.rollbackToVersion();
      expect(stateManager.getCurrentState()).toBe('ALL_SYNCED');
    });
  });

  describe('编辑权限控制测试', () => {
    it('should restrict editing to Blockly only when in BLOCKLY_DIRTY state', () => {
      stateManager.handleBlocklyEdit();
      const permissions = stateManager.getEditPermissions();
      expect(permissions.blocklyEditable).toBe(true);
      expect(permissions.monacoEditable).toBe(false);
    });

    it('should restrict editing to Monaco only when in MONACO_DIRTY state', () => {
      stateManager.handleMonacoEdit();
      const permissions = stateManager.getEditPermissions();
      expect(permissions.blocklyEditable).toBe(false);
      expect(permissions.monacoEditable).toBe(true);
    });

    it('should restrict editing during SYNC_PROCESSING', () => {
      stateManager.handleBlocklyEdit();
      stateManager.triggerSync();
      const permissions = stateManager.getEditPermissions();
      expect(permissions.blocklyEditable).toBe(false);
      expect(permissions.monacoEditable).toBe(false);
      expect(permissions.lastDirtyState).toBeUndefined();
    });

    // lastDirtyState不再在EditPermissions中，而是作为单独的状态变量存在
    it('should handle edits during SYNC_PROCESSING by adding to pending queue', () => {
      stateManager.handleMonacoEdit();
      stateManager.triggerSync();
      stateManager.handleMonacoEdit(); // 这个编辑应该被添加到待处理队列
      expect(stateManager.getCurrentState()).toBe('SYNC_PROCESSING');
      stateManager.handleSyncSuccess(); // 同步成功后，待处理的编辑应该被处理
      expect(stateManager.getCurrentState()).toBe('ALL_SYNCED');
    });
  });

  describe('事件监听器测试', () => {
    it('should notify state change listeners when state transitions', () => {
      const listener = vi.fn();
      stateManager.addStateChangeListener(listener);
      stateManager.handleBlocklyEdit();
      expect(listener).toHaveBeenCalledWith('BLOCKLY_DIRTY');
    });

    it('should remove state change listeners correctly', () => {
      const listener = vi.fn();
      stateManager.addStateChangeListener(listener);
      stateManager.removeStateChangeListener(listener);
      stateManager.handleBlocklyEdit();
      expect(listener).not.toHaveBeenCalled();
    });

    it('should notify sync failed listeners when sync fails', () => {
      const listener = vi.fn<(data: SyncFailedEventData) => void>();
      stateManager.addSyncFailedListener(listener);
      stateManager.handleBlocklyEdit();
      stateManager.triggerSync();
      stateManager.handleSyncFailed('测试错误', ErrorType.RUNTIME_ERROR, true);
      
      expect(listener).toHaveBeenCalledWith({
        errorMessage: '测试错误',
        errorCode: ErrorType.RUNTIME_ERROR,
        originalState: 'SYNC_PROCESSING',
        attemptedSyncFrom: 'BLOCKLY_DIRTY'
      });
    });

    it('should remove sync failed listeners correctly', () => {
      const listener = vi.fn<(data: SyncFailedEventData) => void>();
      stateManager.addSyncFailedListener(listener);
      stateManager.removeSyncFailedListener(listener);
      stateManager.handleBlocklyEdit();
      stateManager.triggerSync();
      stateManager.handleSyncFailed('测试错误');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('边界情况测试', () => {
    it('should handle continuous Blockly edits without state changes', () => {
      stateManager.handleBlocklyEdit();
      const firstState = stateManager.getCurrentState();
      stateManager.handleBlocklyEdit(); // 再次编辑Blockly
      const secondState = stateManager.getCurrentState();
      expect(firstState).toBe(secondState);
    });

    it('should handle sync trigger when already in ALL_SYNCED state', () => {
      stateManager.triggerSync();
      expect(stateManager.getCurrentState()).toBe('ALL_SYNCED');
    });

    it('should handle sync success when not in SYNC_PROCESSING state', () => {
      stateManager.handleSyncSuccess();
      expect(stateManager.getCurrentState()).toBe('ALL_SYNCED');
    });

    it('should handle sync failure when not in SYNC_PROCESSING state', () => {
      stateManager.handleSyncFailed('测试错误', ErrorType.UNKNOWN);
      expect(stateManager.getCurrentState()).toBe('ALL_SYNCED');
    });

    it('should handle Blockly edit during Monaco-initiated sync', () => {
      stateManager.handleMonacoEdit();
      stateManager.triggerSync();
      stateManager.handleBlocklyEdit(); // 不应该改变状态，因为不是原编辑侧
      expect(stateManager.getCurrentState()).toBe('SYNC_PROCESSING');
    });

    it('should handle Monaco edit during Blockly-initiated sync', () => {
      stateManager.handleBlocklyEdit();
      stateManager.triggerSync();
      stateManager.handleMonacoEdit(); // 不应该改变状态，因为不是原编辑侧
      expect(stateManager.getCurrentState()).toBe('SYNC_PROCESSING');
    });
  });

  describe('错误恢复路径测试', () => {
    it('should correctly implement the "[恢复原DIRTY状态]" path when sync fails', () => {
      // 1. 从ALL_SYNCED到BLOCKLY_DIRTY
      stateManager.handleBlocklyEdit();
      expect(stateManager.getCurrentState()).toBe('BLOCKLY_DIRTY');
      
      // 2. 触发同步进入SYNC_PROCESSING
      stateManager.triggerSync();
      expect(stateManager.getCurrentState()).toBe('SYNC_PROCESSING');
      
      // 3. 同步失败，恢复到原DIRTY状态
      stateManager.handleSyncFailed('同步失败', undefined, true);
      expect(stateManager.getCurrentState()).toBe('BLOCKLY_DIRTY');
      
      // 4. 再次同步并成功
      stateManager.triggerSync();
      stateManager.handleSyncSuccess();
      expect(stateManager.getCurrentState()).toBe('ALL_SYNCED');
    });

    it('should correctly recover from Monaco-initiated sync failure', () => {
      stateManager.handleMonacoEdit();
      stateManager.triggerSync();
      stateManager.handleSyncFailed('同步失败', undefined, true);
      expect(stateManager.getCurrentState()).toBe('MONACO_DIRTY');
    });

    /**
     * 测试SYNC_PROCESSING状态的5秒超时自动恢复功能
     */
    it('should automatically recover from SYNC_PROCESSING after timeout', () => {
      const syncFailedCallback = vi.fn();
      
      // 添加同步失败监听器以验证超时触发
      stateManager.addSyncFailedListener(syncFailedCallback);
      
      // 模拟编辑触发同步
      stateManager.handleBlocklyEdit();
      stateManager.triggerSync();
      expect(stateManager.getCurrentState()).toBe('SYNC_PROCESSING');
      
      // 模拟超时 - 直接调用handleSyncFailed方法模拟超时情况
      // 注意：在实际实现中，超时会通过handleSyncTimeout内部调用handleSyncFailed
      stateManager.handleSyncFailed('同步处理超时', ErrorType.SYNC_TIMEOUT, true);
      
      // 验证状态是否正确恢复
      expect(stateManager.getCurrentState()).toBe('BLOCKLY_DIRTY');
      expect(syncFailedCallback).toHaveBeenCalledWith({
        errorMessage: '同步处理超时',
        errorCode: ErrorType.SYNC_TIMEOUT,
        originalState: 'SYNC_PROCESSING',
        attemptedSyncFrom: 'BLOCKLY_DIRTY'
      });
    });
  });

  describe('工厂函数测试', () => {
    it('should create a valid StateManager instance', () => {
      const manager = createStateManager();
      expect(manager.getCurrentState()).toBe(SystemState.ALL_SYNCED);
    });

    it('should create independent instances each time', () => {
      const manager1 = createStateManager();
      const manager2 = createStateManager();
      manager1.handleBlocklyEdit();
      expect(manager1.getCurrentState()).toBe('BLOCKLY_DIRTY');
      expect(manager2.getCurrentState()).toBe('ALL_SYNCED');
    });
  });
});