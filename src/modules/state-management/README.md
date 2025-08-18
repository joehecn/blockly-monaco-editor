---
filename: README.md
title: 状态管理模块说明文档
description: 系统核心组件，负责管理系统状态转换、确保三层数据一致性与处理编辑器协作的模块说明文档
---

# 状态管理模块说明文档

## 概述

状态管理模块是系统的核心组件，负责统一协调管理Blockly编辑器、JSON结构和Monaco编辑器之间的状态转换，确保三层数据的语义一致性。通过精心设计的四状态模型（包含临时同步状态），将分布式系统中的物理不一致转化为可预测、可控制的逻辑一致状态，在保证数据完整性的同时为用户提供流畅无缝的编辑体验。

> 状态机规范一致性声明：
> 本模块实现严格遵循 [状态机规范](./02b-state-machine-specification.md) 定义的状态转换规则，
> 特别是SYNC_PROCESSING→\*\_DIRTY转换必须通过错误事件触发的约束。

完整系统架构见[02-system-architecture.md](../../docs/02-system-architecture.md)，核心原则见[01-core-principles.md](../../docs/01-core-principles.md)。

## 核心职责

- 管理系统状态定义、转换规则和状态迁移流程
- 维护三层数据（Blockly、JSON、Monaco）的语义一致性
- 控制编辑器编辑权限与操作互斥逻辑
- 提供状态变更通知机制与事件订阅系统
- 处理同步超时、错误恢复与故障保护策略
- 实现版本安全机制，自动创建和管理版本快照

## 模块依赖

**依赖模块**:

- 事件中心模块 (`event.changed` 事件处理) - 通过事件总线实现松耦合通信
- 错误处理模块 (分层恢复策略)

**事件订阅示例**:

```typescript
// 与事件中心模块的集成方式
eventCenter.on('blockly.changed', blocks => {
  stateManager.handleUserEdit('blockly', blocks);
});

eventCenter.on('monaco.changed', code => {
  stateManager.handleUserEdit('monaco', code);
});

eventCenter.on('sync.completed', () => {
  // 同步完成后处理待编辑内容
  if (pendingInput) {
    const { source, data } = pendingInput;
    stateManager.handleUserEdit(source, data);
    pendingInput = null;
  }
});
```

## 四状态模型

### 三层架构定义

状态管理模块基于三层架构设计：

- **UI层（Blockly编辑器）**：可视化编辑界面
- **权威层（JSON结构）**：系统的逻辑权威源，保证数据一致性
- **UI层（Monaco编辑器）**：代码文本编辑界面

### 状态定义

| 状态              | 逻辑一致性语义   | 编辑权归属     | 允许来源端继续编辑 | 物理现实            |
| ----------------- | ---------------- | -------------- | ------------------ | ------------------- |
| `ALL_SYNCED`      | 三层数据语义对等 | 双UI编辑器     | -                  | 完全同步            |
| `BLOCKLY_DIRTY`   | Blockly为权威源  | 仅Blockly      | -                  | blockly≠json≡monaco |
| `MONACO_DIRTY`    | Monaco为权威源   | 仅Monaco       | -                  | blockly≡json≠monaco |
| `SYNC_PROCESSING` | 同步转换中       | 仅来源端可编辑 | ✅                 | 转换中              |

### 状态转换图

```
graph TD
    A[ALL_SYNCED] -->|用户编辑Blockly| B[BLOCKLY_DIRTY]
    A -->|用户编辑Monaco| C[MONACO_DIRTY]
    B -->|触发同步| D[SYNC_PROCESSING]
    C -->|触发同步| D
    D -->|同步成功| A
    classDef error stroke-dasharray:5,5,color:red;
    class B,C error;
```

**重要提示：** 根据[02b-state-machine-specification.md]规范，SYNC_PROCESSING到BLOCKLY_DIRTY/MONACO_DIRTY的转换**必须通过错误事件触发**，不允许在状态转换图中定义这些直接路径。错误处理由专门的错误恢复机制处理，详见错误恢复机制章节。

### 状态转换规则

- `ALL_SYNCED` → `BLOCKLY_DIRTY`：用户编辑Blockly
- `ALL_SYNCED` → `MONACO_DIRTY`：用户编辑Monaco
- `BLOCKLY_DIRTY` → `SYNC_PROCESSING`：300ms防抖后触发同步
- `MONACO_DIRTY` → `SYNC_PROCESSING`：300ms防抖后触发同步
- `SYNC_PROCESSING` → `ALL_SYNCED`：必须通过同步成功事件触发
- 用户持续编辑通过handleUserEdit函数处理，不触发额外的状态转换

**重要核心约束**：`SYNC_PROCESSING` 到 `BLOCKLY_DIRTY` 或 `MONACO_DIRTY` 的转换**必须**通过错误事件触发，而不允许在状态转换规则中定义直接路径。这是遵循 ./02b-state-machine-specification.md 定义的有限状态机规范的关键保障。

### 错误回退路径

在同步处理过程中发生错误时，系统将根据错误类型自动回退到相应的稳定状态：

- `SYNC_PROCESSING` → `BLOCKLY_DIRTY`（错误码：1001）：仅当同步从Blockly发起且发生错误时触发
- `SYNC_PROCESSING` → `MONACO_DIRTY`（错误码：遵循03-contracts.md中的DATA_TRANSFORM错误码1002）：仅当同步从Monaco发起且发生错误时触发
- `SYNC_PROCESSING` → 最后稳定状态（错误码：1003）：同步超时或严重系统错误

所有回退操作都会触发`STATE_RECOVERED`事件，并在UI上显示相应的错误信息。

**SYNC_PROCESSING超时处理**：当同步过程超过5秒时，系统将自动触发超时事件（错误码：1004），状态将回退到最后一个稳定状态。

**错误恢复调用逻辑示例**:

```typescript
/**
 * 错误类型枚举
 */
const ErrorTypes = {
  SYSTEM: 'SYSTEM',     // 系统错误：网络问题、超时、服务器错误等
  DATA: 'DATA'          // 数据错误：格式错误、校验失败、解析错误等
};

/**
 * 处理同步错误，根据错误类型选择不同的恢复策略
 */
function handleSyncError(errorType: string, errorCode?: string) {
  // 根据错误类型决定恢复策略
  if (errorType === ErrorTypes.SYSTEM) {
    // 系统级错误：回退到LastStableState(ALL_SYNCED)
    const recoveryState = stableStateManager.getLastStableState() || SystemState.ALL_SYNCED;
    stateManager.transitionTo(recoveryState);
    
    console.log(`系统错误（${errorCode || 'UNKNOWN'}），回退到最近的ALL_SYNCED状态`);
  } else {
    // 数据错误：回退到lastDirtyState，保留用户编辑
    const recoveryState = stableStateManager.getLastDirtyState() || SystemState.ALL_SYNCED;
    stateManager.transitionTo(recoveryState);
    
    console.log(`数据错误，保持在DIRTY状态以保留用户编辑`);
  }
  
  // 触发状态恢复事件
  publishEvent(StateEventType.STATE_RECOVERED, {
    newState: stateManager.getCurrentState(),
    previousState: currentState,
    recoveryAction: `Error recovery due to ${errorType} error (code: ${errorCode || 'unknown'})`,
  });
}
```

## LastStableState机制定义

### 稳定状态精确定义

为避免混淆，特此明确定义：

- **LastStableState**：仅记录`ALL_SYNCED`状态
- **脏状态**：`BLOCKLY_DIRTY`/`MONACO_DIRTY`通过独立字段`lastDirtyState`记录
- **错误恢复优先级**：
  - 系统级错误 → 回退到LastStableState(ALL_SYNCED)
  - 数据转换错误 → 回退到lastDirtyState

### StableStateManager类实现

```typescript
class StableStateManager {
  private lastStableState: SystemState = SystemState.ALL_SYNCED;
  private lastDirtyState: SystemState | null = null;
  
  recordStableState(state: SystemState): void {
    if (state === SystemState.ALL_SYNCED) {
      this.lastStableState = state;
    }
  }
  
  getLastStableState(): SystemState {
    return this.lastStableState;
  }
  
  recordDirtyState(state: SystemState): void {
    if ([SystemState.BLOCKLY_DIRTY, SystemState.MONACO_DIRTY].includes(state)) {
      this.lastDirtyState = state;
    }
  }
  
  getLastDirtyState(): SystemState | null {
    return this.lastDirtyState;
  }
}

// 全局稳定状态管理器实例
const stableStateManager = new StableStateManager();
```

### 错误恢复时的LastStableState使用原则

系统现在采用更明确的错误类型区分策略：

1. **系统错误处理**
   - 包括：`SYNC_TIMEOUT`, `NETWORK_ERROR`, `SERVER_ERROR`, `CONNECTION_LOST`等
   - 恢复策略：立即回退到最近的`ALL_SYNCED`状态
   - 优先级：稳定性优先，确保系统状态一致

2. **数据错误处理**
   - 包括：格式错误、校验失败、解析错误等
   - 恢复策略：保持在`BLOCKLY_DIRTY`或`MONACO_DIRTY`状态，保留用户编辑
   - 优先级：用户编辑优先，允许用户修正错误
   - 重试机制：最多重试3次，每次间隔500ms

```typescript
function handleSyncError(errorType: string, errorCode?: string) {
  // 判断错误类型
  const isSystemError = ['SYNC_TIMEOUT', 'NETWORK_ERROR', 'SERVER_ERROR', 'CONNECTION_LOST']
    .includes(errorCode || '');
    
  if (isSystemError) {
    // 系统错误：回退到LastStableState
    const recoveryState = stableStateManager.getLastStableState() || SystemState.ALL_SYNCED;
    stateManager.transitionTo(recoveryState);
  } else {
    // 数据错误：回退到lastDirtyState
    const recoveryState = stableStateManager.getLastDirtyState() || SystemState.ALL_SYNCED;
    stateManager.transitionTo(recoveryState);
  }

  publishEvent(StateEventType.STATE_RECOVERED, {
    newState: stateManager.getCurrentState(),
    previousState: currentState,
    recoveryAction: `Error recovery due to ${errorType} (${errorCode || 'unknown'})`,
  });
}
```

**重要澄清**：根据核心原则文档（01-core-principles.md）的错误恢复原则，系统在发生错误时必须恢复到数据一致状态，而只有`ALL_SYNCED`状态能保证三层数据的完全一致性。因此，`BLOCKLY_DIRTY`和`MONACO_DIRTY`状态不属于稳定状态，不应作为LastStableState的值。

### 状态存储机制

系统维护一个`lastStableState`变量，用于存储最后一个稳定状态（非SYNC_PROCESSING状态）。

````typescript
/**
 * lastStableState管理机制
 */
class StableStateManager {
  private lastStableState: SystemState = SystemState.ALL_SYNCED;
  private lastDirtyState: SystemState | null = null;

  /**
   * 记录新的稳定状态
   */
  recordStableState(state: SystemState): void {
    if (state !== SystemState.SYNC_PROCESSING) {
      this.lastStableState = state;
      // 记录脏状态以便错误恢复时参考
      if (state === SystemState.BLOCKLY_DIRTY || state === SystemState.MONACO_DIRTY) {
        this.lastDirtyState = state;
      }
    }
  }

  /**
   * 记录脏状态
   */
  recordDirtyState(state: SystemState): void {
    if (state === SystemState.BLOCKLY_DIRTY || state === SystemState.MONACO_DIRTY) {
      this.lastDirtyState = state;
    }
  }

  /**
   * 获取最后一个稳定状态
   */
  getLastStableState(): SystemState {
    return this.lastStableState;
  }

  /**
   * 获取最后一个脏状态
   */
  getLastDirtyState(): SystemState | null {
    return this.lastDirtyState;
  }
}

// 使用示例
const stableStateManager = new StableStateManager();

// 在状态转换时更新稳定状态
transitionTo(newState: SystemState): boolean {
  const oldState = currentState;
  // 状态转换逻辑...
  currentState = newState;

  // 更新状态记录
  if (newState === SystemState.ALL_SYNCED) {
    // 严格遵循[01-core-principles.md]原则：仅记录ALL_SYNCED状态
    stableStateManager.recordStableState(newState);
  } else if (newState === SystemState.BLOCKLY_DIRTY || newState === SystemState.MONACO_DIRTY) {
    // 记录脏状态
    stableStateManager.recordDirtyState(newState);
  }

  // 触发状态变更事件
  publishEvent(StateEventType.state_changed, {
    newState,
    oldState,
    timestamp: Date.now()
  });

  return true;
}

### 错误恢复可视化
```flowchart TD
    A[发生错误] --> B{错误类型}
    B -->|用户输入错误| C[UI提示+保持编辑状态]
    B -->|数据转换错误| D[自动重试3次]
    D -->|成功| E[继续流程]
    D -->|失败| F[回退到原DIRTY状态]
    B -->|系统故障| G[版本回退]
    G -->|成功| H[ALL_SYNCED状态]
    G -->|失败| I[禁用编辑器+人工介入]
````

### 状态枚举

```typescript
enum SystemState {
  ALL_SYNCED = 'ALL_SYNCED',
  BLOCKLY_DIRTY = 'BLOCKLY_DIRTY',
  MONACO_DIRTY = 'MONACO_DIRTY',
  SYNC_PROCESSING = 'SYNC_PROCESSING',
}

// 状态元数据定义
const StateMetadata = {
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
```

### 状态转换规则

```typescript
interface StateTransitionRules {
  [key: string]: SystemState[];
}

/**
 * 同步处理状态可转换的目标状态类型
 */
type SyncProcessingTransitions =
  | SystemState.ALL_SYNCED
  | SystemState.BLOCKLY_DIRTY
  | SystemState.MONACO_DIRTY;

/**
 * 状态转换规则定义
 */
const DEFAULT_STATE_TRANSITION_RULES: StateTransitionRules = {
  [SystemState.ALL_SYNCED]: [
    SystemState.BLOCKLY_DIRTY,
    SystemState.MONACO_DIRTY,
  ],
  [SystemState.BLOCKLY_DIRTY]: [SystemState.SYNC_PROCESSING],
  [SystemState.MONACO_DIRTY]: [SystemState.SYNC_PROCESSING],
  [SystemState.SYNC_PROCESSING]: [
    SystemState.ALL_SYNCED,
    // 注意：SYNC_PROCESSING到DIRTY状态的转换必须通过错误事件触发，不在规则中直接定义
  ],
};

/**
 * 错误事件与状态转换映射表
 * 重要规则：SYNC_PROCESSING → BLOCKLY_DIRTY/MONACO_DIRTY路径仅由错误事件触发，不允许直接状态转换
 * 遵循02b-state-machine-specification.md的有限状态机规范
 */
enum ErrorType {
  BLOCKLY_ERROR = 'BLOCKLY_ERROR',
  MONACO_ERROR = 'MONACO_ERROR',
  SYNC_ERROR = 'SYNC_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

const ERROR_TRANSITIONS: Record<ErrorType, SystemState> = {
  [ErrorType.BLOCKLY_ERROR]: SystemState.BLOCKLY_DIRTY,
  [ErrorType.MONACO_ERROR]: SystemState.MONACO_DIRTY,
  [ErrorType.SYNC_ERROR]: SystemState.ALL_SYNCED,
  [ErrorType.TIMEOUT_ERROR]: SystemState.ALL_SYNCED,
  [ErrorType.VALIDATION_ERROR]: SystemState.ALL_SYNCED,
  [ErrorType.UNKNOWN_ERROR]: SystemState.ALL_SYNCED,
};

/**
 * 状态转换规则 - 再次强调：SYNC_PROCESSING到DIRTY状态的转换必须通过错误事件触发
 * 这是确保状态机稳定性和可预测性的关键约束
 */
```

### 错误事件与状态转换映射

| 错误类型      | 触发事件            | 目标状态         | 处理机制                       |
| ------------- | ------------------- | ---------------- | ------------------------------ |
| 数据转换失败  | SYNC_FAILED         | 原DIRTY状态      | 自动回退，显示错误信息         |
| 同步超时      | TIMEOUT             | 最后稳定状态     | 自动回退，提示重试             |
| 编辑器API错误 | EDITOR_API_ERROR    | 最后稳定状态     | 尝试重新初始化，提示用户       |
| 数据验证失败  | VALIDATION_FAILED   | 原DIRTY状态      | 显示详细验证错误，允许用户修改 |
| 状态机错误    | STATE_MACHINE_ERROR | ALL_SYNCED(重置) | 强制重置状态机，重新初始化     |

````

### 编辑权限 - 遵循03-contracts.md Phase1 EditPermissions定义
```typescript
interface EditPermissions {
  blocklyEditable: boolean;
  monacoEditable: boolean;
  canSwitchEditor: boolean;
  lastDirtyState?: SystemState.BLOCKLY_DIRTY | SystemState.MONACO_DIRTY | null;
  // SYNC_PROCESSING状态下：lastDirtyState标识来源端
}

/**
 * 编辑权限控制实现
 */
const getEditPermissions = (currentState: SystemState, lastDirtyState?: SystemState): EditPermissions => {
  switch (currentState) {
    case SystemState.ALL_SYNCED:
      return {
        blocklyEditable: true,
        monacoEditable: true,
        canSwitchEditor: true,
        lastDirtyState: null
      };

    case SystemState.BLOCKLY_DIRTY:
      return {
        blocklyEditable: true,
        monacoEditable: false,
        canSwitchEditor: false,
        lastDirtyState: undefined
      };

    case SystemState.MONACO_DIRTY:
      return {
        blocklyEditable: false,
        monacoEditable: true,
        canSwitchEditor: false,
        lastDirtyState: undefined
      };

    case SystemState.SYNC_PROCESSING:
      // SYNC_PROCESSING状态下的编辑约束:
      // 1. 只有发起同步的编辑端（即lastDirtyState对应的编辑器）可以继续编辑
      // 2. 新编辑不会中断当前同步进程，但会触发编辑事件
      // 3. 同步完成后会基于最新状态重新开始同步流程
      return {
        blocklyEditable: lastDirtyState === SystemState.BLOCKLY_DIRTY,
        monacoEditable: lastDirtyState === SystemState.MONACO_DIRTY,
        canSwitchEditor: false,
        lastDirtyState: lastDirtyState || undefined
      };

    default:
      return {
        blocklyEditable: false,
        monacoEditable: false,
        canSwitchEditor: false,
        lastDirtyState: undefined
      };
  }
}

/**
 * 处理用户编辑的具体实现函数
 */
function handleUserEdit(
  source: 'blockly' | 'monaco',
  editData: any,
  currentState: SystemState,
  lastDirtyState?: SystemState
): { newState: SystemState; shouldProcess: boolean } {
  const permissions = getEditPermissions(currentState, lastDirtyState);

  // 检查是否有编辑权限
  if ((source === 'blockly' && !permissions.blocklyEditable) ||
      (source === 'monaco' && !permissions.monacoEditable)) {
    return { newState: currentState, shouldProcess: false };
  }

  // 处理编辑并返回新状态
  if (currentState === SystemState.SYNC_PROCESSING) {
    // 在同步过程中，允许来源端继续编辑，但不立即改变状态
    // 编辑内容会被收集，等待当前同步完成后再处理
    return { newState: currentState, shouldProcess: true };
  } else if (currentState === SystemState.ALL_SYNCED) {
    // 从同步状态开始编辑，直接转换到相应的脏状态
    const newState = source === 'blockly' ?
      SystemState.BLOCKLY_DIRTY : SystemState.MONACO_DIRTY;
    return { newState, shouldProcess: true };
  } else {
    // 在已有脏状态下编辑，保持当前脏状态
    return { newState: currentState, shouldProcess: true };
  }
}

/**
 * 状态转换规则 - 遵循03-contracts.md Phase2定义
 */
const DEFAULT_STATE_TRANSITION_RULES: StateTransitionRules = {
  [SystemState.ALL_SYNCED]: [
    SystemState.BLOCKLY_DIRTY,
    SystemState.MONACO_DIRTY
  ],
  [SystemState.BLOCKLY_DIRTY]: [
    SystemState.SYNC_PROCESSING
    // 注意：移除了自转换规则，用户继续编辑通过handleUserEdit函数处理
  ],
  [SystemState.MONACO_DIRTY]: [
    SystemState.SYNC_PROCESSING
    // 注意：移除了自转换规则，用户继续编辑通过handleUserEdit函数处理
  ],
  [SystemState.SYNC_PROCESSING]: [
    SystemState.ALL_SYNCED
    // 注意：SYNC_PROCESSING到DIRTY状态的转换必须通过错误事件触发，不在规则中直接定义
  ]
};

### 编辑权与状态映射表
| 系统状态 | Blockly编辑权限 | Monaco编辑权限 | 切换编辑器权限 | 最后脏状态 | 说明 |
|---------|---------------|---------------|------------|------------|-----|
| ALL_SYNCED | ✓ | ✓ | ✓ | - | 稳定状态，双编辑器均可编辑 |
| BLOCKLY_DIRTY | ✓ | ✗ | ✗ | - | Blockly正在编辑，Monaco被锁定 |
| MONACO_DIRTY | ✗ | ✓ | ✗ | - | Monaco正在编辑，Blockly被锁定 |
| SYNC_PROCESSING | 仅来源端可编辑 | 仅来源端可编辑 | ✗ | 同步来源端 | 仅来源端（触发同步的编辑器）可继续编辑，新输入覆盖旧值（单一覆盖策略） |

### 标准化错误分类表（遵循03-contracts.md Phase5错误处理契约）
| 错误类型 | 描述 | 错误代码 (ErrorType) | 错误码编号 | 处理策略 | 状态转换 | 恢复动作 |
|---------|------|---------------------|-----------|---------|---------|---------|
| **用户输入错误** | 用户输入的内容不符合要求 | ErrorType.INPUT | 1001 | 显示错误提示，允许用户修改 | 保持当前DIRTY状态 | UI提示 |
| **数据转换错误** | 编辑器间数据转换失败 | ErrorType.DATA_TRANSFORM | 1002 | 自动重试3次，失败则回退 | SYNC_PROCESSING → 原DIRTY状态 | 自动重试+回退 |
| **系统故障错误** | 系统内部错误 | ErrorType.SYSTEM | 1003 | 自动保护机制，尝试版本回退 | 任意状态 → ALL_SYNCED(上次快照) | 版本回退+重新初始化 |
| **同步超时** | 同步过程超过5秒 | ErrorType.TIMEOUT | 1004 | 终止当前同步，回退到安全状态 | SYNC_PROCESSING → 最后稳定状态 | 终止同步+回退 |
| **状态机错误** | 状态转换不符合预期 | ErrorType.STATE_MACHINE | 1005 | 强制重置状态机，重新初始化 | 任意状态 → ALL_SYNCED(重置) | 强制重置 |
| **验证错误** | 数据验证未通过 | ErrorType.VALIDATION | 1006 | 显示验证错误，允许用户修改 | 保持当前DIRTY状态 | 标记错误字段 |

### 错误恢复可视化
```flowchart TD
    A[发生错误] --> B{错误类型}
    B -->|用户输入错误| C[UI提示+保持编辑状态]
    B -->|数据转换错误| D[自动重试3次]
    D -->|成功| E[继续流程]
    D -->|失败| F[回退到原DIRTY状态]
    B -->|系统故障| G[版本回退]
    G -->|成功| H[ALL_SYNCED状态]
    G -->|失败| I[禁用编辑器+人工介入]
````

### 状态管理器（遵循03-contracts.md Phase1契约）

```typescript
interface StateManager {
  initialize(initialState: SystemState, rules: StateTransitionRules): void;
  transitionTo(newState: SystemState): boolean;
  getCurrentState(): SystemState;
  getEditPermissions(): EditPermissions;
  addStateChangeListener(listener: StateChangeListener): () => void;
  removeAllStateChangeListeners(): void;
}

/**
 * 版本快照触发条件增强：添加init标志位区分事件类型
 */
interface StateChangedEventDataEnhanced extends StateChangedEventData {
  /**
   * 是否为初始化事件
   * 为true时表示系统首次进入ALL_SYNCED状态，需要创建初始版本快照
   */
  isInit?: boolean;
}

/**
 * 增强的状态转换函数，支持区分初始化事件
 */
function enhancedTransitionTo(
  newState: SystemState,
  isInit: boolean = false
): boolean {
  // 使用原子操作保护版本快照创建
  return ensureAtomicUpdate(() => {
    const oldState = currentState;

    // 执行状态转换逻辑
    const success = transitionTo(newState);

    if (success && newState === SystemState.ALL_SYNCED && isInit) {
      // 初始化时进入ALL_SYNCED状态，创建版本快照
      publishEvent('version.create_snapshot', {
        reason: 'system_initialization',
        state: newState,
      });
    }

    return success;
  });
}
```

### 用户编辑处理函数

```typescript
/**
 * 处理用户编辑事件，维持当前状态而不是触发状态转换
 */
handleUserEdit(currentState: SystemState, source: 'blockly' | 'monaco'): void {
  // 根据来源和当前状态决定如何处理编辑操作
  if (currentState === SystemState.BLOCKLY_DIRTY && source === 'blockly') {
    // 维持BLOCKLY_DIRTY状态，不触发状态转换
    // 可以发送编辑事件通知，但不改变系统状态
    publishEvent(StateEventType.USER_EDIT, { source, currentState });
  } else if (currentState === SystemState.MONACO_DIRTY && source === 'monaco') {
    // 维持MONACO_DIRTY状态，不触发状态转换
    publishEvent(StateEventType.USER_EDIT, { source, currentState });
  } else if (currentState === SystemState.SYNC_PROCESSING) {
    // 在同步过程中，记录编辑意图，但推迟处理
    publishEvent(StateEventType.EDIT_PENDING, { source, currentState });
  }
}

/**
 * SYNC_PROCESSING状态下的编辑覆盖策略实现
 */
interface InputData {
  source: 'blockly' | 'monaco';
  data: any;
}

let pendingInput: InputData | null = null;

function handleUserEditWithOverride(newInput: InputData) {
  if (currentState === SystemState.SYNC_PROCESSING) {
    pendingInput = newInput; // 新输入覆盖旧值
    publishEvent(StateEventType.edit_pending, {
      source: newInput.source,
      hasPendingChanges: true
    });
  }
}

// 同步完成后处理待编辑内容
function processPendingInput() {
  if (pendingInput && currentState === SystemState.ALL_SYNCED) {
    const { source, data } = pendingInput;
    handleUserEdit(currentState, source);
    pendingInput = null;
    publishEvent(StateEventType.pending_edit_processed, {
      source
    });
  }
}
```

### 事件系统集成 - 遵循模块化说明方案.md的事件驱动规范

状态管理模块通过事件总线与核心事件中心模块进行集成，实现松耦合的事件中心模块间通信。所有状态变化和操作都会通过标准化事件进行通知，支持多个监听器并行处理。

````typescript
// 所有事件名严格遵循小写字母+点分隔命名规范，符合[03-contracts.md]和[模块化说明方案.md]的事件契约
const StateEventType = {
  // 状态变更事件
  state_changed: 'state.changed',
  sync_started: 'sync.started',
  sync_completed: 'sync.completed',
  sync_failed: 'sync.failed',
  timeout: 'timeout',

  // 错误相关事件
  state_recovered: 'state.recovered',

  // 编辑权相关事件
  user_edit: 'user.edit',
  edit_pending: 'edit.pending',
  atomic_operation_failed: 'atomic.operation.failed',
  virtual_dom_batch_completed: 'virtual.dom.batch.completed',
  virtual_dom_update_failed: 'virtual.dom.update.failed',
  pending_edit_processed: 'pending.edit.processed'
} as const;

// 重要规范：所有事件名必须使用小写字母和点分隔命名空间，严格遵循[03-contracts.md]和[模块化说明方案.md]要求
export type StateEventType = typeof StateEventType[keyof typeof StateEventType];

// 注意：所有事件名必须使用小写字母和点分隔命名空间，遵循模块化说明方案.md要求

/**
 * 明确事件订阅边界
 */
eventCenter.on('blockly.changed', (blocks) => {
  if (stateManager.canAcceptEdit('blockly')) {
    stateManager.processEdit('blockly', blocks)
  }
})

/**
 * 添加状态变更回调验证
 */
function onStateChanged(newState) {
  console.assert(
    Object.values(SystemState).includes(newState),
    '非法状态变更：${newState}'
  )
}

/**
 * STATE_RECOVERED事件触发场景
 */
const STATE_RECOVERED_TRIGGERS = [
  'SYNC_PROCESSING状态下的同步失败自动恢复',
  '数据转换错误重试失败后的回退操作',
  '系统故障后的版本回滚成功',
  '同步超时后的安全状态回退',
  '状态机错误后的强制重置'
];

/**
 * 事件发布函数 - 与事件中心模块的集成接口
 */
function publishEvent(eventType: StateEventType, payload: any): void {
  // 通过全局事件总线发布事件到事件中心模块
  if (window.EventBus) {
    window.EventBus.publish(eventType, payload);
  }
}

interface StateChangedEventData {
  newState: SystemState;
  oldState: SystemState;
  reason?: string;
}

interface SyncFailedEventData {
  error: Error;
  recoveryState: SystemState;
}

interface StateRecoveredEventData {
  newState: SystemState;
  previousState: SystemState;
  recoveryAction: string;
}


## 实现指南
### 浏览器环境原子操作实现
在浏览器环境中，由于事件循环和异步操作的存在，实现真正的原子操作需要特别注意时序保障。以下是确保状态更新原子性的关键策略和实现代码：

// 虚拟DOM更新批处理优化
function batchVirtualDOMUpdates(updateFn: () => void) {
  requestAnimationFrame(() => {
    updateFn(); // 批处理DOM更新
    publishEvent('dom.updated')
  });
}

```typescript
/**
 * 原子操作遵循02b-state-machine-specification.md规范：
 * 1. 使用microtask保证状态更新原子性
 * 2. DOM操作在requestAnimationFrame执行
 * 3. 错误时自动触发状态恢复
 */
/**
 * 结合microtask和requestAnimationFrame确保状态更新的原子性和DOM操作的时序性
 * @param updateFn 要执行的更新函数
 */
function ensureAtomicUpdate(updateFn: () => void): void {
  try {
    // 1. 使用microtask确保状态更新的原子性
    Promise.resolve().then(() => {
      try {
        updateFn();

        // 2. DOM操作在requestAnimationFrame中执行
        requestAnimationFrame(() => {
          publishEvent(StateEventType.sync_completed, {
            operation: 'atomicUpdate',
            timestamp: Date.now()
          });
        });
      } catch (error) {
        publishEvent(StateEventType.atomic_operation_failed, {
          error,
          attemptedUpdate: updateFn
        });
        // 自动恢复到安全状态
        recoverToSafeState();
      }
    });
  } catch (error) {
    // 降级策略：使用 requestIdleCallback 或 setTimeout
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => {
        try {
          updateFn();
        } catch (innerError) {
          console.error('Atomic update fallback failed:', innerError);
          recoverToSafeState();
        }
      }, { timeout: 1000 });
    } else {
      // 最终降级：使用setTimeout
      setTimeout(() => {
        try {
          updateFn();
        } catch (innerError) {
          console.error('Atomic update final fallback failed:', innerError);
          recoverToSafeState();
        }
      }, 0);
    }
  }
  finally {
    // 兼容性说明
    console.warn('优先使用microtask+RAF，降级方案支持IE11+');
  }
}

/**
 * 虚拟DOM更新批处理优化
 * 减少不必要的重渲染，提高性能
 */
function batchVirtualDOMUpdates(updateBatch: () => void): void {
  // 使用RAF批处理多个虚拟DOM更新请求
  requestAnimationFrame(() => {
    try {
      updateBatch();
      // 触发批处理完成事件
      publishEvent(StateEventType.virtual_dom_batch_completed, {
        timestamp: Date.now()
      });
    } catch (error) {
      publishEvent(StateEventType.virtual_dom_update_failed, {
        error
      });
    }
  });
}

/**
 * 浏览器事件循环协调器
 */
const BrowserEventLoop = {
  /**
   * 确保状态转换操作在正确的时机执行
   */
  scheduleStateTransition(transitionFn: () => void): void {
    // 检查当前是否有正在进行的状态转换
    if (this.isTransitionInProgress()) {
      // 推迟到当前转换完成后执行
      this.queueForNextTick(transitionFn);
    } else {
      // 立即执行转换
      this.markTransitionInProgress();
      ensureAtomicUpdate(() => {
        try {
          transitionFn();
        } finally {
          this.markTransitionComplete();
          this.processNextQueueItem();
        }
      });
    }
  },
  // 内部实现...
  isTransitionInProgress(): boolean { /* 实现 */ return false; },
  markTransitionInProgress(): void { /* 实现 */ },
  markTransitionComplete(): void { /* 实现 */ },
  queueForNextTick(fn: () => void): void { /* 实现 */ },
  processNextQueueItem(): void { /* 实现 */ }
};
````

1. **单线程模型利用**：JavaScript的单线程特性确保了在事件处理过程中不会被其他JavaScript代码中断，可以利用这一特性构建伪原子操作
2. **队列机制**：所有状态更新请求应进入队列，按顺序处理，避免竞态条件
3. **锁机制**：在进行关键状态转换时设置锁标志，防止并发修改
4. **事务性更新**：将状态变更和副作用（如DOM更新）封装在事务中，要么全部成功，要么全部失败
5. **错误处理**：在原子操作失败时提供回滚机制，确保系统状态不会陷入不一致

### 错误恢复机制

实现分层错误恢复策略，根据错误类型采取不同的恢复措施。本模块的错误处理严格遵循《01-core-principles.md》错误恢复原则，特别是分层恢复策略（用户错误→转换错误→系统错误）。具体恢复策略如下：

````typescript
/**
 * 错误分类类型
 */
enum ErrorClassification {
  CRITICAL = 'critical', // 致命错误，需要重置整个系统
  RECOVERABLE = 'recoverable', // 可恢复错误，可回到上一个稳定状态
  WARNING = 'warning', // 警告级错误，记录但不中断主流程
  VALIDATION = 'validation' // 数据验证错误，可修复后继续
}

/**
 * 标准化错误分类表（包含具体恢复策略）
 */
const STANDARDIZED_ERROR_HANDLING = {
  /**
   * 用户输入错误：UI提示 + 保持编辑状态
   */
  USER_INPUT_ERROR: {
    classification: ErrorClassification.VALIDATION,
    recoveryStrategy: 'UI提示 + 保持编辑状态',
    maxRetries: 0,
    feedbackLevel: 'user'
  },

  /**
   * 数据转换错误：自动重试3次 → 失败后回退到DIRTY状态
   */
  DATA_TRANSFORM_ERROR: {
    classification: ErrorClassification.RECOVERABLE,
    recoveryStrategy: '自动重试3次 → 失败回退',
    maxRetries: 3,
    feedbackLevel: 'system'
  },

  /**
   * 系统故障错误：自动保护机制 → 尝试版本回退
   */
  SYSTEM_FAILURE_ERROR: {
    classification: ErrorClassification.CRITICAL,
    recoveryStrategy: '自动保护机制 → 尝试版本回退',
    maxRetries: 0,
    feedbackLevel: 'admin'
  },

  /**
   * 同步超时：SYNC_PROCESSING状态设置5秒收敛超时
   */
  SYNC_TIMEOUT_ERROR: {
    classification: ErrorClassification.RECOVERABLE,
    recoveryStrategy: '5秒超时 → 回退到脏状态',
    maxRetries: 1,
    feedbackLevel: 'system'
  },

  /**
   * 数据验证错误：标记错误字段 → 保持编辑状态
   */
  DATA_VALIDATION_ERROR: {
    classification: ErrorClassification.VALIDATION,
    recoveryStrategy: '标记错误字段 → 保持编辑状态',
    maxRetries: 0,
    feedbackLevel: 'user'
  },

  /**
   * 未知错误：记录详细日志 → 回到上一个稳定状态
   */
  UNKNOWN_ERROR: {
    classification: ErrorClassification.CRITICAL,
    recoveryStrategy: '记录详细日志 → 回到上一个稳定状态',
    maxRetries: 0,
    feedbackLevel: 'admin'
  }
};

/**
 * 错误处理与恢复策略
 */
const ErrorRecoveryStrategy = {
  /**
   * 根据错误类型执行相应的恢复操作
   */
  recoverFromError(error: Error, classification: ErrorClassification): void {
    switch (classification) {
      case ErrorClassification.CRITICAL:
        this.handleCriticalError(error);
        break;
      case ErrorClassification.RECOVERABLE:
        this.handleRecoverableError(error);
        break;
      case ErrorClassification.WARNING:
        this.handleWarning(error);
        break;
      case ErrorClassification.VALIDATION:
        this.handleValidationError(error);
        break;
    }
  },

  /**
   * 处理致命错误 - 重置整个系统
   */
  handleCriticalError(error: Error): void {
    console.error('Critical error:', error);
    // 保存当前状态快照
    this.saveStateSnapshot();
    // 重置系统到初始状态
    stateManager.setState(SystemState.ALL_SYNCED);
    // 触发恢复事件
    publishEvent(StateEventType.state_recovered, {
      newState: SystemState.ALL_SYNCED,
      previousState: stateManager.getCurrentState(),
      recoveryAction: 'full-reset'
    });
  },

  /**
   * 处理可恢复错误 - 回退到上一个稳定状态
   */
  handleRecoverableError(error: Error): void {
    console.warn('Recoverable error:', error);
    // 回退到上一个稳定状态
    const lastStableState = this.getLastStableState();
    if (lastStableState) {
      stateManager.setState(lastStableState);
      publishEvent(StateEventType.state_recovered, {
        newState: lastStableState,
        previousState: stateManager.getCurrentState(),
        recoveryAction: 'rollback'
      });
    } else {
      // 如果没有上一个稳定状态，重置到同步状态
      this.handleCriticalError(error);
    }
  },

  // 其他处理方法...
  handleWarning(error: Error): void { /* 实现 */ },
  handleValidationError(error: Error): void { /* 实现 */ },
  saveStateSnapshot(): void { /* 实现 */ },
  getLastStableState(): SystemState | null { /* 实现 */ return null; }
};

/**
 * 安全状态恢复函数
 * 明确区分系统错误和数据错误的恢复路径
 */
function recoverToSafeState(errorType?: ErrorType): void {
  // 获取当前状态
  const currentState = stateManager.getCurrentState();

  // 根据错误类型决定恢复策略
  if (errorType === ErrorType.SYSTEM_FAILURE) {
    // 系统级错误：回退到LastStableState(ALL_SYNCED)
    const lastStableState = stableStateManager.getLastStableState() || SystemState.ALL_SYNCED;
    stateManager.setState(lastStableState);
    publishEvent(StateEventType.state_recovered, {
      newState: lastStableState,
      previousState: currentState,
      recoveryAction: 'system-failure-rollback'
    });
  } else if (currentState === SystemState.SYNC_PROCESSING) {
    // 数据转换错误或同步过程中出错：回退到lastDirtyState
    const lastDirtyState = stableStateManager.getLastDirtyState();
    if (lastDirtyState) {
      stateManager.setState(lastDirtyState);
      publishEvent(StateEventType.state_recovered, {
        newState: lastDirtyState,
        previousState: currentState,
        recoveryAction: 'sync-failure-rollback'
      });
    } else {
      // 如果没有最后脏状态，恢复到同步状态
      stateManager.setState(SystemState.ALL_SYNCED);
      publishEvent(StateEventType.state_recovered, {
        newState: SystemState.ALL_SYNCED,
        previousState: currentState,
        recoveryAction: 'safe-default'
      });
    }
  }
}```

### 时序控制实现
```typescript
// 防抖/节流参数常量定义 - 遵循03-contracts.md契约值
const DEBOUNCE_DELAY = 300; // 契约固定值：300ms静止期后触发状态转换，此值为不可修改的核心契约固定值
const THROTTLE_INTERVAL = 100; // 契约固定值：持续编辑时每100ms提供一次实时反馈，此值为不可修改的核心契约固定值
const SYNC_TIMEOUT = 5000; // 同步超时时间

// 时序控制策略
const timingControl = {
  /**
   * 防抖函数 - 用于状态转换
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number = DEBOUNCE_DELAY
  ): (...args: Parameters<T>) => void {
    let timeoutId: number | null = null;
    return (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        func(...args);
      }, delay);
    };
  },

  /**
   * 节流函数 - 用于实时反馈
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    interval: number = THROTTLE_INTERVAL
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= interval) {
        lastCall = now;
        func(...args);
      }
    };
  }
};



**契约基准值**：防抖300ms/节流100ms (03-contracts.md Phase4)

- **防抖300ms**：决定状态转换，用户停止编辑300ms后触发状态转换，避免频繁状态切换导致的性能问题
- **节流100ms**：仅提供反馈，持续编辑时每100ms提供一次实时反馈，确保系统能够及时响应用户操作而不过度消耗资源
- **待处理值单一覆盖策略**：新的用户输入会覆盖等待处理的旧输入，不会累积多个待处理操作，确保系统总是处理最新的用户意图
- **SYNC_PROCESSING状态的新输入使用单一覆盖策略**：在同步过程中，用户继续编辑会触发新的编辑状态，但这些操作会被合理排队处理，优先完成当前正在进行的同步任务，然后基于最新的编辑状态重新开始同步流程

### 错误处理与恢复

以下是系统的错误处理策略矩阵表，清晰展示了不同错误类型的处理流程：

| 错误类型 | 触发事件 | 目标状态 | 错误码 | 恢复策略 |
|----------|----------|----------|--------|----------|
| 数据转换失败 | sync.failed | 原DIRTY状态 | 1002 | 自动重试+回退 |
| 同步超时 | timeout | 最后稳定状态 | 1004 | 终止同步+回退 |
| 用户输入错误 | validation.error | 当前编辑状态 | 1001 | 实时提示+继续编辑 |
| 系统级故障 | system.failure | 最近可用的ALL_SYNCED状态 | 1003 | 版本回退+重新初始化 |

### 数据保护优先级

系统采用分层的数据保护策略，确保用户数据的安全：

| 优先级 | 数据类型 | 保护策略 |
|--------|----------|----------|
| 最高 | 用户正在编辑的内容 | 始终保留，即使在错误情况下 |
| 中等 | 历史数据 | 通过版本快照机制保护 |
| 最低 | 系统状态 | 可重置以恢复系统正常运行 |

## 版本安全机制

## 版本管理三原则
1. 快照创建：仅在ALL_SYNCED状态（含初始化）自动创建版本快照，严格遵循06-json-example.md的快照创建规则
2. 回滚目标：必到ALL_SYNCED状态
3. 历史限制：默认10版本（可通过配置修改）

## 版本安全机制

### 版本快照触发机制
- **快照创建边界条件**：仅当系统从非ALL_SYNCED状态（BLOCKLY_DIRTY/MONACO_DIRTY）成功转换到ALL_SYNCED状态时自动创建
  - ✅ **同步完成创建**：严格遵循[05-implementation-plan.md]要求，仅在成功到达ALL_SYNCED状态时创建
  - ✅ **初始化创建**：系统初始化首次进入ALL_SYNCED状态时自动创建初始版本快照
  - ❌ **严格约束**：禁止在非ALL_SYNCED状态创建任何自动快照

- **历史版本管理**：支持最多10个历史版本的回滚，新快照会自动替换最旧的快照
- **快照内容**：完整记录三层数据状态，包括Blockly结构、JSON权威源和Monaco代码
- **回滚触发**：从任意状态都可以触发版本回滚，回滚后必定进入`ALL_SYNCED`状态

### 版本回滚特性
- **编辑器锁定**：回滚操作执行期间锁定所有编辑器，防止用户在回滚过程中进行编辑
- **状态确保**：回滚完成后必定进入`ALL_SYNCED`状态，确保系统恢复到稳定一致的状态

**注意**：
- 快照创建策略严格遵循IMPL-Json-ReferenceImplementation.md的快照创建规则，确保版本管理的一致性。
- 严格遵循IMPL-Plan-PhasedApproach.md的要求：版本快照仅在到达ALL_SYNCED状态时自动创建，确保系统稳定性。

## 与核心原则的对应关系
1. **数据一致性至上原则**：通过状态机设计将物理不一致转化为受控的逻辑一致状态
2. **用户操作优先原则**：用户编辑操作具有最高优先级，响应时间<50ms
3. **单一编辑权原则**：在稳定状态下只允许一个UI层接受用户编辑
4. **状态透明原则**：所有状态都有清晰的视觉反馈和操作指引
5. **错误恢复原则**：提供分层自动恢复机制和手动恢复路径

## 测试策略
1. **单元测试**：测试各个状态的转换逻辑和边界条件
2. **集成测试**：测试状态管理与其他模块的交互
3. **性能测试**：确保状态转换和事件处理满足性能要求
4. **模拟测试**：模拟各种错误场景和恢复过程
5. **用户体验测试**：确保状态变化对用户操作的影响符合预期
````
