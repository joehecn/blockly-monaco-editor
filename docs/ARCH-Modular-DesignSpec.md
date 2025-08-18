---
filename: ARCH-Modular-DesignSpec.md
title: 模块化实施方案（完整版）
description: 三层双流状态模型的模块化实施详细方案
---
# 模块化实施方案（完整版）

核心模块说明

1. 状态管理模块

核心职责：管理系统状态和状态转换  
关键接口：
transitionTo(newState: SystemState): void  // 状态转换
getCurrentState(): SystemState            // 获取当前状态
getEditPermissions(): EditPermissions     // 获取编辑权限

契约约束：
• 状态转换必须符合预设规则（ALL_SYNCED→BLOCKLY_DIRTY等）

• 状态变更必须通过state.changed事件通知

• 必须实现SYNC_PROCESSING状态超时处理（5秒超时）

• 事件命名必须遵循小写字母和点分隔命名空间规范

### 事件命名规范（强制）
所有事件名必须小写字母+点分隔，遵循以下规范：
- 模块名在前，事件类型在后
- 使用点号分隔命名空间
- 错误示例：`STATE_CHANGED` → 正确：`state.changed`
- 禁止使用大写字母、下划线或其他特殊字符

**标准事件列表**：
- state.changed：状态变更事件
- sync.started：同步开始事件
- sync.completed：同步完成事件
- sync.failed：同步失败事件
- state.recovered：状态恢复事件
- user.edit：用户编辑事件
- edit.pending：待处理编辑事件
- version.created：版本快照创建事件
- version.rolledback：版本回滚完成事件

```javascript
// 正确示例 - 使用小写字母和点分隔的命名空间
publishEvent('state.changed', payload);
publishEvent('sync.failed', errorDetails);

// 错误示例（大写不符合规范）
publishEvent('STATE_CHANGED', payload);  // 不推荐
publishEvent('SYNC_FAILED', errorDetails);  // 不推荐
```

2. 数据转换模块

核心职责：处理三层数据格式转换  
关键接口：
transform(input: LayerData, direction: 'LEFT'|'RIGHT'): TransformResult  // 数据转换
validate(data: any): ValidationResult      // 数据验证
getPositionMapping(): PositionMap         // 获取位置映射

契约约束：
• 转换失败必须抛出标准TransformError

• 必须支持双向位置映射（Blockly↔Monaco）

• 错误恢复必须符合分层策略（自动修复→回退）

3. 事件中心模块

核心职责：模块间通信中枢  
关键接口：
on(event: SystemEvent, handler: EventHandler): void  // 注册事件监听
emit(event: SystemEvent, data?: EventData): void    // 触发事件

契约约束：
• 事件名必须使用小写字母和点分隔命名空间（如state.changed, sync.started）

• 必须保证事件处理顺序（先注册先执行）

• 必须支持异步事件处理

**关键事件使用场景说明**：
- edit.pending：SYNC_PROCESSING状态下的待处理编辑事件，用于存储新的编辑操作，在同步完成后应用
  - 触发时机：用户在SYNC_PROCESSING状态下进行编辑
  - 数据结构：{ source: 'blockly'|'monaco', data: EditContent }
  - 处理逻辑：时序控制模块捕获后保存为pendingInput，状态管理模块在同步成功后应用

**状态恢复事件触发条件列表**：
- state.recovered：系统从错误状态恢复到稳定状态的事件
  - 触发条件1：数据转换错误重试失败
  - 触发条件2：同步超时保护触发
  - 触发条件3：版本回滚完成
  - 触发条件4：状态机重置成功
  - 触发条件5：用户输入错误自动修正
  - 触发条件6：同步超时后的安全状态回退
  - 数据结构：{ newState: SystemState, recoverySource: RecoverySource, recoveryTime: number }

4. 组装引擎模块

核心职责：组合所有模块  
关键接口：
register(name: ModuleName, module: Module): void  // 注册模块
assemble(): void                                  // 执行组装
validateContracts(): boolean                      // 契约验证

契约约束：
• 组装过程必须建立标准事件连接

• 必须验证所有模块的契约合规性

• 必须提供模块依赖解析

5. 时序控制模块

核心职责：实现防抖节流机制  
关键接口：
handleUserEdit(input: EditEvent): SyncSignal  // 处理用户编辑
forceSync(): void                             // 强制同步
cancelPending(): void                         // 取消待处理操作

契约约束：
• 必须实现300ms防抖（决定状态转换）

• 必须实现100ms节流（提供实时反馈）

• SYNC_PROCESSING状态下允许来源端继续编辑

6. 版本管理模块

核心职责：数据快照和恢复  
关键接口：
createSnapshot(trigger: SnapshotTrigger): VersionSnapshot  // 创建快照
rollbackTo(versionId: string): RollbackResult             // 回滚版本
getHistory(): VersionHistory[]                            // 获取历史

契约约束：
• ALL_SYNCED状态自动创建快照

• 最多保存10个历史版本（可配置）

• 回滚必须是原子操作（无中间状态）

7. 约束验证模块

核心职责：持续验证五大核心原则  
关键接口：
validateDataConsistency(): ValidationResult  // 数据一致性验证
checkResponseTime(): PerformanceReport       // 响应时间检查
auditEditRights(): EditRightsReport          // 编辑权限审计

契约约束：
• 必须持续监控用户响应时间（<50ms）

• 必须确保非ALL_SYNCED状态单一编辑权

• 必须验证状态透明性（UI反馈）

8. 错误恢复模块

核心职责：分层错误处理  
关键接口：
handleUserInputError(error: InputError): RecoveryAction  // 用户输入错误
handleSystemFailure(error: SystemError): RecoveryPlan    // 系统故障
handleDataInconsistency(error: DataError): ConvergenceAction  // 数据不一致

契约约束：
• 必须实现三层恢复策略（UI提示→自动重试→版本回退）

• 自动恢复必须在30秒内完成

• 必须记录所有错误事件

9. UI协调模块

核心职责：管理用户界面状态  
关键接口：
updateStateIndicator(state: SystemState): void  // 更新状态指示器
setEditorEnabled(editor: EditorType, enabled: boolean): void  // 设置编辑器状态
highlightPosition(position: HighlightPosition): void  // 高亮位置
showErrors(errors: ErrorInfo[]): void  // 显示错误

契约约束：
• 必须提供清晰的视觉状态反馈

• SYNC_PROCESSING状态必须显示进度

• 错误必须提供可操作的修复建议

精简模块关系图

graph TD
    A[状态管理] -->|状态变更| E[事件中心]
    B[数据转换] -->|转换请求| E
    C[组装引擎] -->|初始化| A
    C -->|初始化| B
    C -->|初始化| E
    D[时序控制] -->|同步信号| E
    F[版本管理] -->|快照事件| E
    G[约束验证] -->|验证报告| E
    H[错误恢复] -->|恢复动作| E
    I[UI协调] -->|UI更新| E
    
    E -->|用户操作| D
    E -->|状态通知| I
    E -->|错误事件| H
    E -->|数据请求| B
    E -->|验证请求| G
    
    style A fill:#4CAF50,stroke:#333
    style B fill:#2196F3,stroke:#333
    style C fill:#FF5722,stroke:#333
    style D fill:#9C27B0,stroke:#333
    style E fill:#607D8B,stroke:#333
    style F fill:#795548,stroke:#333
    style G fill:#009688,stroke:#333
    style H fill:#FF9800,stroke:#333
    style I fill:#3F51B5,stroke:#333


模块交互示例

用户编辑Blockly的完整流程

sequenceDiagram
    participant U as 用户
    participant UI as UI协调模块
    participant EC as 事件中心
    participant TC as 时序控制
    participant SM as 状态管理
    participant DT as 数据转换
    participant VM as 版本管理
    participant CV as 约束验证
    
    U->>UI: 在Blockly中编辑
    UI->>EC: 发送 BLOCKLY_EDIT 事件
    EC->>TC: 处理用户输入
    TC->>EC: 300ms后发送 DEBOUNCED_SYNC 事件
    EC->>SM: 请求状态转换(BLOCKLY_DIRTY)
    SM->>SM: 验证状态转换
    SM->>EC: 发送 STATE_CHANGED 事件
    EC->>UI: 更新UI状态(禁用Monaco)
    EC->>DT: 请求 BLOCKLY→JSON 转换
    DT->>DT: 执行转换
    DT->>EC: 发送 CONVERSION_COMPLETE 事件
    EC->>SM: 请求状态转换(SYNC_PROCESSING)
    SM->>EC: 发送 STATE_CHANGED 事件
    EC->>UI: 显示同步进度
    EC->>DT: 请求 JSON→MONACO 转换
    DT->>DT: 执行转换
    DT->>EC: 发送 CONVERSION_COMPLETE 事件
    EC->>SM: 请求状态转换(ALL_SYNCED)
    SM->>EC: 发送 STATE_CHANGED 事件
    EC->>UI: 更新UI状态(启用双编辑器)
    EC->>VM: 创建版本快照
    EC->>CV: 验证系统约束
    CV->>EC: 发送 VALIDATION_REPORT 事件


模块开发黄金法则

1. 契约优先开发：
   • 先定义接口再实现功能

   • 接口变更需更新所有相关文档

   • 通过契约测试验证接口合规性

2.3. 事件驱动通信：
   // 事件发布标准函数
   function publishEvent(event: string, payload: any) {
     if (!event.match(/^[a-z]+\.[a-z]+$/)) {
       throw new Error("事件名必须小写字母+点分隔命名空间");
     }
     eventBus.emit(event, payload);
   }
   
   // 正确的事件注册示例
   eventCenter.on('state.changed', (newState) => {
     uiCoordinator.updateStateIndicator(newState);
   });
   
   // 正确的事件触发示例
   stateManager.transitionTo('BLOCKLY_DIRTY');
   publishEvent('state.changed', 'BLOCKLY_DIRTY'); 独立开发原则：
   • 开发时只需关注本模块契约

   • 通过Mock事件中心测试模块行为

   • 无需了解其他模块实现细节

认知负担控制策略

pie
    title 开发者认知范围
    “自身模块功能” ： 60
    “模块契约接口” ： 25
    “事件名称规范” ： 15


开发者只需关注：
1. 本模块的3个核心职责
2. 模块的2-3个关键接口
3. 需要处理的3-5个系统事件
4. 需要发出的2-3个系统事件

关键优势与价值

1. 复杂问题分解：
   • 将三层双流状态模型分解为9个独立模块

   • 每个模块解决单一领域问题

   • 降低单个模块的认知复杂度

2. 独立开发验证：
   graph LR
     A[定义模块契约] --> B[实现核心功能]
     B --> C[编写单元测试]
     C --> D[通过事件Mock验证]
     D --> E[集成到系统]
   

3. 无缝系统集成：
   • 组装引擎自动连接模块

   • 事件中心保证模块间解耦

   • 契约验证确保接口一致性

此方案完整覆盖所有文档需求，特别是：
• 文档3的系统逻辑设计（状态模型）

• 文档5的契约要求（接口规范）

• 文档8的实施计划（渐进实现）

• 文档9的模块解耦原则（独立开发）

开发者只需专注单个模块的契约实现，无需理解全局复杂性，显著降低认知负担同时确保系统完整性。