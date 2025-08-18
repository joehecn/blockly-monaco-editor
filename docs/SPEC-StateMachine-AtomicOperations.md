---
filename: SPEC-StateMachine-AtomicOperations.md
title: 有限状态机规范
description: 浏览器环境下状态机原子操作的实现指南和规范
---
# 状态机规范 - 原子操作实现

> **相关文档**：本规范实现依赖[系统逻辑设计](./02-system-architecture.md)定义的状态模型

## 浏览器环境原子操作实现指南

在浏览器环境中实现状态机的原子操作需要特别关注JavaScript单线程特性、事件循环机制以及DOM更新时机。以下是针对浏览器环境的具体实现指南：

### 1. 事件循环与异步操作协调
```typescript
class BrowserEventLoop协调器 {
  private microTaskQueue: (() => void)[] = [];
  private macroTaskQueue: (() => void)[] = [];

  // 使用microtask确保状态更新的原子性
  scheduleMicroTask(task: () => void): void {
    this.microTaskQueue.push(task);
    if (this.microTaskQueue.length === 1) {
      Promise.resolve().then(() => this.flushMicroTasks());
    }
  }

  // 使用macrotask处理可能阻塞的操作
  scheduleMacroTask(task: () => void): void {
    this.macroTaskQueue.push(task);
    if (this.macroTaskQueue.length === 1) {
      setTimeout(() => this.flushMacroTasks(), 0);
    }
  }

  private flushMicroTasks(): void {
    while (this.microTaskQueue.length > 0) {
      const task = this.microTaskQueue.shift();
      if (task) task();
    }
  }

  private flushMacroTasks(): void {
    while (this.macroTaskQueue.length > 0) {
      const task = this.macroTaskQueue.shift();
      if (task) task();
    }
  }
}
```

### 2. DOM更新与状态同步
```typescript
class DOMStateSynchronizer {
  private pendingDOMUpdates: (() => void)[] = [];
  private isBatching: boolean = false;

  // 批处理DOM更新以提高性能
  batchDOMUpdate(update: () => void): void {
    this.pendingDOMUpdates.push(update);
    if (!this.isBatching) {
      this.isBatching = true;
      // 使用requestAnimationFrame确保DOM更新在渲染前执行
      requestAnimationFrame(() => this.flushDOMUpdates());
    }
  }

  private flushDOMUpdates(): void {
    this.pendingDOMUpdates.forEach(update => update());
    this.pendingDOMUpdates = [];
    this.isBatching = false;
  }
}

// 时序保障的另一种实现方式
// 在某些复杂场景下，我们可能需要更精确地控制状态更新和DOM操作的时序
function ensureProperUpdateOrder() {
  // 建议补充的时序保障
  requestAnimationFrame(() => {
    performStateUpdate(); // 状态更新
    setTimeout(() => {
      updateDOM(); // DOM操作
    }, 0);
  });
}

/**
 * 确保更新顺序的完整实现
 * 严格遵循微任务→动画帧→宏任务的执行顺序
 */
function ensureUpdateOrder() {
  // 1. 在microtask中执行状态更新
  Promise.resolve().then(() => {
    performStateUpdate();
    
    // 2. 在requestAnimationFrame中执行视觉更新准备
    requestAnimationFrame(() => {
      prepareVisualUpdate();
      
      // 3. 在setTimeout宏任务中执行DOM操作
      setTimeout(() => {
        updateDOM();
        // 通知更新完成
        if (window.EventBus) {
          window.EventBus.publish('update.completed', {
            timestamp: Date.now(),
            stages: ['state', 'visual', 'dom']
          });
        }
      }, 0);
    });
  });
}
```

### 3. 浏览器环境下的原子操作实现
```typescript
class BrowserAtomicOperationManager implements AtomicOperationManager {
  private eventLoop协调器 = new BrowserEventLoop协调器();
  private domSynchronizer = new DOMStateSynchronizer();

  async performAtomicRestore(operations: RestoreOperation[]): Promise<AtomicOperationResult> {
    try {
      // 1. 在microtask中执行状态恢复的核心逻辑
      let result: AtomicOperationResult;
      await new Promise<void>(resolve => {
        this.eventLoop协调器.scheduleMicroTask(() => {
          // 执行原子操作
          result = this.executeRestoreOperations(operations);
          resolve();
        });
      });

      // 2. 在requestAnimationFrame中更新DOM
      await new Promise<void>(resolve => {
        this.domSynchronizer.batchDOMUpdate(() => {
          this.updateDOMAfterRestore(result);
          resolve();
        });
      });

      return result!;
    } catch (error) {
      // 3. 错误处理
      return this.handleRestoreError(error, operations);
    }
  }

  // 其他方法实现...
}
```

### 4. 浏览器特定的性能优化
```typescript
// 使用requestIdleCallback处理非关键任务
function scheduleNonCriticalTask(task: () => void): void {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(task, { timeout: 1000 });
  } else {
    // 降级方案
    setTimeout(task, 0);
  }
}

/**
 * 浏览器环境下的原子操作最佳实践
 * 结合microtask和requestAnimationFrame确保状态更新的原子性和DOM操作的时序性
 */
function ensureAtomicUpdate(updateFn: () => void): void {
  try {
    // 1. 使用microtask确保状态更新的原子性
    Promise.resolve().then(() => {
      try {
        updateFn();
        
        // 2. DOM操作在requestAnimationFrame中执行
        requestAnimationFrame(() => {
          // 发布DOM更新完成的信号
          if (window.EventBus) {
            window.EventBus.publish('dom.updated', {
              timestamp: Date.now()
            });
          }
        });
      } catch (error) {
        // 处理更新错误并恢复
        console.error('Atomic update failed:', error);
        if (window.EventBus) {
          window.EventBus.publish('atomic.operation.failed', {
            error,
            attemptedUpdate: updateFn
          });
        }
        // 尝试恢复到安全状态
        recoverToSafeState();
      }
    });
  } catch (error) {
    // 降级处理
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
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

/**
 * 安全状态恢复函数
 * 基于lastStableState机制实现，与README.md错误恢复章节对应
 */

/**
 * LastStableState机制
 * 核心实现逻辑：
 * 1. 每当系统进入ALL_SYNCED状态时，自动保存当前状态为lastStableState
 * 2. 包含完整的三层数据快照(blockly/json/monaco)和元数据
 * 3. 在状态转换前，会先备份当前状态
 * 4. 错误恢复时优先回退到lastStableState，保证数据一致性
 */
let lastStableState: { state: SystemState; data: SystemSnapshot } | null = null;

// 保存稳定状态的函数
function saveStableState(state: SystemState, data: SystemSnapshot): void {
  if (state === 'ALL_SYNCED') {
    lastStableState = { state, data };
  }
}

function recoverToSafeState(): void {
  if (window.stateManager) {
    const currentState = window.stateManager.getCurrentState();
    if (currentState === 'SYNC_PROCESSING') {
      // 同步过程中出错，恢复到最后一个脏状态
      const lastDirtyState = window.stateManager.getLastDirtyState();
      if (lastDirtyState) {
        window.stateManager.setState(lastDirtyState);
        if (window.EventBus) {
          window.EventBus.publish('state.recovered', {
            newState: lastDirtyState,
            previousState: currentState,
            recoveryAction: 'sync-failure-rollback'
          });
        }
      } else {
        // 如果没有最后脏状态，恢复到同步状态
        window.stateManager.setState('ALL_SYNCED');
        if (window.EventBus) {
          window.EventBus.publish('state.recovered', {
            newState: 'ALL_SYNCED',
            previousState: currentState,
            recoveryAction: 'safe-default'
          });
        }
      }
    }
  }
}

## 四状态模型（含临时状态）核心规范

blockly编辑器(blockly结构) <-> json(json结构) <-> monaco编辑器(code字符串)

## 原则追溯

本状态机规范的设计严格遵循《01-core-principles.md》中定义的核心原则。以下是本规范与核心原则的对应关系：

### 1. 数据一致性至上原则
**对应条款**：核心原则1
**体现**：状态机通过严格的状态定义和转换规则，将物理不一致转化为逻辑一致的状态。ALL_SYNCED状态确保三层数据语义完全一致，而DIRTY状态明确标识了不一致的来源和权威方向。

### 2. 用户操作优先原则
**对应条款**：核心原则2
**体现**：状态机设计中，用户编辑操作具有最高优先级，同步过程在后台静默执行且不会阻塞用户编辑。防抖节流机制（300ms防抖，100ms节流）确保用户输入响应时间控制在50ms以内。

### 3. 单一编辑权原则
**对应条款**：核心原则3
**体现**：状态机通过BLOCKLY_DIRTY和MONACO_DIRTY状态确保在非同步状态下只有一个编辑器可编辑，只有在ALL_SYNCED状态下才允许切换编辑器。

### 4. 状态透明原则
**对应条款**：核心原则4
**体现**：状态机定义了明确的状态可视化要求，所有状态转换都提供视觉反馈，确保用户理解当前系统状态和可用操作。

### 5. 错误恢复原则
**对应条款**：核心原则5
**体现**：状态机设计包含完整的错误处理和恢复机制，同步失败时会回退到安全状态，并提供版本回滚功能作为最后的恢复手段。

## 状态机核心规范

blockly编辑器(blockly结构) <-> json(json结构) <-> monaco编辑器(code字符串)

初始状态 = ALL_SYNCED {
  blockly: 一个object块（无属性），
  json: {},
  monaco: "{}"
}

初始状态说明:
- blockly层：包含一个空的object块，提供用户交互的起点
- json层：空对象{}，作为数据的权威源
- monaco层：字符串"{}"，对应空对象的文本表示
- 三层语义完全一致，表示同一个空JSON对象

约束:
 - 任意时刻，只能有一个编辑器可以编辑
 - 任意时刻，都只能是下面三种情况之一(== 表示逻辑上等价, <> 表示逻辑上不等价)
  1. blockly结构 <> json结构  == code字符串
  2. blockly结构 == json结构  <> code字符串
  3. blockly结构 == json结构  == code字符串 (ALL_SYNCED)
 - 正常情况下: 只有下面两条数据同步转换链条:
   重要说明:
    - 数据同步转换触发的条件: 编辑中的blockly结构或者code字符串可以合法转换为json结构，基于性能可以考虑防抖和节流
    - 同步机制：在用户快速编辑时，序列化同步请求(可以考虑替换覆盖之前的请求，意思是只考虑最后一条)，避免重复冲突
    - 数据同步转换是全局唯一的原子操作，即同一时刻只有唯一的一个，不能中断，要么成功，要么失败
  A: blockly to monaco
    1. blockly结构 == json结构  == code字符串 (ALL_SYNCED)
    2. blockly结构 <> json结构  == code字符串
        当blockly结构可以合法转换为json结构时，触发同步流程转换(原子操作)
    3. 成功: blockly结构 == json结构  == code字符串 (ALL_SYNCED)
       失败: blockly结构可能已经更新(假设用户在继续编辑)，而json结构和code字符串回滚到之前的状态 (相当于没效果)
  B: monaco to blockly
    1. blockly结构 == json结构  == code字符串 (ALL_SYNCED)
    2. blockly结构 == json结构  <> code字符串
        当code字符串可以合法转换为json结构时，触发同步流程转换(原子操作)
    3. 成功: blockly结构 == json结构  == code字符串 (ALL_SYNCED)
       失败: blockly结构和json结构回滚到之前的状态 (相当于没效果)，而code字符串可能已经更新(假设用户在继续编辑)
 - 只有 ALL_SYNCED 状态下，才允许用户切换编辑器
 - 只有 ALL_SYNCED 状态下，会将当前状态快照保存为历史版本记录，默认最多10个版本(可配置)
 - 用户随时可以切换版本
 - 用户编辑为最高响应，同步过程是背后静默的，成功与否都不会影响用户编辑
 - 当由于未知原因导致机制异常且不可恢复时，提示用户手动切换版本为唯一修复方式

要求:
 - 状态透明可见
 - 日志记录详尽
 - 建立完备的转换规则测试套件，覆盖JSON规范所有数据类型和边缘案例，确保双向转换的幂等性

# 状态机核心要素解析

从状态机的角度分析该系统的设计，我们将聚焦状态机的五个核心要素：
状态集 (States)  

事件集 (Events)  

转换规则 (Transitions)  

守卫条件 (Guards)  

动作集 (Actions)  

以下是针对该系统的详细解析：

状态集 (States)

系统定义三个互斥状态，构成有限状态集：
type SystemState = 
"ALL_SYNCED"      // S3: B≡J≡C

"BLOCKLY_DIRTY"   // S1: B≠J ∧ J≡C

"MONACO_DIRTY"    // S2: B≡J ∧ J≠C

**注意**：初始状态下，Blockly层的"一个object块（无属性）"表示一个空对象，与JSON层的{}和Monaco层的"{}"在逻辑上完全等价，因此满足ALL_SYNCED状态的要求。

状态属性：
ALL_SYNCED：权威状态，允许编辑器切换和历史记录

*_DIRTY：中间状态，仅允许对应编辑器编辑

状态持久化：每次进入ALL_SYNCED时创建不可变快照

事件集 (Events)

驱动状态转换的外部事件：
type SystemEvent =
{ type: "EDIT_BLOCKLY", blocks: BlocklyDefinition }  // Blockly编辑事件

{ type: "EDIT_MONACO", code: string }               // Monaco编辑事件

{ type: "SYNC_BLOCKLY_TO_MONACO" }                  // 触发Blockly→Monaco同步

{ type: "SYNC_MONACO_TO_BLOCKLY" }                  // 触发Monaco→Blockly同步

{ type: "LOAD_VERSION", snapshot: SystemSnapshot }  // 加载历史版本

事件特性：
用户编辑事件优先级最高，立即更新对应状态

同步事件由系统触发（满足守卫条件）

版本加载事件强制进入ALL_SYNCED

转换规则 (Transitions)

状态转换函数：δ(state, event) → newState

**重要约束：系统禁止状态自转换路径，用户持续编辑通过handleEdit函数处理。**

stateDiagram-v2
    [*] --> ALL_SYNCED
    
    ALL_SYNCED --> BLOCKLY_DIRTY: EDIT_BLOCKLY
    ALL_SYNCED --> MONACO_DIRTY: EDIT_MONACO
    
    BLOCKLY_DIRTY --> SYNC_PROCESSING: SYNC_BLOCKLY_TO_MONACO
    SYNC_PROCESSING --> ALL_SYNCED: syncSuccess
    SYNC_PROCESSING --> BLOCKLY_DIRTY: syncFailure
    
    MONACO_DIRTY --> SYNC_PROCESSING: SYNC_MONACO_TO_BLOCKLY
    SYNC_PROCESSING --> ALL_SYNCED: syncSuccess
    SYNC_PROCESSING --> MONACO_DIRTY: syncFailure
    
    ANY_STATE --> ALL_SYNCED: LOAD_VERSION
    
    note right of SYNC_PROCESSING
      同步失败时自动回退到
      相应的DIRTY状态
    end note
    
    note left of BLOCKLY_DIRTY
      用户持续编辑通过
      handleUserEdit函数处理
    end note
    
    note left of MONACO_DIRTY
      用户持续编辑通过
      handleUserEdit函数处理
    end note

转换特性：
SYNC_PROCESSING是临时状态（原子操作期间）

失败转换保持原始状态

版本加载是强转换（覆盖当前状态）

## 错误回退路径强制规则

SYNC_PROCESSING状态的回退路径必须严格遵循以下规则：
- 箭头1：SYNC_PROCESSING --系统错误--> ALL_SYNCED
- 箭头2：SYNC_PROCESSING --数据错误--> BLOCKLY_DIRTY
- 箭头3：SYNC_PROCESSING --数据错误--> MONACO_DIRTY

> 禁止在状态转换图中定义其他回退路径

**重要提示：SYNC_PROCESSING→*_DIRTY 转换必须通过错误事件触发，禁止直接定义状态路径。**

**特别强调：在状态转换图中，SYNC_PROCESSING到BLOCKLY_DIRTY/MONACO_DIRTY的转换不应该以直接路径的形式呈现，这些转换必须通过错误事件处理机制来间接触发。系统会确保在同步失败时，通过专门的错误恢复流程将状态回滚到相应的脏状态。**

守卫条件 (Guards)

状态转换的前提约束：
转换事件                  守卫条件

SYNC_BLOCKLY_TO_MONACO G1: state = BLOCKLY_DIRTY ∧ isValidJSON(blocklyToJSON(currentBlocks))
SYNC_MONACO_TO_BLOCKLY G2: state = MONACO_DIRTY ∧ isValidJSON(parseJSON(currentCode))
LOAD_VERSION 无（始终允许）
EDIT_* 无（始终允许）

守卫关键：
同步仅在数据可合法转换时触发

Monaco编辑时自动校验JSON语法（但不触发同步）

动作集 (Actions)

状态转换时执行的操作：

// EDIT_BLOCKLY事件动作
actionUpdateBlockly = (state, event) => {
  return {
    ...state,
    blocks: event.blocks,
    state: "BLOCKLY_DIRTY" // 强制状态转换
  };
// 同步成功动作

actionSyncSuccess = (state, result) => {
  return {
    blocks: result.blocks,
    json: result.json,
    code: result.code,
    state: "ALL_SYNCED",
    history: [...state.history.slice(-9), createSnapshot(result)] // 保留10个版本
  };
// 同步失败动作

actionSyncFailure = (state, error) => {
  return {
    ...state, // 保留当前编辑状态
    lastError: error,
    state: state.preSyncState // 回退到同步前状态
  };

原子操作保障：
function atomicSync(operation) {
  const preState = currentState;
  const generation = ++currentGeneration;
  
  try {
    const result = operation();
    if (generation === currentGeneration) {
      dispatch(actionSyncSuccess(result));
} catch (error) {

    if (generation === currentGeneration) {
      dispatch(actionSyncFailure(error, preState));
}

状态机完整性验证
确定性：

每个(state, event)对都有明确定义的新状态

无歧义转换路径
可达性：

初始状态：ALL_SYNCED

所有状态均可从初始状态到达

BLOCKLY_DIRTY via EDIT_BLOCKLY

MONACO_DIRTY via EDIT_MONACO

SYNC_PROCESSING via 同步事件
安全性：

非法转换被守卫条件阻断

编辑器切换仅在ALL_SYNCED允许

状态回滚机制防止数据损坏
活性：

用户持续编辑不会导致死锁

通过版本加载可强制恢复ALL_SYNCED
原子性保障：

      class SyncProcessor {
     constructor() {
       this.activeGeneration = 0;
async run(operation) {

       const gen = ++this.activeGeneration;
       try {
         const result = await operation();
         if (gen === this.activeGeneration) return result;
catch (error) {

         if (gen === this.activeGeneration) throw error;
}

     
     cancel() {
       this.activeGeneration++; // 使进行中的操作过期
}

   

风险控制机制
状态撕裂防护：

      let stateVersion = 0;
   
   function handleEditMonaco(newCode) {
     stateVersion++;
     dispatch({ type: "EDIT_MONACO", code: newCode, version: stateVersion });
function syncMonacoToBlockly() {

     const captureVersion = stateVersion;
     // ...转换过程
     if (captureVersion !== stateVersion) {
       throw new SyncExpiredError();
}

   
错误边界：

      graph LR
   A[同步错误] --> B{错误类型?}
-->转换失败
 C[回退原始状态]

-->过期同步
 D[静默丢弃]

-->系统异常
 E[进入恢复模式]

--> F[禁用编辑器]

--> G[显示版本选择器]

   
性能保障：

      const syncScheduler = new RateLimitedScheduler({
     maxInterval: 500,    // 最大延迟500ms
     minInterval: 50,     // 最小间隔50ms
     maxConcurrent: 1     // 仅允许一个同步运行
   });
   
   editor.onChange = _.throttle(
     code => dispatch(editMonaco(code)), 
     300, { trailing: true }
   );
   

该状态机设计满足核心需求：在保证数据一致性的前提下，提供流畅的双向编辑体验，并通过严格的守卫条件和原子操作规避了文档指出的主要风险。