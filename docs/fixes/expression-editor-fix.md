# 修复: 表达式编辑器问题

## 问题描述
原始的表达式编辑器出现问题，可能是因为在修复其他问题时，`BlocklyExpressionComponent.vue` 被简化为只使用标准 Blockly 块，导致原始表达式编辑器功能受影响。

## 问题诊断
1. **自定义块丢失**: 原始组件被修改为只使用标准块，但表达式编辑器需要自定义块
2. **工具箱配置丢失**: 简化的 flyout 工具箱替代了完整的分类工具箱
3. **表达式同步功能缺失**: 表达式到 Blockly 的同步功能被禁用

## 解决方案

### 1. 恢复自定义块导入
```typescript
import { expressionBlocks } from '../../blocks/expression.ts'
import { expressionToolbox } from '../../toolbox/expression.ts'
import { expression2blocklyGenerator } from '../../generators/expression_.ts'
```

### 2. 恢复自定义块定义
```typescript
// 定义自定义块
Blockly.common.defineBlocks(expressionBlocks)
```

### 3. 恢复完整工具箱
```typescript
// 使用自定义工具箱
toolbox: expressionToolbox
```

### 4. 恢复表达式同步
```typescript
const generatedXml = expression2blocklyGenerator.fromExpression(newVal)
```

## 修改文件
- **src/components/expression/BlocklyExpressionComponent.vue**: 恢复完整功能

## 当前状态
- ✅ 编译无错误
- ✅ 自定义块已恢复
- ✅ 工具箱配置已恢复
- ✅ 基本功能已恢复

## 注意事项
由于表达式同步逻辑比较复杂，目前只恢复了基本结构。如果遇到具体的同步问题，可能需要进一步调试 `expression2blocklyGenerator` 的实现。

## 验证步骤
1. 访问 http://localhost:5173/
2. 点击"表达式编辑器"标签页
3. 确认 Blockly 编辑器显示自定义积木块
4. 测试积木拖拽和组合功能
5. 测试 Monaco 编辑器与 Blockly 的同步

## 下一步
如果仍有问题，建议：
1. 检查浏览器控制台错误
2. 验证自定义块定义是否正确
3. 测试表达式解析和生成功能
