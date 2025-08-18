---
filename: ARCH-System-StateModel.md
title: 系统逻辑设计 - 三层双流状态模型
description: 三层双流状态模型的系统架构和状态控制机制设计
---
# 系统逻辑设计 - 三层双流状态模型

> **文档定位**：本文档专注于系统逻辑设计和状态控制机制，不涉及具体数据类型实现。
>
> 📋 **相关文档**：
> - 设计约束 → [ARCH-Principles-CoreDesign.md](./ARCH-Principles-CoreDesign.md) 
> - 接口规范 → [SPEC-Contracts-Interfaces.md](./SPEC-Contracts-Interfaces.md)
> - 具体实现 → [IMPL-Json-ReferenceImplementation.md](./IMPL-Json-ReferenceImplementation.md)

## 💡 系统设计哲学

### 核心理念：物理不一致 → 逻辑一致
```
系统本质：将不可避免的物理不一致转化为受控的逻辑一致状态

物理现实：三层数据在内存中必然存在瞬时不同步
逻辑控制：通过状态机确保系统在任何时刻都处于可控状态
用户体验：状态透明，操作流畅，数据安全
```

### 通用架构模式（数据类型无关）
```
Blockly编辑器(UI层) ↔ JSON结构(权威层) ↔ Monaco编辑器(UI层)
```

**架构特点**：
- **数据类型无关**：适用于JSON、Expression、TypeScript等任意数据类型
- **中间结构层（JSON结构）是系统的逻辑权威源**：单一数据源，避免冲突
- **三层分离**：职责清晰，便于测试和维护
- **双向流动**：支持任意方向的编辑和同步

## 🔄 四状态模型（含临时状态） - 精确控制规则

### 状态定义（通用模式）
| 状态 | 数据关系 | 编辑权限 | 高亮功能 | 界面状态 |
|------|----------|----------|----------|----------|
| **ALL_SYNCED** | 三层数据一致 | 双向可编辑 | ✅ 启用 | 🟢 同步完成 |
| **BLOCKLY_DIRTY** | blockly≠json ≡ monaco | 仅Blockly可编辑 | ❌ 禁用 | 🟡 Blockly编辑中 |
| **MONACO_DIRTY** | blockly≡json ≠ monaco | 仅Monaco可编辑 | ❌ 禁用 | 🟡 Monaco编辑中 |
| **SYNC_PROCESSING** | 同步转换中 | 原编辑侧可继续编辑 | ❌ 禁用 | 🔵 同步中 |

### 状态转换规则
```typescript
// 通用状态转换模式（不依赖具体数据类型）
interface StateTransitionEngine {
  // 用户编辑触发
  onUserEditLeft(): 'ALL_SYNCED' → 'BLOCKLY_DIRTY'
  onUserEditRight(): 'ALL_SYNCED' → 'MONACO_DIRTY'
  
  // 触发同步流程
  onSyncTriggered(): 'BLOCKLY_DIRTY' → 'SYNC_PROCESSING' | 'MONACO_DIRTY' → 'SYNC_PROCESSING'
  
  // 状态转换规则
  onSyncSuccess(): 'SYNC_PROCESSING' → 'ALL_SYNCED'
  
  // 版本回退（从任意状态）
  onVersionRollback(): 'ANY_STATE' → 'ALL_SYNCED'
  
  // 注意：同步失败回退现在通过错误事件系统处理
  // 不再作为直接的状态转换路径
  // SYNC_PROCESSING→BLOCKLY_DIRTY/MONACO_DIRTY的转换必须通过错误事件触发
  // 详见状态机规范文档 ./02b-state-machine-specification.md
}
```

### 状态转换图（修正版）
```
    用户编辑Blockly          用户编辑Monaco
           ↓                      ↓
    [BLOCKLY_DIRTY] ←────── [ALL_SYNCED] ──────→ [MONACO_DIRTY]
           ↓                      ↑                     ↓
    触发同步流程               同步完成              触发同步流程
           ↓                      ↑                     ↓
    [SYNC_PROCESSING] ────────────────────────────→ [SYNC_PROCESSING]
           ↓                                          ↓
      同步成功                                      同步成功
           ↓                                          ↓
           └───────────────────────────────────────────┘
                           ↓
                        [ALL_SYNCED]
                         ↑
                         │
                         │
                    版本回退

    // 错误触发路径（虚线表示）
    [SYNC_PROCESSING] - - - → [BLOCKLY_DIRTY] // 数据错误事件触发
    [SYNC_PROCESSING] - - - → [MONACO_DIRTY]  // 数据错误事件触发
    [SYNC_PROCESSING] - - - → [ALL_SYNCED]    // 系统错误事件触发

    // 重要规则：SYNC_PROCESSING→BLOCKLY_DIRTY/MONACO_DIRTY转换必须通过错误事件触发
    // 不允许直接在状态转换图中定义这些路径，详见02b-state-machine-specification.md
```

### 核心约束（设计不变式）
```typescript
// 这些约束适用于任何数据类型的双向编辑系统
interface SystemInvariants {
  // 数据一致性约束
  dataConsistency: '非SYNC_PROCESSING状态时，至少一侧数据与中间结构一致'
  
  // 编辑权限约束  
  editingRights: '同时只允许一侧编辑（ALL_SYNCED除外）'
  
  // 用户优先约束
  userPriority: '用户操作响应 < 50ms，系统功能异步退避'
  
  // 状态透明约束
  stateTransparency: '所有状态变化必须在界面上清晰反映'
  
  // 错误恢复约束
  errorRecovery: '任何错误都有明确的恢复路径和用户指导'
}
```

## ⚡ 防抖节流机制

### 双重控制策略
```typescript
// 通用的时序控制模式（不依赖具体数据类型）
interface TimingController {
  // 防抖：主要策略，决定状态转换
  debounce: {
    delay: 300,           // 300ms静止期后触发
    canTriggerTransition: true,  // 可以触发状态转换
    purpose: '决定何时开始同步过程'
  }
  
  // 节流：安全机制，提供实时反馈
  throttle: {
    interval: 100,        // 每100ms强制检查一次
    canTriggerTransition: false, // 不能触发状态转换
    purpose: '保证连续编辑时的实时反馈'
  }
}
```

### SYNC_PROCESSING编辑处理

#### 单一覆盖策略
- 新输入覆盖旧值（单一覆盖策略）：在同步过程中，用户继续编辑会触发新的编辑状态，但这些操作会被合理排队处理
- 同步完成后处理待编辑内容：优先完成当前正在进行的同步任务，然后基于最新的编辑状态重新开始同步流程

### SYNC_PROCESSING状态下的编辑替换机制
```typescript
// 通用的编辑替换策略
interface EditingReplacementStrategy {
  // 用户在SYNC_PROCESSING状态继续编辑时的处理
  onContinuousEditing: {
    immediateResponse: '编辑立即响应，无任何延迟',
    debounceValidation: '300ms后验证，成功则替换待处理值',
    throttleValidation: '100ms间隔提供实时反馈',
    noInterruption: '不中断当前同步过程'
  }
  
  // 替换机制的核心逻辑
  replacementLogic: {
    singlePendingValue: '只维护一个待处理值，新编辑覆盖旧值',
    syncCompletion: '当前同步完成后，处理最新的待处理内容',
    validationFirst: '只有验证通过的内容才能成为待处理值'
  }
}
```

## 🔐 数据完整性保障

### 错误恢复优先级
与README.md的"错误恢复原则"保持完全一致：
- **数据保护优先级**：用户正在编辑的内容 > 历史数据 > 系统状态

### 错误回退路径
#### STATE_RECOVERED事件触发条件
与README.md错误处理章节完全对应，触发场景包括：
1. 数据转换错误重试失败
2. 同步超时保护触发
3. 版本回滚完成
4. 状态机重置成功
5. 用户输入错误自动修正

### 版本管理系统（通用模式）
```typescript
interface VersionManagement {
  // 版本创建规则
  versionCreation: {
    trigger: '仅在到达ALL_SYNCED状态时自动创建',
    content: '完整的三层数据快照',
    metadata: '时间戳、操作描述、数据摘要'
  }
  
  // 版本回退机制
  versionRollback: {
    atomicOperation: '原子性操作，无中间状态',
    universalRecovery: '从任意状态都可以直接回退',
    lockingStrategy: '回退时锁定所有编辑器',
    stateGuarantee: '回退后必定进入ALL_SYNCED状态'
  }
  
  // 原子操作时序保障
  atomicOperationGuarantees: {
    browserEventLoop: '利用microtask确保状态更新的原子性',
    domBatchProcessing: '在requestAnimationFrame中执行DOM操作',
    fallbackStrategies: '多层降级机制应对浏览器兼容性问题',
    errorIsolation: '单个操作失败不影响整体系统稳定性'
  }
}
```

### 原子操作实现（与状态管理模块保持一致）
```typescript
/**
 * 确保浏览器环境下的原子更新
 * 优先使用microtask确保状态更新的原子性，DOM操作在requestAnimationFrame中执行
 */
function ensureAtomicUpdate(updateFn: () => void): void {
  try {
    // 1. 使用microtask确保状态更新的原子性
    Promise.resolve().then(() => {
      try {
        updateFn();
        
        // 2. DOM操作在requestAnimationFrame中执行
        requestAnimationFrame(() => {
          publishEvent('dom.updated', {
            timestamp: Date.now()
          });
        });
      } catch (error) {
        publishEvent('atomic.operation.failed', {
          error,
          attemptedUpdate: updateFn
        });
        // 自动恢复到安全状态
        recoverToSafeState();
      }
    });
  } catch (error) {
    // 降级策略：使用 requestIdleCallback 或 setTimeout
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
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
}
```

### 错误处理分层策略
```typescript
interface ErrorHandlingLayers {
  // 第一层：用户输入错误（最常见）
  userInputErrors: {
    examples: ['语法错误', '格式不符', '类型不匹配'],
    handling: '实时UI提示，不阻断编辑，不触发状态转换',
    recovery: '用户修正输入即可'
  }
  
  // 第二层：同步转换错误（中等频率）
  syncErrors: {
    examples: ['数据转换失败', '验证失败', '结构冲突'],
    handling: '回退到DIRTY状态，保护用户编辑内容',
    recovery: '显示具体错误信息，引导用户修正'
  }
  
  // 第三层：系统级故障（罕见但严重）  
  systemErrors: {
    examples: ['编辑器崩溃', '内存不足', '网络异常'],
    handling: '版本回退，系统重新初始化',
    recovery: '恢复到最近可用版本，确保数据不丢失'
  }
}
```

## 🎨 用户界面设计模式

### 状态可视化标准
```typescript
// 通用的状态显示模式
interface StateVisualizationPattern {
  statusBar: {
    ALL_SYNCED: '📋 已同步 | 🔗 高亮可用 | 📚 版本: v1.2.3',
    BLOCKLY_DIRTY: '🟡 左侧编辑中 | ❌ 高亮禁用 | ⏳ 待同步',
    MONACO_DIRTY: '🟡 右侧编辑中 | ❌ 高亮禁用 | ⏳ 待同步',
    SYNC_PROCESSING: '🔄 同步中 47% | ❌ 高亮禁用 | ⏱️ 预计3秒'
  },
  
  editorBorders: {
    editable: '蓝色边框 + 光标闪烁',
    disabled: '灰色边框 + 半透明遮罩',
    syncing: '动画进度条覆盖'
  }
}
```

### 日志系统设计模式
```typescript
// 通用的日志面板设计
interface LoggingSystemPattern {
  panelStates: {
    collapsed: '📋 日志 (12) | 🔴 1错误 | ⚠️ 3警告 | [展开 ▲]',
    expanded: '可调节高度，显示详细日志条目'
  },
  
  logEntryFormat: {
    timestamp: '14:32:15.123',
    level: '🟢/🟡/🔴/🔵 [类型]',
    message: '状态转换、用户操作、系统事件的详细描述'
  },
  
  filteringControls: {
    byLevel: '[📋 全部] [🔴 错误] [⚠️ 警告] [ℹ️ 信息]',
    bySearch: '[🔍 搜索框]',
    byActions: '[⚙️ 设置] [📤 导出] [🗑️ 清空]'
  }
}
```

## � 测试验证模式

### 状态转换测试
```typescript
// 通用的状态转换测试模式
interface StateTransitionTesting {
  // 每个状态转换都必须有对应测试
  basicTransitions: {
    'ALL_SYNCED → BLOCKLY_DIRTY': '验证用户编辑左侧触发',
    'ALL_SYNCED → MONACO_DIRTY': '验证用户编辑右侧触发',
    'BLOCKLY_DIRTY → SYNC_PROCESSING': '验证防抖触发同步',
    'MONACO_DIRTY → SYNC_PROCESSING': '验证防抖触发同步',
    'SYNC_PROCESSING → ALL_SYNCED': '验证同步成功完成',
    // 注意：以下转换通过错误事件系统触发，不是直接的状态转换路径
    // 'SYNC_PROCESSING → BLOCKLY_DIRTY': '通过错误事件触发的同步失败回退',
    // 'SYNC_PROCESSING → MONACO_DIRTY': '通过错误事件触发的同步失败回退'
  },
  
  // 边界情况测试
  edgeCases: {
    rapidEditing: '快速连续编辑的状态控制',
    syncInterruption: 'SYNC_PROCESSING状态下的用户继续编辑',
    errorRecovery: '各种错误情况的恢复路径',
    versionRollback: '从各状态的版本回退'
  }
}
```

### 数据一致性验证
```typescript
// 通用的数据一致性测试
interface DataConsistencyTesting {
  // 五层数据一致性验证
  layerConsistency: {
    staticStates: '非SYNC_PROCESSING状态的数据一致性',
    flowingStates: 'SYNC_PROCESSING状态的收敛性验证',
    versionIntegrity: '版本快照的完整性检查'
  },
  
  // 约束条件验证
  invariantTesting: {
    singleEditingRight: '同时只有一侧可编辑',
    userResponseTime: '用户操作响应时间 < 50ms',
    stateTransparency: '所有状态变化的界面反映'
  }
}
```

## 📚 设计模式总结

### 核心设计模式
```typescript
// 这套设计模式适用于任何双向编辑系统
interface UniversalBidirectionalEditingPattern {
  // 1. 五层架构模式
  layeredArchitecture: '编辑器 ↔ 结构 ↔ 权威源 ↔ 序列化 ↔ 编辑器',
  
  // 2. 四状态控制模式  
  stateControlPattern: 'ALL_SYNCED, BLOCKLY_DIRTY, MONACO_DIRTY, SYNC_PROCESSING',
  
  // 3. 防抖节流时序模式
  timingControlPattern: '防抖决策 + 节流反馈 + 编辑替换',
  
  // 4. 分层错误处理模式
  errorHandlingPattern: '用户输入错误 → 同步转换错误 → 系统级故障',
  
  // 5. 版本管理模式
  versionManagementPattern: '自动快照 + 原子回退 + 完整恢复'
}
```

### 适用场景
```typescript
// 这套模式可以应用于各种双向编辑场景
interface ApplicableScenarios {
  dataTypes: ['JSON', 'YAML', 'XML', 'CSS', 'SQL', 'Regular Expression'],
  editingModes: ['Visual ↔ Code', 'WYSIWYG ↔ Markdown', 'Form ↔ Config'],
  applications: ['配置文件编辑器', '数据结构设计器', '查询构建器', '样式设计器']
}
```

---

> **核心价值**：本文档定义了一套通用的双向编辑系统设计模式，不依赖具体的数据类型或编辑器实现。这套模式经过完整的理论验证和实践设计，可以应用于任何需要双向编辑能力的系统。

---

**相关文档导航**：
- 📋 [查看具体实现方案](./06-json-example.md) - JSON数据类型的完整实现示例
- 🏗️ [查看实施策略](./05-implementation-plan.md) - 分阶段实施计划和风险控制
- 🧪 [查看测试架构](./04-testing-architecture.md) - 完整的测试策略和工具
