# 架构设计文档

本目录包含了 Blockly Monaco 编辑器的完整架构设计文档。

## 📋 目录

### 核心架构
- [**overview.md**](./overview.md) - 架构总览
- [**data-flow.md**](./data-flow.md) - 精确的数据流设计
- [**layered-architecture.md**](./layered-architecture.md) - 分层架构详解

### 方案设计
- [**json-solution.md**](./json-solution.md) - JSON 结构桥接方案
- [**mathjs-solution.md**](./mathjs-solution.md) - MathJS AST 桥接方案
- [**typescript-solution.md**](./typescript-solution.md) - TypeScript AST 桥接方案

### 技术细节
- [**transformers.md**](./transformers.md) - 转换器设计
- [**highlight-mapping.md**](./highlight-mapping.md) - 高亮映射机制
- [**state-management.md**](./state-management.md) - 状态管理策略

### 重构历程
- [**refactor-history.md**](./refactor-history.md) - 架构演进历史
- [**migration-guide.md**](./migration-guide.md) - 迁移指南

## 🎯 快速导航

如果您是：

- **新开发者** → 从 [架构总览](./overview.md) 开始
- **使用者** → 查看 [数据流设计](./data-flow.md)
- **扩展者** → 阅读 [转换器设计](./transformers.md)
- **维护者** → 参考 [迁移指南](./migration-guide.md)

## 🔄 架构演进

我们的架构经历了从简单到复杂，再到精确分层的演进过程：

```
阶段1: 直接转换        阶段2: 抽象转换        阶段3: 分层转换 (当前)
blockly ↔ monaco  →  blockly ↔ AST ↔ monaco  →  blockly ↔ Object ↔ Object ↔ String ↔ monaco
```

每个阶段都解决了前一阶段的问题，并为下一阶段的发展奠定了基础。
