blockly <-> blockly结构(Object) <-> json结构(Object) <-> code(String) <-> monaco
blockly <-> blockly结构(Object) <-> mathjs ast结构(Object) <-> code(String) <-> monaco
blockly <-> blockly结构(Object) <-> typescript ast结构(Object) <-> code(String) <-> monaco

# Blockly Monaco 编辑器架构分析

## 三种架构方案

### 方案一：JSON 结构桥接 ✅ 已实现
```
blockly <-> blockly结构(Object) <-> json结构(Object) <-> code(String) <-> monaco
```
**特点：**
- 使用 JSON 作为中间格式
- 简单直观，易于调试
- 适合配置文件或数据结构的可视化编辑
- 双向转换相对简单

**应用场景：**
- 配置文件编辑器
- 数据结构可视化
- API 接口定义

**当前实现：**
- 位于 `src/components/json/` 目录
- 包含 `BlocklyComponent.vue`、`JsonComponent.vue`、`MonacoEditor.vue`

### 方案二：MathJS AST 桥接 ✅ 已实现
```
blockly <-> blockly结构(Object) <-> mathjs ast结构(Object) <-> code(String) <-> monaco
```
**特点：**
- 专门用于数学表达式处理
- 支持复杂的数学运算和函数
- 内置表达式优化和求值
- 适合数学、科学计算应用

**应用场景：**
- 数学表达式编辑器
- 科学计算界面
- 公式编辑器
- 统计分析工具

**当前实现：**
- 位于 `src/components/expression/` 目录
- 核心文件：
  - `BlocklyExpressionComponent.vue`：Blockly 表达式编辑器
  - `ExpressionComponent.vue`：主组件
  - `MonacoExpressionEditor.vue`：Monaco 表达式编辑器
- 生成器：`src/generators/expression.ts` - 将 Blockly 转换为 MathJS 表达式
- 工具类：`src/utils/astHighlightMapper.ts` - AST 高亮映射

### 方案三：TypeScript AST 桥接 ⏳ 待实现
```
blockly <-> blockly结构(Object) <-> typescript ast结构(Object) <-> code(String) <-> monaco
```
**特点：**
- 支持完整的编程语言特性
- 类型安全，支持静态分析
- 可以生成高质量的 TypeScript/JavaScript 代码
- 支持复杂的程序逻辑

**应用场景：**
- 可视化编程教育
- 代码生成工具
- 业务流程编辑器
- 自动化脚本生成

## 当前项目重点：MathJS AST 方案

项目目前主要专注于**方案二（MathJS AST）**，具备以下核心功能：

### 已实现功能
1. **Blockly → MathJS 转换**：通过 `expressionGenerator` 将 Blockly 块转换为数学表达式
2. **AST 位置映射**：`ASTHighlightMapper` 实现表达式中每个部分的位置追踪
3. **双向编辑**：支持 Blockly 和 Monaco 之间的同步编辑
4. **语法高亮**：基于 AST 结构的智能高亮

### 技术特点
- 使用 MathJS 进行表达式解析和处理
- 支持数学函数：`equalText`、算术运算、逻辑运算等
- 精确的位置映射，支持选择同步
- 实时表达式验证和格式化

### 下一步优化建议
1. **性能优化**：大型表达式的 AST 解析性能
2. **错误处理**：更好的语法错误提示和恢复
3. **扩展语法**：支持更多数学函数和操作符
4. **用户体验**：改进双向同步的流畅性

## 重构后的架构设计

为了更好地支持方案三（TypeScript AST），项目已经进行了架构重构：

### 核心抽象层 (`src/core/`)

#### 1. 类型系统 (`types.ts`)
- **统一接口**：`AbstractTransformer<T>` - 所有转换器的基础接口
- **高亮映射**：`HighlightMapper<T>` - 位置映射的抽象接口
- **编辑器协调**：`EditorCoordinator<T>` - 编辑器间同步的协调器
- **通用类型**：`Position`、`SelectionInfo`、`BlockInfo` 等

#### 2. 基础组合函数 (`useBaseEditor.ts`)
- **分割面板管理**：自动保存/恢复面板大小
- **编辑器状态**：统一的状态管理和错误处理
- **同步协调**：防止循环同步的机制
- **生命周期管理**：组件挂载和尺寸调整

### 转换器层 (`src/transformers/`)

#### 1. JSON 转换器 (`JsonTransformer.ts`)
```
Blockly JSON ↔ JsonData ↔ Monaco JSON
```

#### 2. MathJS 转换器 (`MathJSTransformer.ts`)
```
Blockly 表达式 ↔ MathJSData ↔ Monaco 表达式
```

#### 3. TypeScript 转换器 (`TypeScriptTransformer.ts`) ✨ 新增
```
Blockly 程序 ↔ TypeScriptData ↔ Monaco TypeScript
```

### 高亮映射层 (`src/highlightMappers/`)

#### 1. MathJS 高亮映射器 (`MathJSHighlightMapper.ts`)
- 基于现有 `astHighlightMapper.ts` 重构
- 实现 `HighlightMapper<MathJSData>` 接口
- 支持 AST 节点到文本位置的精确映射

### 组件层重构

#### 1. 重构示例 (`RefactoredExpressionComponent.vue`)
- 使用 `useBaseEditor` 组合函数
- 统一的错误处理和状态显示
- 简化的事件处理逻辑

### 架构优势

1. **高度可扩展**：新增转换器只需实现 `AbstractTransformer` 接口
2. **类型安全**：泛型设计确保编译时类型检查
3. **代码复用**：共同的逻辑通过组合函数复用
4. **清晰分离**：转换逻辑、UI 逻辑、映射逻辑完全分离
5. **易于测试**：每个层次都可以独立测试

### 实现方案三的路径

基于新架构，实现 TypeScript AST 方案变得简单：

1. **✅ 已完成**：`TypeScriptTransformer` 基础实现
2. **待实现**：TypeScript 高亮映射器
3. **待实现**：TypeScript 专用 Blockly 块
4. **待实现**：TypeScript 专用 Monaco 配置

### 迁移指南

现有组件可以逐步迁移到新架构：

```typescript
// 旧方式
const handleChange = (value) => { /* 复杂的同步逻辑 */ }

// 新方式
const { syncContent } = useBaseEditor(props, emit, {
  transformer: new MathJSTransformer(),
  // ...
})
const handleChange = (value) => syncContent('monaco', value)
```
