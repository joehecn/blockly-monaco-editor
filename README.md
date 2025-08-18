# Blockly Monaco Editor

一个创新的可视化编程编辑器，基于三层双流状态模型，支持 Blockly 与 Monaco 代码编辑器之间的无缝双向转换。

## 🎯 核心特性

- **五层双流架构**：Blockly编辑器 ↔ json(json结构) ↔ Monaco编辑器(code字符串) 的双向同步
- **四状态模型**：ALL_SYNCED, BLOCKLY_DIRTY, MONACO_DIRTY, SYNC_PROCESSING
- **三种数据类型**：JSON、Expression、TypeScript 的双向编辑
- **实时同步**：编辑一侧，另一侧自动更新
- **精确高亮**：点击对应，精确定位
- **智能冲突检测**：基于规则引擎的状态转换冲突检测
- **自适应超时调整**：根据系统负载动态调整同步超时时间
- **状态机可视化调试**：实时显示状态路径和转换历史
- **统一架构**：三种类型共享设计模式
- **专业解析**：基于成熟库（MathJS、TS Compiler API）

## 🚀 快速开始

```bash
npm install
npm run dev
```

## 📖 文档

### 架构文档
- [核心原则](./docs/ARCH-Principles-CoreDesign.md) - 三层双流状态模型的设计原则
- [接口契约](./docs/SPEC-Contracts-Interfaces.md) - TypeScript接口定义和契约规范
- [系统架构](./docs/ARCH-System-StateModel.md) - 三层架构和四状态模型的系统设计
- [测试架构](./docs/QA-Testing-Strategy.md) - 契约驱动测试的完整设计
- [实施计划](./docs/IMPL-Plan-PhasedApproach.md) - 复杂问题分解的实施策略
- [JSON示例](./docs/IMPL-Json-ReferenceImplementation.md) - JSON双向编辑的具体实现示例

### 核心实现文件
- `src/contracts/base-system-types.ts`：基础系统类型定义
- `src/contracts/services-core-services.ts`：核心服务契约
- `src/contracts/implementations/default-state-machine.ts`：状态机实现（含冲突检测）
- `src/contracts/implementations/state-machine-visualizer.ts`：可视化调试工具
- `src/state-machine-demo.ts`：状态机演示类

### 开发指南
- [快速开始](#🚀-快速开始) - 项目启动和基本使用
- [契约测试示例](./tests/contract-testing-example.ts) - 实际的测试代码示例

## 🛠️ 技术栈

- Vue 3 + TypeScript + Vite
- Blockly + Monaco Editor
- MathJS + TypeScript Compiler API

## 📝 版本变更记录

| 版本 | 日期       | 变更内容                                                                 |
|------|------------|--------------------------------------------------------------------------|
| 1.0.0 | 2023-10-25 | 初始版本：实现JSON双向编辑，支持基本状态转换和错误处理                   |
| 1.1.0 | 2023-11-10 | 增加Expression支持，优化状态机性能，完善错误处理机制                     |
| 1.2.0 | 2023-11-28 | 增加TypeScript支持，添加契约测试框架，改进文档体系                       |
| 1.3.0 | 2023-12-15 | 优化用户界面，增强状态可视化，添加版本管理功能                           |
| 2.0.0 | 2024-01-20 | 重构架构为三层双流状态模型，完善文档体系，添加浏览器原子操作实现指南       |
