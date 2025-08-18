/**
 * 状态管理器 - 核心实现
 * 
 * 负责管理整个系统的四状态模型转换逻辑，确保数据一致性和用户操作的正确响应
 */
import { 
  SystemState, 
  DEFAULT_STATE_TRANSITION_RULES, 
  StateMetadata, 
  ErrorType, 
  ERROR_TRANSITIONS, 
  ErrorClassification, 
  STANDARDIZED_ERROR_HANDLING 
} from './contracts';
import type { 
  StateManager, 
  EditPermissions, 
  StateChangeListener, 
  StateTransitionRules, 
  SyncFailedEventData 
} from './contracts';

/**
 * 防抖参数常量
 */
export const DEBOUNCE_CONFIG = {
  USER_INPUT: 300,  // 用户输入防抖时间
  SYNC_TRIGGER: 500, // 同步触发防抖时间
  UI_UPDATE: 16,    // UI更新节流时间（约60fps）
  PERFORMANCE_SENSITIVE: 100 // 性能敏感操作的防抖时间
};

/**
 * 节流参数常量
 */
export const THROTTLE_CONFIG = {
  STATUS_POLLING: 1000,   // 状态轮询节流时间
  METRICS_COLLECTION: 5000, // 指标收集节流时间
  HEAVY_COMPUTATION: 200  // 重量级计算节流时间
};

/**
 * 编辑权限映射表
 */
export const DEFAULT_EDIT_PERMISSIONS: Record<SystemState, EditPermissions> = {
  [SystemState.ALL_SYNCED]: {
    blocklyEditable: true,
    monacoEditable: true,
    canSwitchEditor: true,
    lastDirtyState: null
  },
  [SystemState.BLOCKLY_DIRTY]: {
    blocklyEditable: true,
    monacoEditable: false,
    canSwitchEditor: false,
    lastDirtyState: undefined
  },
  [SystemState.MONACO_DIRTY]: {
    blocklyEditable: false,
    monacoEditable: true,
    canSwitchEditor: false,
    lastDirtyState: undefined
  },
  [SystemState.SYNC_PROCESSING]: {
    blocklyEditable: false,
    monacoEditable: false,
    canSwitchEditor: false,
    lastDirtyState: undefined
    // 注意：虽然编辑权限显示为false，但通过handleUserEditWithOverride和processPendingInput方法
    // 实现了来源端（触发同步的编辑器）编辑的延迟处理机制，符合文档中"SYNC_PROCESSING状态下允许来源端继续编辑"的要求
  }
};

/**
 * 待处理编辑数据接口
 */
interface PendingEdit {
  type: 'blockly' | 'monaco';
  timestamp: number;
  isOverride?: boolean;
}

/**
 * 版本元数据接口
 */
interface VersionMetadata {
  version: number;
  timestamp: number;
  state: SystemState;
  dataHash?: string;
  reason?: string;
}

/**
 * 状态管理器实现类
 * 实现了四状态模型的精确控制和转换逻辑
 */
export class JsonStateManager implements StateManager {
  private currentState: SystemState = SystemState.ALL_SYNCED;
  private lastDirtyState: typeof SystemState.BLOCKLY_DIRTY | typeof SystemState.MONACO_DIRTY | null = null;
  private lastStableState: SystemState = SystemState.ALL_SYNCED; // 上次稳定状态
  private stateChangeListeners: Array<StateChangeListener> = [];
  private syncFailedListeners: Array<(data: SyncFailedEventData) => void> = [];
  private stateTransitionRules: StateTransitionRules = DEFAULT_STATE_TRANSITION_RULES;
  private syncDebounceTimer: number | null = null;
  private pendingEdits: PendingEdit[] = [];
  private syncTimeoutTimer: number | null = null;
  // private static readonly SYNC_TIMEOUT_MS = 5000; // 5秒同步超时时间
  // private static readonly MAX_RETRIES = 3; // 最大重试次数
  private retryCount = 0; // 当前重试次数
  private versionHistory: VersionMetadata[] = [{ // 版本历史记录，初始状态为ALL_SYNCED
    version: 0,
    timestamp: Date.now(),
    state: SystemState.ALL_SYNCED,
    reason: 'Initialization'
  }];
  private editPermissionsMap: Record<SystemState, EditPermissions> = DEFAULT_EDIT_PERMISSIONS;

  /**
   * 获取当前系统状态
   */
  getCurrentState(): SystemState {
    return this.currentState;
  }

  /**
   * 获取当前状态的编辑权限信息
   */
  getEditPermissions(): EditPermissions {
    return this.editPermissionsMap[this.currentState] || {
      blocklyEditable: false,
      monacoEditable: false,
      canSwitchEditor: false,
      lastDirtyState: undefined
    };
  }

  /**
   * 处理Blockly编辑器的用户编辑
   */
  handleBlocklyEdit(): void {
    const permissions = this.getEditPermissions();
    
    if (permissions.blocklyEditable) {
      this.transitionTo(SystemState.BLOCKLY_DIRTY);
      this.triggerSyncDebounced();
    } else if (this.currentState === SystemState.SYNC_PROCESSING) {
      // 在同步过程中，将编辑添加到待处理队列
      this.pendingEdits.push({
        type: 'blockly',
        timestamp: Date.now()
      });
    }
  }

  /**
   * 处理Monaco编辑器的用户编辑
   */
  handleMonacoEdit(): void {
    const permissions = this.getEditPermissions();
    
    if (permissions.monacoEditable) {
      this.transitionTo(SystemState.MONACO_DIRTY);
      this.triggerSyncDebounced();
    } else if (this.currentState === SystemState.SYNC_PROCESSING) {
      // 在同步过程中，将编辑添加到待处理队列
      this.pendingEdits.push({
        type: 'monaco',
        timestamp: Date.now()
      });
    }
  }

  /**
   * 处理带有覆盖策略的用户编辑
   * @param editorType 编辑器类型
   * @returns 是否成功覆盖
   */
  public handleUserEditWithOverride(editorType: 'blockly' | 'monaco'): boolean {
    if (this.currentState === SystemState.SYNC_PROCESSING) {
      // 允许在同步处理中覆盖
      this.pendingEdits.push({ type: editorType, timestamp: Date.now(), isOverride: true });
      return true;
    }
    
    if (editorType === 'blockly') {
      this.handleBlocklyEdit();
    } else {
      this.handleMonacoEdit();
    }
    return false;
  }

  /**
   * 防抖触发同步
   */
  private triggerSyncDebounced(): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    
    // 使用配置的防抖时间
    this.syncDebounceTimer = window.setTimeout(() => {
      this.triggerSync();
    }, DEBOUNCE_CONFIG.SYNC_TRIGGER);
  }

  /**
   * 触发同步处理
   */
  triggerSync(): void {
    if (this.currentState === SystemState.BLOCKLY_DIRTY || this.currentState === SystemState.MONACO_DIRTY) {
      this.lastDirtyState = this.currentState;
      this.transitionTo(SystemState.SYNC_PROCESSING);
      
      // 启动同步超时计时器
      this.startSyncTimeoutTimer();
    }
  }

  /**
   * 启动同步超时计时器
   */
  private startSyncTimeoutTimer(): void {
    // 清除之前可能存在的超时计时器
    this.clearSyncTimeoutTimer();
    
    // 设置新的超时计时器
    this.syncTimeoutTimer = window.setTimeout(() => {
      this.handleSyncTimeout();
    }, StateMetadata[SystemState.SYNC_PROCESSING].timeout);
  }

  /**
   * 清除同步超时计时器
   */
  private clearSyncTimeoutTimer(): void {
    if (this.syncTimeoutTimer) {
      clearTimeout(this.syncTimeoutTimer);
      this.syncTimeoutTimer = null;
    }
  }

  /**
   * 处理同步超时
   */
  private handleSyncTimeout(): void {
    if (this.currentState === SystemState.SYNC_PROCESSING) {
      console.warn('同步处理超时，自动恢复到原始DIRTY状态');
      this.handleSyncFailed('同步处理超时', ErrorType.SYNC_TIMEOUT);
    }
  }

  /**
   * 处理同步成功
   */
  handleSyncSuccess(): void {
    if (this.currentState === SystemState.SYNC_PROCESSING) {
      // 清除超时计时器
      this.clearSyncTimeoutTimer();
      
      // 重置重试计数器
      this.retryCount = 0;
      
      this.transitionTo(SystemState.ALL_SYNCED);
      this.lastDirtyState = null;
      
      // 处理待编辑队列
      this.processPendingInput();
    }
  }

  /**
   * 处理待处理的编辑操作（使用requestAnimationFrame确保原子性）
   */
  private processPendingInput(): void {
    // 降级策略：如果requestAnimationFrame不可用，使用setTimeout
    const scheduleUpdate = window.requestAnimationFrame || ((callback) => setTimeout(callback, 16));
    
    scheduleUpdate(() => {
      // 按时间戳排序，确保先处理最早的编辑
      this.pendingEdits.sort((a, b) => a.timestamp - b.timestamp);
      
      // 检查是否有覆盖操作
      const hasOverride = this.pendingEdits.some(edit => edit.isOverride);
      
      if (hasOverride) {
        // 有覆盖操作时，只处理最后一个编辑
        const lastEdit = this.pendingEdits[this.pendingEdits.length - 1];
        if (lastEdit.type === 'blockly') {
          this.handleBlocklyEdit();
        } else {
          this.handleMonacoEdit();
        }
      } else if (this.pendingEdits.length > 0) {
        // 没有覆盖操作时，处理最新的编辑操作
        const latestEdit = this.pendingEdits[this.pendingEdits.length - 1];
        if (latestEdit.type === 'blockly') {
          this.handleBlocklyEdit();
        } else {
          this.handleMonacoEdit();
        }
      }
      
      // 清空队列
      this.pendingEdits = [];
    });
  }

  /**
   * 获取错误分类
   * @param errorType 错误类型
   * @returns 错误分类
   */
  private getErrorClassification(errorType: ErrorType): ErrorClassification {
    const systemErrors = [
      ErrorType.SYNC_TIMEOUT,
      ErrorType.SERVICE_UNAVAILABLE,
      ErrorType.NETWORK_ERROR,
      ErrorType.PERFORMANCE_ISSUE,
      ErrorType.RUNTIME_ERROR,
      ErrorType.RESOURCE_EXHAUSTION
    ];
    
    const dataErrors = [
      ErrorType.FORMAT_ERROR,
      ErrorType.VALIDATION_ERROR,
      ErrorType.SYNTAX_ERROR,
      ErrorType.SCHEMA_MISMATCH,
      ErrorType.DATA_INTEGRITY_VIOLATION,
      ErrorType.DEPRECATED_FEATURE
    ];
    
    if (systemErrors.includes(errorType as typeof systemErrors[number])) return ErrorClassification.SYSTEM;
    if (dataErrors.includes(errorType as typeof dataErrors[number])) return ErrorClassification.DATA;
    return ErrorClassification.UNKNOWN;
  }

  /**
   * 处理同步失败
   * @param errorMessage 错误消息
   * @param errorType 错误类型
   * @param skipRetry 是否跳过重试（用于测试或特殊场景）
   */
  handleSyncFailed(errorMessage: string, errorType: ErrorType = ErrorType.UNKNOWN, skipRetry: boolean = false): void {
    if (this.currentState === SystemState.SYNC_PROCESSING) {
      // 清除超时计时器
      this.clearSyncTimeoutTimer();
      
      const transitionConfig = ERROR_TRANSITIONS[errorType];
      const errorClassification = this.getErrorClassification(errorType);
      const handlingConfig = STANDARDIZED_ERROR_HANDLING[errorClassification];
      const originalDirtyState = this.lastDirtyState;
      
      // 发布同步失败事件
      this.notifySyncFailedListeners({
        errorMessage,
        errorCode: errorType,
        originalState: this.currentState,
        attemptedSyncFrom: originalDirtyState || SystemState.BLOCKLY_DIRTY
      });
      
      // 处理重试逻辑
      const shouldRetry = !skipRetry && 
                         transitionConfig && !transitionConfig.skipRetry &&
                         this.retryCount < (transitionConfig.retryLimit || handlingConfig.maxRetries);
      
      if (shouldRetry) {
        this.retryCount++;
        console.log(`错误，尝试第 ${this.retryCount} 次重试: ${errorMessage}`);
        
        // 延迟触发同步重试
        setTimeout(() => {
          this.triggerSync();
        }, handlingConfig.retryDelay);
        return;
      }
    }
    
    // 处理错误恢复
    this.handleErrorRecovery(errorType, errorMessage);
  }

  /**
   * 处理错误恢复
   * @param errorType 错误类型
   * @param errorMessage 错误消息
   */
  private handleErrorRecovery(errorType: ErrorType, errorMessage: string): void {
    const transitionConfig = ERROR_TRANSITIONS[errorType];
    
    // 如果有lastDirtyState（表示是从DIRTY状态触发的同步），优先回退到lastDirtyState
    if (this.lastDirtyState) {
      this.enhancedTransitionTo(this.lastDirtyState, errorType, `Error recovery to original dirty state: ${errorType} - ${errorMessage}`);
    } else if (transitionConfig && transitionConfig.targetState) {
      // 有明确目标状态的错误（通常是系统错误）
      this.enhancedTransitionTo(transitionConfig.targetState, errorType, `Error recovery: ${errorType} - ${errorMessage}`);
    } else {
      // 默认回退策略
      this.recoverToSafeState(`Fallback recovery: ${errorType} - ${errorMessage}`);
    }
  }

  /**
   * 处理严重错误
   * @param error 错误对象
   */
  public handleCriticalError(error: Error): void {
    console.error('Critical error in state management:', error);
    this.recoverToSafeState('Critical error occurred');
    // 发布错误事件
    this.notifySyncFailedListeners({
      errorMessage: error.message,
      errorCode: ErrorType.RUNTIME_ERROR,
      originalState: this.currentState,
      attemptedSyncFrom: this.lastDirtyState || SystemState.BLOCKLY_DIRTY
    });
  }

  /**
   * 处理可恢复错误
   * @param errorType 错误类型
   * @param errorMessage 错误消息
   */
  public handleRecoverableError(errorType: ErrorType, errorMessage: string): void {
    this.handleErrorRecovery(errorType, errorMessage);
  }

  /**
   * 恢复到安全状态
   * @param reason 恢复原因
   */
  public recoverToSafeState(reason: string): void {
    if (this.lastStableState === SystemState.ALL_SYNCED) {
      this.transitionTo(SystemState.ALL_SYNCED, `Safe state recovery: ${reason}`);
    } else if (this.lastDirtyState) {
      this.enhancedTransitionTo(this.lastDirtyState, ErrorType.UNKNOWN, `Fallback recovery: ${reason}`);
    } else {
      this.transitionTo(SystemState.ALL_SYNCED, `Emergency recovery: ${reason}`);
    }
  }

  /**
   * 版本回退
   * @param targetVersion 可选，目标版本索引，如果不提供则回退到最近的ALL_SYNCED状态
   */
  rollbackToVersion(targetVersion?: number): void {
    if (targetVersion !== undefined) {
      // 指定版本回退
      const targetVersionMeta = this.versionHistory.find(v => v.version === targetVersion);
      if (targetVersionMeta) {
        console.log(`回退到版本 ${targetVersion}，状态: ${targetVersionMeta.state}`);
        
        // 重置重试计数器
        this.retryCount = 0;
        
        // 直接转换到目标状态（绕过规则检查）
        const previousState = this.currentState;
        this.currentState = targetVersionMeta.state;
        this.lastDirtyState = null;
        
        // 通知所有状态变化监听器
        this.notifyStateChangeListeners(targetVersionMeta.state, previousState);
      } else {
        console.warn(`无效的版本索引: ${targetVersion}，版本历史长度: ${this.versionHistory.length}`);
        this.rollbackToLastSyncedState();
      }
    } else {
      // 默认回退到最近的ALL_SYNCED状态
      this.rollbackToLastSyncedState();
    }
  }

  /**
   * 回退到最近的ALL_SYNCED状态
   */
  private rollbackToLastSyncedState(): void {
    // 查找最近的ALL_SYNCED状态
    const lastSyncedVersion = this.versionHistory
      .slice()
      .reverse()
      .find(v => v.state === SystemState.ALL_SYNCED);

    if (lastSyncedVersion) {
      const previousState = this.currentState;
      this.currentState = SystemState.ALL_SYNCED;
      this.lastDirtyState = null;
      this.retryCount = 0; // 重置重试计数器
      
      console.log(`回退到最近的ALL_SYNCED状态，版本索引: ${lastSyncedVersion.version}`);
      
      // 通知所有状态变化监听器
      this.notifyStateChangeListeners(SystemState.ALL_SYNCED, previousState);
    } else {
      // 如果没有找到ALL_SYNCED状态，默认回退到初始状态
      console.warn('未找到ALL_SYNCED状态记录，回退到初始状态');
      const previousState = this.currentState;
      this.currentState = SystemState.ALL_SYNCED;
      this.lastDirtyState = null;
      this.retryCount = 0; // 重置重试计数器
      
      // 通知所有状态变化监听器
      this.notifyStateChangeListeners(SystemState.ALL_SYNCED, previousState);
    }
  }

  /**
   * 注册状态变化监听器 - 内部方法，供接口方法调用
   */
  private registerStateChangeListener(listener: StateChangeListener): void {
    this.stateChangeListeners.push(listener);
  }

  /**
   * 移除状态变化监听器 - 内部方法，供接口方法调用
   */
  private unregisterStateChangeListener(listener: StateChangeListener): void {
    const index = this.stateChangeListeners.indexOf(listener);
    if (index > -1) {
      this.stateChangeListeners.splice(index, 1);
    }
  }

  /**
   * 注册同步失败监听器
   */
  addSyncFailedListener(listener: (data: SyncFailedEventData) => void): void {
    this.syncFailedListeners.push(listener);
  }

  /**
   * 移除同步失败监听器
   */
  removeSyncFailedListener(listener: (data: SyncFailedEventData) => void): void {
    const index = this.syncFailedListeners.indexOf(listener);
    if (index > -1) {
      this.syncFailedListeners.splice(index, 1);
    }
  }

  /**
   * 初始化状态管理器
   * @param initialState 初始状态
   * @param rules 状态转换规则
   */
  initialize(initialState: SystemState, rules?: StateTransitionRules): void {
    this.currentState = initialState;
    this.lastStableState = initialState === SystemState.ALL_SYNCED ? initialState : SystemState.ALL_SYNCED;
    this.stateTransitionRules = rules || DEFAULT_STATE_TRANSITION_RULES;
    
    // 重新创建版本历史记录
    this.versionHistory = [{
      version: 0,
      timestamp: Date.now(),
      state: initialState,
      reason: 'Initialization'
    }];
  }

  /**
   * 添加状态变更监听器
   * @param listener 监听器函数
   * @returns 移除监听器的函数
   */
  addStateChangeListener(listener: StateChangeListener): () => void {
    this.registerStateChangeListener(listener);
    return () => {
      this.unregisterStateChangeListener(listener);
    };
  }

  /**
   * 移除所有状态变更监听器
   */
  removeAllStateChangeListeners(): void {
    this.stateChangeListeners = [];
  }
  
  /**
   * 移除指定的状态变更监听器
   * @param listener 要移除的监听器函数
   */
  removeStateChangeListener(listener: StateChangeListener): void {
    this.unregisterStateChangeListener(listener);
  }
  
  /**
   * 尝试转换到目标状态
   * @param targetState 目标状态
   * @returns 是否转换成功
   */
  tryTransition(targetState: SystemState): boolean {
    // 直接调用已有的transitionTo方法
    return this.transitionTo(targetState);
  }
  
  /**
   * 设置自定义编辑权限规则
   * @param permissionsMap 状态到编辑权限的映射
   */
  setEditPermissionsMap(permissionsMap: Map<SystemState, EditPermissions>): void {
    // 将Map转换为Record
    const recordMap: Partial<Record<SystemState, EditPermissions>> = {};
    permissionsMap.forEach((value, key) => {
      recordMap[key] = value;
    });
    this.editPermissionsMap = { ...this.editPermissionsMap, ...recordMap };
  }

  /**
   * 转换到新状态
   * @param newState 目标状态
   * @param reason 转换原因
   * @returns 是否转换成功
   */
  transitionTo(newState: SystemState, reason?: string): boolean {
    // 检查状态转换是否符合规则
    if (this.currentState !== newState && this.isValidTransition(newState)) {
      const previousState = this.currentState;
      this.currentState = newState;
      
      // 处理特殊状态转换逻辑
      if (newState === SystemState.ALL_SYNCED) {
        this.lastStableState = newState;
        
        // 仅当转换到ALL_SYNCED时创建版本快照
        this.createVersionSnapshot(reason || `Reached stable state`);
      } else if (newState === SystemState.BLOCKLY_DIRTY || newState === SystemState.MONACO_DIRTY) {
        this.lastDirtyState = newState;
      }
      
      // 通知所有状态变化监听器
      this.notifyStateChangeListeners(newState, previousState);
      
      // 可以在这里添加日志记录
      console.log(`状态转换: ${previousState} → ${newState}`);
      return true;
    }
    return false;
  }

  /**
   * 增强的状态转换函数
   * 支持错误事件触发的特殊转换逻辑
   * @param targetState 目标状态
   * @param errorType 错误类型（可选）
   * @param reason 转换原因（可选）
   * @returns 是否成功转换
   */
  public enhancedTransitionTo(targetState: SystemState, errorType?: ErrorType, reason?: string): boolean {
    // 允许通过错误事件从SYNC_PROCESSING转换到DIRTY状态
    if (this.currentState === SystemState.SYNC_PROCESSING && 
        (targetState === SystemState.BLOCKLY_DIRTY || targetState === SystemState.MONACO_DIRTY)) {
      const previousState = this.currentState;
      this.currentState = targetState;
      
      // 仅当转换到ALL_SYNCED时创建版本快照
      // 错误转换到DIRTY状态不创建版本快照
      
      // 通知所有状态变化监听器
      this.notifyStateChangeListeners(targetState, previousState, errorType);
      return true;
    }
    
    // 其他情况使用标准转换逻辑
    return this.transitionTo(targetState, reason);
  }

  /**
   * 检查状态转换是否符合规则
   * @param targetState 目标状态
   * @returns 是否有效转换
   */
  private isValidTransition(targetState: SystemState): boolean {
    // 获取当前状态的转换规则
    const allowedTransitions = this.stateTransitionRules[this.currentState];
    
    // 如果没有定义规则，默认允许所有转换（向后兼容）
    if (!allowedTransitions) {
      console.warn(`未定义状态 ${this.currentState} 的转换规则，默认允许所有转换`);
      return true;
    }
    
    // 检查目标状态是否在允许的转换列表中
    return allowedTransitions.includes(targetState);
  }

  /**
   * 创建版本快照
   * @param reason 创建原因
   */
  private createVersionSnapshot(reason: string): void {
    const currentVersion = this.versionHistory.length;
    
    const versionMeta: VersionMetadata = {
      version: currentVersion,
      timestamp: Date.now(),
      state: this.currentState,
      reason
    };
    
    this.versionHistory.push(versionMeta);
    
    // 限制历史记录长度，防止内存泄漏
    const MAX_HISTORY_LENGTH = 50;
    if (this.versionHistory.length > MAX_HISTORY_LENGTH) {
      this.versionHistory.shift();
    }
  }

  /**
   * 获取版本历史
   * @returns 版本历史记录
   */
  public getVersionHistory(): VersionMetadata[] {
    return [...this.versionHistory];
  }

  /**
   * 通知所有状态变化监听器
   */
  private notifyStateChangeListeners(newState: SystemState, _oldState?: SystemState, _errorType?: ErrorType): void {
    // 准备事件数据（将在与事件中心模块集成时使用）
    // const eventData: StateChangedEventDataEnhanced = {
    //   previousState: _oldState || this.currentState,
    //   currentState: newState,
    //   reason: `State changed from ${_oldState} to ${newState}`,
    //   _errorType,
    //   timestamp: Date.now()
    // };
    
    // 通过事件总线发布事件到事件中心模块（注释掉，实际实现中需要与事件中心模块集成）
    try {
      // eventBus.publish('state.changed', eventData);
    } catch (error) {
      console.warn('Failed to publish event to event bus:', error);
    }
    
    for (const listener of this.stateChangeListeners) {
      try {
        // 只传递第一个参数，因为接口定义中第二个参数是可选的
        listener(newState);
      } catch (error) {
        console.error('状态变化监听器执行错误:', error);
      }
    }
  }

  /**
   * 通知所有同步失败监听器
   */
  private notifySyncFailedListeners(data: SyncFailedEventData): void {
    // 通过事件总线发布事件到事件中心模块（注释掉，实际实现中需要与事件中心模块集成）
    try {
      // eventBus.publish('sync.failed', data);
    } catch (error) {
      console.warn('Failed to publish event to event bus:', error);
    }
    
    for (const listener of this.syncFailedListeners) {
      try {
        listener(data);
      } catch (error) {
        console.error('同步失败监听器执行错误:', error);
      }
    }
  }
}

/**
 * 创建状态管理器实例的工厂函数
 */
export function createStateManager(): StateManager {
  return new JsonStateManager();
}

/**
 * 获取编辑权限
 * @param state 当前状态
 * @param editPermissionsMap 编辑权限映射（可选）
 * @returns 编辑权限对象
 */
export function getEditPermissions(
  state: SystemState,
  editPermissionsMap: Record<SystemState, EditPermissions> = DEFAULT_EDIT_PERMISSIONS
): EditPermissions {
  return editPermissionsMap[state] || DEFAULT_EDIT_PERMISSIONS[SystemState.ALL_SYNCED];
}

/**
 * 处理同步错误
 * @param errorType 错误类型
 * @param stateManager 状态管理器实例
 * @param _errorMessage 错误消息（保留用于未来扩展）
 */
export function handleSyncError(
  errorType: ErrorType,
  stateManager: StateManager,
  _errorMessage: string = ''
): void {
  const transitionConfig = ERROR_TRANSITIONS[errorType];
  if (transitionConfig) {
    if (transitionConfig.targetState) {
      stateManager.tryTransition(transitionConfig.targetState);
    } else if (stateManager instanceof JsonStateManager) {
      // 使用JsonStateManager特有的方法
      const lastDirtyState = (stateManager as any).lastDirtyState;
      if (lastDirtyState && (stateManager as any).enhancedTransitionTo) {
        (stateManager as any).enhancedTransitionTo(lastDirtyState, errorType);
      }
    }
  }
}

/**
 * 处理用户编辑
 * @param editorType 编辑器类型
 * @param stateManager 状态管理器实例
 * @returns 是否允许编辑
 */
export function handleUserEdit(
  editorType: 'blockly' | 'monaco',
  stateManager: StateManager
): boolean {
  const currentState = stateManager.getCurrentState();
  const permissions = getEditPermissions(currentState);
  
  const isAllowed = editorType === 'blockly' ? permissions.blocklyEditable : permissions.monacoEditable;
  
  if (isAllowed) {
    const targetState = editorType === 'blockly' ? SystemState.BLOCKLY_DIRTY : SystemState.MONACO_DIRTY;
    stateManager.tryTransition(targetState);
  }
  
  return isAllowed;
}

// 重新导出contracts中的类型和常量，以便从模块根目录访问
export { 
  SystemState, 
  ErrorType, 
  ErrorClassification, 
  STANDARDIZED_ERROR_HANDLING,
  ERROR_TRANSITIONS,
  DEFAULT_STATE_TRANSITION_RULES
} from './contracts';

/**
 * 全局错误处理函数
 * @param errorType 错误类型
 * @param stateManager 状态管理器实例
 * @param _errorMessage 错误消息（保留用于未来扩展）
 */
export function handleError(
  errorType: ErrorType,
  stateManager: StateManager,
  _errorMessage: string = ''
): void {
  const transitionConfig = ERROR_TRANSITIONS[errorType];
  if (transitionConfig) {
    if (transitionConfig.targetState) {
      stateManager.tryTransition(transitionConfig.targetState);
    } else if (stateManager instanceof JsonStateManager) {
      // 使用JsonStateManager特有的方法
      const lastDirtyState = (stateManager as any).lastDirtyState;
      if (lastDirtyState && (stateManager as any).enhancedTransitionTo) {
        (stateManager as any).enhancedTransitionTo(lastDirtyState, errorType);
      }
    }
  }
}