# Blockly 坐标保存机制（简化版）

## 问题描述

在 Blockly 和 JSON 的双向转换中，如何保存和恢复**根块**的坐标位置信息。

## 核心原理

在 Blockly 中，只有**根块（顶级块）**的坐标需要保存，子块的位置都是相对于父块自动计算的。

## 解决方案

### 1. 数据结构对比

#### 我们的 json2blocklyGenerator 结构
```json
{
  "blocks": {
    "languageVersion": 0,
    "blocks": [
      {
        "type": "object",
        "id": "root_abc123def",
        "x": 50,
        "y": 50,
        "inputs": {
          "MEMBERS": { ... }
        }
      }
    ]
  }
}
```

#### Blockly 标准序列化结构
```json
{
  "blocks": {
    "languageVersion": 0,
    "blocks": [
      {
        "type": "object",
        "id": "Y{rigewIa]]mly|ro,rV",
        "x": 0,
        "y": 0,
        "inputs": {
          "MEMBERS": { ... }
        }
      }
    ]
  }
}
```

### 2. 简化实现

#### 根块坐标管理
```typescript
// 在 BlocklyComponent 中存储根块坐标
let rootBlockPosition = { x: 50, y: 50 }

// 保存时记录根块位置
const topBlocks = workspace.value.getTopBlocks(false)
if (topBlocks.length > 0) {
  const position = topBlocks[0].getRelativeToSurfaceXY()
  rootBlockPosition = { x: position.x, y: position.y }
}

// 加载时应用根块位置
const data = json2blocklyGenerator.fromJsonString(value, rootBlockPosition.x, rootBlockPosition.y)
```

#### json2blocklyGenerator 改进
```typescript
fromJsonString(jsonStr: string, x = 0, y = 0) {
  const json = JSON.parse(jsonStr)
  const block = json2blocklyGenerator.fromJson(json)
  
  // 只为根块添加坐标和ID
  if (block) {
    block.id = 'root_' + Math.random().toString(36).substr(2, 9)
    block.x = x
    block.y = y
  }
  
  return {
    blocks: {
      languageVersion: 0,
      blocks: [block],
    },
  }
}
```

### 3. 工作流程

#### 保存过程（Blockly → JSON）
1. 用户移动根块
2. `emitContentChange` 被触发
3. 记录根块位置：`rootBlockPosition = { x: position.x, y: position.y }`
4. 生成 JSON 数据（不包含位置信息）
5. 发出更新事件

#### 加载过程（JSON → Blockly）
1. 接收新的 JSON 数据
2. 使用保存的根块坐标生成 Blockly 结构
3. 加载到工作空间：`Blockly.serialization.workspaces.load(data, workspace)`
4. Blockly 自动处理子块的相对位置

### 4. 优势

1. **简单直接**：只处理根块坐标，子块位置由 Blockly 自动管理
2. **性能高效**：避免了复杂的布局信息存储和处理
3. **兼容性好**：生成的结构完全符合 Blockly 标准序列化格式
4. **维护简单**：代码逻辑清晰，易于理解和维护

### 5. 关键点

- ✅ **只保存根块坐标**：`{ x: number, y: number }`
- ✅ **子块位置自动计算**：由 Blockly 内部处理
- ✅ **ID 自动生成**：确保块的唯一性
- ✅ **向后兼容**：没有坐标信息时使用默认位置 `(0, 0)`

## 总结

通过这种简化的机制，我们实现了：
- ✅ 根块位置的持久化
- ✅ 用户体验的连续性  
- ✅ 代码的简洁性
- ✅ Blockly 标准的兼容性

**核心理念**：让 Blockly 做它擅长的事（子块布局），我们只管理根块位置。
