/**
 * 状态管理模块契约实现
 * 包含状态管理相关的所有类型、接口和枚举定义
 */

/**
 * 系统状态常量定义
 * 四状态模型（含临时状态）
 */
export const SystemState = {
  /**
   * 所有层数据完全同步
   */
  ALL_SYNCED: 'ALL_SYNCED',

  /**
   * Blockly编辑器已修改，与JSON层不一致
   */
  BLOCKLY_DIRTY: 'BLOCKLY_DIRTY',

  /**
   * Monaco编辑器已修改，与JSON层不一致
   */
  MONACO_DIRTY: 'MONACO_DIRTY',

  /**
   * 正在进行同步处理的临时状态
   */
  SYNC_PROCESSING: 'SYNC_PROCESSING'
} as const;

export type SystemState = typeof SystemState[keyof typeof SystemState];

/**
 * 状态转换规则接口
 * 定义了从当前状态可以转换到哪些目标状态
 */
export interface StateTransitionRules {
  /**
   * 键: 当前状态
   * 值: 可转换到的目标状态数组
   */
  [key: string]: SystemState[];
}

/**
 * 默认状态转换规则
 * 注意：SYNC_PROCESSING到DIRTY状态的转换应通过错误事件触发，而不是直接在规则中定义
 */
export const DEFAULT_STATE_TRANSITION_RULES: StateTransitionRules = {
  [SystemState.ALL_SYNCED]: [SystemState.BLOCKLY_DIRTY, SystemState.MONACO_DIRTY],
  [SystemState.BLOCKLY_DIRTY]: [SystemState.SYNC_PROCESSING], // 移除自转换规则，用户继续编辑通过handleUserEdit函数处理
  [SystemState.MONACO_DIRTY]: [SystemState.SYNC_PROCESSING], // 移除自转换规则，用户继续编辑通过handleUserEdit函数处理
  [SystemState.SYNC_PROCESSING]: [SystemState.ALL_SYNCED]
};

/**
 * 状态元数据定义
 */
export const StateMetadata = {
  [SystemState.ALL_SYNCED]: {
    isTemporary: false,
    timeout: 0,
  },
  [SystemState.BLOCKLY_DIRTY]: {
    isTemporary: false,
    timeout: 0,
  },
  [SystemState.MONACO_DIRTY]: {
    isTemporary: false,
    timeout: 0,
  },
  [SystemState.SYNC_PROCESSING]: {
    isTemporary: true,
    timeout: 5000, // 5秒超时
  },
};

/**
 * 编辑权限接口
 */
export interface EditPermissions {
  /**
   * Blockly编辑器是否可编辑
   */
  blocklyEditable: boolean;

  /**
   * Monaco编辑器是否可编辑
   */
  monacoEditable: boolean;

  /**
   * 是否允许切换编辑器
   */
  canSwitchEditor: boolean;
  
  /**
   * 进入SYNC_PROCESSING前的最后一个DIRTY状态
   * 用于在同步过程中确定原编辑侧
   */
  lastDirtyState?: typeof SystemState.BLOCKLY_DIRTY | typeof SystemState.MONACO_DIRTY | null;
}

/**
 * 状态事件类型
 */
export type StateEventType = 'state.changed' | 'sync.started' | 'sync.completed' | 'sync.failed' | 'timeout';

/**
 * 状态事件类型常量
 * 严格遵循小写字母+点分隔命名规范
 */
export const StateEventTypes = {
  /** 状态已变更 */
  state_changed: 'state.changed' as StateEventType,
  /** 同步已开始 */
  sync_started: 'sync.started' as StateEventType,
  /** 同步已完成 */
  sync_completed: 'sync.completed' as StateEventType,
  /** 同步已失败 */
  sync_failed: 'sync.failed' as StateEventType,
  /** 超时事件 */
  timeout: 'timeout' as StateEventType
};

/**
 * 状态变更事件数据接口
 */
export interface StateChangedEventData {
  newState: SystemState;
  oldState: SystemState;
  reason?: string;
}

/**
 * 状态变更监听器
 */
export interface StateChangeListener {
  (newState: SystemState, oldState?: SystemState): void;
}

/**
 * 同步失败事件数据接口
 */
export interface SyncFailedEventData {
  errorMessage: string;
  errorCode?: string;
  originalState: SystemState;
  attemptedSyncFrom: typeof SystemState.BLOCKLY_DIRTY | typeof SystemState.MONACO_DIRTY;
}

/**
 * 状态管理器接口
 */
export interface StateManager {
  /**
   * 初始化状态管理器
   * @param initialState 初始状态
   * @param rules 状态转换规则
   */
  initialize(initialState: SystemState, rules?: StateTransitionRules): void;

  /**
   * 获取当前状态
   * @returns 当前系统状态
   */
  getCurrentState(): SystemState;

  /**
   * 尝试转换到目标状态
   * @param targetState 目标状态
   * @returns 是否转换成功
   */
  tryTransition(targetState: SystemState): boolean;

  /**
   * 添加状态变更监听器
   * @param listener 状态变更监听器
   * @returns 移除监听器的函数
   */
  addStateChangeListener(listener: StateChangeListener): () => void;

  /**
   * 移除状态变更监听器
   * @param listener 状态变更监听器
   */
  removeStateChangeListener(listener: StateChangeListener): void;

  /**
   * 增加同步失败监听器
   * @param listener 同步失败监听器
   */
  addSyncFailedListener(listener: (data: SyncFailedEventData) => void): void;

  /**
   * 移除同步失败监听器
   * @param listener 同步失败监听器
   */
  removeSyncFailedListener(listener: (data: SyncFailedEventData) => void): void;

  /**
   * 获取当前状态的编辑权限
   * @returns 编辑权限配置
   */
  getEditPermissions(): EditPermissions;

  /**
   * 设置自定义编辑权限规则
   * @param permissionsMap 状态到编辑权限的映射
   */
  setEditPermissionsMap(permissionsMap: Map<SystemState, EditPermissions>): void;

  /**
   * 处理Blockly编辑器的用户编辑
   */
  handleBlocklyEdit(): void;

  /**
   * 处理Monaco编辑器的用户编辑
   */
  handleMonacoEdit(): void;

  /**
   * 触发同步处理
   */
  triggerSync(): void;

  /**
   * 处理同步成功
   */
  handleSyncSuccess(): void;

  /**
   * 处理同步失败
   * @param errorMessage 错误消息
   * @param errorCode 错误代码
   * @param skipRetry 是否跳过重试（用于测试或特殊场景）
   */
  handleSyncFailed(errorMessage: string, errorCode?: string, skipRetry?: boolean): void;

  /**
   * 回滚到指定版本
   * @param targetVersion 可选，目标版本索引，如果不提供则回退到最近的ALL_SYNCED状态
   */
  rollbackToVersion(targetVersion?: number): void;
}

/**
 * 错误分类枚举
 */
export const ErrorClassification = {
  /**
   * 系统错误 - 通常由网络、服务或环境问题引起
   */
  SYSTEM: 'SYSTEM',

  /**
   * 数据错误 - 通常由数据格式、验证或逻辑错误引起
   */
  DATA: 'DATA',

  /**
   * 未知错误 - 无法明确分类的错误
   */
  UNKNOWN: 'UNKNOWN'
} as const;

export type ErrorClassification = typeof ErrorClassification[keyof typeof ErrorClassification];

/**
 * 错误类型枚举
 */
export const ErrorType = {
  // 系统相关错误
  SYNC_TIMEOUT: 'SYNC_TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PERFORMANCE_ISSUE: 'PERFORMANCE_ISSUE',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
  RESOURCE_EXHAUSTION: 'RESOURCE_EXHAUSTION',
  
  // 数据相关错误
  FORMAT_ERROR: 'FORMAT_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SYNTAX_ERROR: 'SYNTAX_ERROR',
  SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
  DATA_INTEGRITY_VIOLATION: 'DATA_INTEGRITY_VIOLATION',
  DEPRECATED_FEATURE: 'DEPRECATED_FEATURE',
  
  // 未知错误
  UNKNOWN: 'UNKNOWN'
} as const;

export type ErrorType = typeof ErrorType[keyof typeof ErrorType];

/**
 * 错误事件与状态转换映射表
 */
export const ERROR_TRANSITIONS = {
  // 系统错误 - 回退到最近的ALL_SYNCED状态
  [ErrorType.SYNC_TIMEOUT]: { targetState: SystemState.ALL_SYNCED, skipRetry: false, retryLimit: 3 },
  [ErrorType.SERVICE_UNAVAILABLE]: { targetState: SystemState.ALL_SYNCED, skipRetry: true, retryLimit: 0 },
  [ErrorType.NETWORK_ERROR]: { targetState: SystemState.ALL_SYNCED, skipRetry: false, retryLimit: 2 },
  [ErrorType.PERFORMANCE_ISSUE]: { targetState: SystemState.ALL_SYNCED, skipRetry: true, retryLimit: 0 },
  [ErrorType.RUNTIME_ERROR]: { targetState: SystemState.ALL_SYNCED, skipRetry: true, retryLimit: 0 },
  [ErrorType.RESOURCE_EXHAUSTION]: { targetState: SystemState.ALL_SYNCED, skipRetry: true, retryLimit: 0 },
  
  // 数据错误 - 回退到lastDirtyState
  [ErrorType.FORMAT_ERROR]: { targetState: null, skipRetry: true, retryLimit: 0 }, // 回退到lastDirtyState
  [ErrorType.VALIDATION_ERROR]: { targetState: null, skipRetry: true, retryLimit: 0 },
  [ErrorType.SYNTAX_ERROR]: { targetState: null, skipRetry: true, retryLimit: 0 },
  [ErrorType.SCHEMA_MISMATCH]: { targetState: null, skipRetry: true, retryLimit: 0 },
  [ErrorType.DATA_INTEGRITY_VIOLATION]: { targetState: null, skipRetry: true, retryLimit: 0 },
  [ErrorType.DEPRECATED_FEATURE]: { targetState: null, skipRetry: true, retryLimit: 0 },
  
  // 未知错误
  [ErrorType.UNKNOWN]: { targetState: SystemState.ALL_SYNCED, skipRetry: true, retryLimit: 1 }
};

/**
 * 标准化错误处理策略
 */
export const STANDARDIZED_ERROR_HANDLING = {
  [ErrorClassification.SYSTEM]: {
    maxRetries: 3,
    retryDelay: 1000,
    fallbackStrategy: 'ROLLBACK_TO_STABLE',
    recoveryTimeout: 30000
  },
  [ErrorClassification.DATA]: {
    maxRetries: 0,
    retryDelay: 0,
    fallbackStrategy: 'KEEP_DIRTY_STATE',
    recoveryTimeout: 0
  },
  [ErrorClassification.UNKNOWN]: {
    maxRetries: 1,
    retryDelay: 1000,
    fallbackStrategy: 'ROLLBACK_TO_STABLE',
    recoveryTimeout: 15000
  }
};

/**
 * 增强的状态变更事件数据接口
 */
export interface StateChangedEventDataEnhanced {
  previousState: SystemState;
  currentState: SystemState;
  reason?: string;
  errorType?: ErrorType;
  timestamp: number;
  metadata?: Record<string, any>;
}