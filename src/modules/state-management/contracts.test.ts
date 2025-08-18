/**
 * 状态管理器契约验证测试
 * 确保JsonStateManager类完全符合StateManager接口定义
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStateManager } from '.';
import type { StateManager, SystemState, StateChangeListener, SyncFailedEventData } from './contracts';

describe('StateManager Contract Validation', () => {
  let stateManager: StateManager;
  
  beforeEach(() => {
    stateManager = createStateManager();
  });

  describe('接口实现完整性验证', () => {
    it('should implement all required methods from StateManager interface', () => {
      // 验证所有必需的方法都已实现
      expect(typeof stateManager.initialize).toBe('function');
      expect(typeof stateManager.getCurrentState).toBe('function');
      expect(typeof stateManager.tryTransition).toBe('function');
      expect(typeof stateManager.addStateChangeListener).toBe('function');
      expect(typeof stateManager.removeStateChangeListener).toBe('function');
      expect(typeof stateManager.addSyncFailedListener).toBe('function');
      expect(typeof stateManager.removeSyncFailedListener).toBe('function');
      expect(typeof stateManager.getEditPermissions).toBe('function');
      expect(typeof stateManager.setEditPermissionsMap).toBe('function');
      expect(typeof stateManager.handleBlocklyEdit).toBe('function');
      expect(typeof stateManager.handleMonacoEdit).toBe('function');
      expect(typeof stateManager.triggerSync).toBe('function');
      expect(typeof stateManager.handleSyncSuccess).toBe('function');
      expect(typeof stateManager.handleSyncFailed).toBe('function');
      expect(typeof stateManager.rollbackToVersion).toBe('function');
    });

    it('should return valid EditPermissions object from getEditPermissions', () => {
      const permissions = stateManager.getEditPermissions();
      
      // 验证返回对象包含所有必需的字段
      expect(permissions).toHaveProperty('blocklyEditable');
      expect(permissions).toHaveProperty('monacoEditable');
      expect(permissions).toHaveProperty('canSwitchEditor');
      expect(permissions).toHaveProperty('lastDirtyState');
      
      // 验证字段类型正确
      expect(typeof permissions.blocklyEditable).toBe('boolean');
      expect(typeof permissions.monacoEditable).toBe('boolean');
      expect(typeof permissions.canSwitchEditor).toBe('boolean');
    });

    it('should return valid unsubscribe function from addStateChangeListener', () => {
      const listener: StateChangeListener = vi.fn();
      const unsubscribe = stateManager.addStateChangeListener(listener);
      
      expect(typeof unsubscribe).toBe('function');
      
      // 验证unsubscribe函数能正常工作
      unsubscribe();
      stateManager.handleBlocklyEdit();
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle valid state values in getCurrentState', () => {
      const validStates = ['ALL_SYNCED', 'BLOCKLY_DIRTY', 'MONACO_DIRTY', 'SYNC_PROCESSING'];
      const currentState = stateManager.getCurrentState();
      
      expect(validStates).toContain(currentState);
      
      // 验证状态转换后返回的状态值仍在有效范围内
      stateManager.handleBlocklyEdit();
      expect(validStates).toContain(stateManager.getCurrentState());
    });

    it('should implement tryTransition method that returns boolean', () => {
      const result = stateManager.tryTransition('BLOCKLY_DIRTY' as SystemState);
      
      expect(typeof result).toBe('boolean');
    });

    it('should handle SyncFailedEventData correctly in listeners', () => {
      const listener = vi.fn<(data: SyncFailedEventData) => void>();
      stateManager.addSyncFailedListener(listener);
      
      stateManager.handleBlocklyEdit();
      stateManager.triggerSync();
      stateManager.handleSyncFailed('Test error', 'TEST_ERROR', true);
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        errorMessage: expect.any(String),
        errorCode: expect.any(String),
        originalState: expect.any(String),
        attemptedSyncFrom: expect.any(String)
      }));
    });
  });

  describe('接口边界情况验证', () => {
    it('should handle undefined parameters gracefully', () => {
      // 验证关键方法在接收到undefined参数时不会崩溃
      expect(() => {
        stateManager.initialize('ALL_SYNCED' as SystemState, undefined as any);
        stateManager.handleSyncFailed(undefined as any);
        stateManager.removeStateChangeListener(undefined as any);
        stateManager.removeSyncFailedListener(undefined as any);
      }).not.toThrow();
    });

    it('should maintain consistent state across method calls', () => {
      // 验证状态在多次方法调用后保持一致
      stateManager.handleBlocklyEdit();
      const state1 = stateManager.getCurrentState();
      const state2 = stateManager.getCurrentState();
      
      expect(state1).toBe(state2);
    });

    it('should handle multiple concurrent state change listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      stateManager.addStateChangeListener(listener1);
      stateManager.addStateChangeListener(listener2);
      stateManager.handleBlocklyEdit();
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('类型安全验证', () => {
    it('should create StateManager instance through factory function', () => {
      const manager = createStateManager();
      
      // 验证工厂函数返回的是StateManager类型的实例
      expect(typeof manager.getCurrentState).toBe('function');
      expect(typeof manager.getEditPermissions).toBe('function');
    });

      it('should handle empty edit permission map', () => {
      // 验证空的权限映射不会导致问题
      expect(() => {
        stateManager.setEditPermissionsMap(new Map());
      }).not.toThrow();
    });
  });
});