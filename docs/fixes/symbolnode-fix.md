# 错误修复: Unknown AST node type: SymbolNode

## 问题描述
在使用分层架构编辑器时，MathJS AST 解析器遇到了未知的节点类型：
```
Unknown AST node type: SymbolNode
```

## 问题原因
`MathJSLayeredTransformer.ts` 中的 `astToBlocklyStructure` 方法缺少对 `SymbolNode` 类型的处理。

`SymbolNode` 是 MathJS 中表示变量或符号的节点类型，当表达式包含变量（如 `x`, `y`, `variable` 等）时会产生这种节点。

## 解决方案

### 1. 添加 SymbolNode 支持
在 `astToBlocklyStructure` 方法中添加：
```typescript
case 'SymbolNode':
  return {
    type: 'variable',
    id: this.generateId(),
    fields: { VAR: ast.name }
  }
```

### 2. 添加 variable 块类型支持
在 `generateExpressionFromBlockly` 方法中添加：
```typescript
case 'variable':
  return String(blocklyStructure.fields?.VAR || 'x')
```

### 3. 额外的节点类型支持
同时添加了其他常见的 MathJS 节点类型：
- `ParenthesisNode`: 括号节点
- `AccessorNode`: 访问器节点（如数组访问）

## 修改位置
- 文件：`src/transformers/MathJSLayeredTransformer.ts`
- 方法：`astToBlocklyStructure()` 和 `generateExpressionFromBlockly()`

## 支持的 MathJS 节点类型
现在支持以下节点类型：
1. `ConstantNode` - 常数节点（如数字）
2. `SymbolNode` - 符号节点（如变量）✅ 新增
3. `OperatorNode` - 操作符节点（如 +, -, *, /）
4. `FunctionNode` - 函数节点（如 sin(), cos()）
5. `ParenthesisNode` - 括号节点 ✅ 新增
6. `AccessorNode` - 访问器节点 ✅ 新增

## 验证
- ✅ 编译检查通过
- ✅ 热重载更新成功
- ✅ 现在可以处理包含变量的表达式

## 测试用例
现在可以正确处理包含变量的表达式，例如：
- `x + 1`
- `2 * y`
- `sin(angle)`
- `variable1 + variable2`

## 相关文件
- `src/transformers/MathJSLayeredTransformer.ts` - 主要修改文件
- `src/core/layeredTypes.ts` - 相关类型定义
