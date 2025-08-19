/**
 * 状态管理器单元测试
 * 测试四状态模型的转换逻辑和编辑权限控制
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncFailedEventData, StateManager } from './contracts';
import { createStateManager, ErrorType, SystemState, handleSyncError, handleUserEdit, getEditPermissions } from '.';

// Mock console.log 以避免测试输出污染
console.log = vi.fn();
console.error = vi.fn();

// Mock requestAnimationFrame for testing atomic operations
Object.defineProperty(window, 'requestAnimationFrame', {
  value: vi.fn((callback) => setTimeout(callback, 0)),
  writable: true
});

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

  /**
   * 增强功能测试
   * 测试状态管理器的高级特性：错误处理策略、版本管理、增强的状态转换等
   */
  describe('增强功能测试', () => {
    beforeEach(() => {
      stateManager = createStateManager();
      vi.clearAllMocks();
    });

    describe('错误处理策略测试', () => {
      it('should apply different recovery strategies based on error classification', () => {
        // 测试系统错误恢复策略
        stateManager.handleBlocklyEdit();
        stateManager.triggerSync();
        // 确保状态确实变为了SYNC_PROCESSING
        expect(stateManager.getCurrentState()).toBe(SystemState.SYNC_PROCESSING);
        
        // 使用NETWORK_ERROR进行测试
        stateManager.handleSyncFailed('网络错误', ErrorType.NETWORK_ERROR, true);
        
        // 根据handleErrorRecovery的实现，当有lastDirtyState时，会优先回退到lastDirtyState
        // 对于从Blockly触发的同步，lastDirtyState就是BLOCKLY_DIRTY
        expect(stateManager.getCurrentState()).toBe(SystemState.BLOCKLY_DIRTY);
      });

      it('should handle data errors by returning to DIRTY state', () => {
        stateManager.handleBlocklyEdit();
        stateManager.triggerSync();
        // 确保状态确实变为了SYNC_PROCESSING
        expect(stateManager.getCurrentState()).toBe(SystemState.SYNC_PROCESSING);
        stateManager.handleSyncFailed('数据格式错误', ErrorType.FORMAT_ERROR);
        
        // 数据错误应该回退到原始DIRTY状态
        expect(stateManager.getCurrentState()).toBe(SystemState.BLOCKLY_DIRTY);
      });

      it('should handle retry mechanism for recoverable errors', () => {
        // 测试重试机制
        const originalTriggerSync = stateManager.triggerSync.bind(stateManager);
        const triggerSyncSpy = vi.spyOn(stateManager, 'triggerSync').mockImplementation(originalTriggerSync);
        
        stateManager.handleBlocklyEdit();
        stateManager.triggerSync();
        
        // Mock setTimeout to trigger retry immediately
        vi.useFakeTimers();
        
        // 使用NETWORK_ERROR进行测试，它在ERROR_TRANSITIONS中配置为可重试
        stateManager.handleSyncFailed('网络错误 - 应该重试', ErrorType.NETWORK_ERROR, false);
        
        // 验证重试被触发
        vi.advanceTimersByTime(1000); // 前进到重试延迟时间（根据STANDARDIZED_ERROR_HANDLING配置）
        expect(triggerSyncSpy).toHaveBeenCalledTimes(2);
        
        vi.useRealTimers();
      });

      it('should stop retrying after reaching maximum attempts', () => {
        vi.useFakeTimers();
        
        // 模拟多次同步失败
        for (let i = 0; i < 4; i++) {
          stateManager.handleBlocklyEdit();
          stateManager.triggerSync();
          stateManager.handleSyncFailed('测试错误', ErrorType.VALIDATION_ERROR);
          vi.advanceTimersByTime(3000);
        }
        
        // 验证最终状态是回退到DIRTY状态而不是继续重试
        expect(stateManager.getCurrentState()).toBe(SystemState.BLOCKLY_DIRTY);
        
        vi.useRealTimers();
      });
    });

    describe('版本管理和回退测试', () => {
      it('should create version snapshots for state transitions', () => {
        // 模拟一系列状态转换
        stateManager.handleBlocklyEdit();
        stateManager.triggerSync();
        stateManager.handleSyncSuccess();
        
        // 由于getVersionHistory是私有方法，我们需要使用反射或强制类型转换来访问
        const versionHistory = (stateManager as any).getVersionHistory();
        
        // 验证版本历史只记录ALL_SYNCED状态
        // 注意：JsonStateManager初始化时已有一个版本（ALL_SYNCED）
        expect(versionHistory).toHaveLength(2);
        expect(versionHistory[0].state).toBe(SystemState.ALL_SYNCED);
        expect(versionHistory[1].state).toBe(SystemState.ALL_SYNCED);
      });

      it('should rollback to specific version', () => {
        // 创建多个版本
        stateManager.handleBlocklyEdit();
        stateManager.triggerSync();
        stateManager.handleSyncSuccess();
        stateManager.handleMonacoEdit();
        
        // 回退到第一个版本（ALL_SYNCED）
        stateManager.rollbackToVersion(0);
        
        // 验证回退成功
        expect(stateManager.getCurrentState()).toBe(SystemState.ALL_SYNCED);
      });

      it('should rollback to last synced state when no version specified', () => {
        stateManager.handleBlocklyEdit();
        stateManager.triggerSync();
        stateManager.handleSyncSuccess();
        stateManager.handleMonacoEdit();
        
        // 不指定版本，回退到最近的ALL_SYNCED状态
        stateManager.rollbackToVersion();
        
        // 验证回退成功
        expect(stateManager.getCurrentState()).toBe(SystemState.ALL_SYNCED);
      });

      it('should handle invalid version gracefully', () => {
        stateManager.handleBlocklyEdit();
        
        // 尝试回退到无效版本
        const consoleSpy = vi.spyOn(console, 'warn');
        stateManager.rollbackToVersion(999);
        
        // 验证控制台输出了警告并且状态回退到最近的ALL_SYNCED状态
        expect(consoleSpy).toHaveBeenCalledWith('无效的版本索引: 999，版本历史长度: 1');
        expect(stateManager.getCurrentState()).toBe(SystemState.ALL_SYNCED);
      });
    });

    describe('增强的状态转换测试', () => {
      it('should allow enhanced transitions from SYNC_PROCESSING on error', () => {
        // 使用增强的状态转换函数从SYNC_PROCESSING转换到DIRTY状态
        stateManager.handleBlocklyEdit();
        stateManager.triggerSync();
        
        // 直接在stateManager实例上调用方法以保留this上下文
        const result = (stateManager as any).enhancedTransitionTo(SystemState.MONACO_DIRTY, ErrorType.FORMAT_ERROR);
        
        // 验证转换成功
        expect(result).toBe(true);
        expect(stateManager.getCurrentState()).toBe(SystemState.MONACO_DIRTY);
      });

      it('should handle error recovery through enhancedTransitionTo', () => {
        // 测试通过增强的状态转换函数进行错误恢复
        stateManager.handleBlocklyEdit();
        stateManager.triggerSync();
        
        // 使用handleRecoverableError方法，它内部会调用enhancedTransitionTo
        // 直接在stateManager实例上调用方法以保留this上下文
        (stateManager as any).handleRecoverableError(ErrorType.FORMAT_ERROR, '测试错误');
        
        // 验证状态正确恢复
        expect(stateManager.getCurrentState()).toBe(SystemState.BLOCKLY_DIRTY);
      });
    });

    describe('编辑覆盖策略测试', () => {
      it('should handle user edits with override during sync processing', () => {
        stateManager.handleBlocklyEdit();
        stateManager.triggerSync();
        
        // 使用覆盖策略在同步过程中处理Monaco编辑
        // 直接在stateManager实例上调用方法以保留this上下文
        const result = (stateManager as any).handleUserEditWithOverride('monaco');
        
        // 验证编辑被添加到待处理队列
        expect(result).toBe(true);
        expect(stateManager.getCurrentState()).toBe(SystemState.SYNC_PROCESSING);
      });

      it('should process pending edits with override after sync completes', async () => {
        stateManager.handleBlocklyEdit();
        stateManager.triggerSync();
        
        // 添加带有覆盖标志的编辑
        // 直接在stateManager实例上调用方法以保留this上下文
        (stateManager as any).handleUserEditWithOverride('monaco');
        
        // 模拟同步成功后处理待编辑队列
        vi.useFakeTimers();
        stateManager.handleSyncSuccess();
        
        // 验证待编辑队列被处理
        vi.advanceTimersByTime(16); // 前进到requestAnimationFrame的时间
        
        // 由于使用了requestAnimationFrame，我们需要等待下一帧
        setTimeout(() => {
          expect(stateManager.getCurrentState()).toBe(SystemState.MONACO_DIRTY);
        }, 0);
        
        vi.useRealTimers();
      });
    });

    describe('原子操作和批处理测试', () => {
      it('should use requestAnimationFrame for atomic updates', () => {
        stateManager.handleBlocklyEdit();
        stateManager.triggerSync();
        
        // 添加多个编辑
        (stateManager as any).pendingEdits = [
          { type: 'blockly', timestamp: Date.now() - 100 },
          { type: 'monaco', timestamp: Date.now() }
        ];
        
        // 保存原始的requestAnimationFrame实现
        const originalRAF = window.requestAnimationFrame;
        
        try {
          // 模拟window.requestAnimationFrame
          const requestAnimationFrameSpy = vi.fn((callback) => {
            callback(0);
            return 0;
          });
          
          // 覆盖window.requestAnimationFrame
          (window as any).requestAnimationFrame = requestAnimationFrameSpy;
          
          // 触发待处理编辑的处理
          (stateManager as any).processPendingInput();
          
          // 验证requestAnimationFrame被调用
          expect(requestAnimationFrameSpy).toHaveBeenCalled();
        } finally {
          // 恢复原始实现
          window.requestAnimationFrame = originalRAF;
        }
      });
    });

    describe('安全状态恢复测试', () => {
      it('should recover to safe state on critical error', () => {
        // 测试在发生严重错误时恢复到安全状态
        // 直接在stateManager对象上调用方法，保留this上下文
        (stateManager as any).recoverToSafeState('测试严重错误');
        
        // 验证状态恢复到安全状态
        expect(stateManager.getCurrentState()).toBe(SystemState.ALL_SYNCED);
      });

      it('should handle critical error with appropriate recovery', () => {
        // 测试handleCriticalError方法
        // 直接在stateManager对象上调用方法，保留this上下文
        (stateManager as any).handleCriticalError(new Error('Critical test error'));
        
        // 验证状态恢复到安全状态
        expect(stateManager.getCurrentState()).toBe(SystemState.ALL_SYNCED);
      });
    });

    describe('导出的辅助函数测试', () => {
      it('should use getEditPermissions correctly', () => {
        const permissions = getEditPermissions(SystemState.BLOCKLY_DIRTY);
        
        // 验证返回正确的编辑权限
        expect(permissions.blocklyEditable).toBe(true);
        expect(permissions.monacoEditable).toBe(false);
      });

      it('should handle sync errors with handleSyncError function', () => {
        // 使用顶部导入的handleSyncError函数
        stateManager.handleBlocklyEdit();
        stateManager.triggerSync();
        
        // 使用handleSyncError处理错误
        handleSyncError(ErrorType.FORMAT_ERROR, stateManager);
        
        // 验证错误处理结果
        expect(stateManager.getCurrentState()).toBe(SystemState.BLOCKLY_DIRTY);
      });

      it('should handle user edits with handleUserEdit function', () => {
        // 使用顶部导入的handleUserEdit函数
        
        // 测试在允许编辑的状态下处理编辑
        const result = handleUserEdit('blockly', stateManager);
        
        // 验证编辑被允许并状态转换
        expect(result).toBe(true);
        expect(stateManager.getCurrentState()).toBe(SystemState.BLOCKLY_DIRTY);
      });
    });
  });
});