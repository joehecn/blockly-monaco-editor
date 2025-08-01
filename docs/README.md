# Blockly Monaco 编辑器

一个创新的可视化编程编辑器，支持 Blockly 可视化编程与 Monaco 代码编辑器之间的无缝双向转换。

## 🎯 核心特性

- **三种架构方案**：支持 JSON、MathJS AST、TypeScript AST 三种不同的数据转换架构
- **精确的数据流控制**：清晰的分层转换机制，确保数据一致性
- **实时双向同步**：Blockly 和 Monaco 编辑器之间的实时同步
- **类型安全**：基于 TypeScript 的全链路类型保障
- **高度可扩展**：模块化架构，支持自定义转换器和映射器

## 🏗️ 架构概览

```
blockly <-> blockly结构(Object) <-> 中间结构(Object) <-> code(String) <-> monaco
```

支持三种中间结构：
- **JSON 结构**：适用于配置文件和数据结构编辑
- **MathJS AST 结构**：专为数学表达式设计
- **TypeScript AST 结构**：支持完整的编程语言特性

## 📁 项目结构

```
src/
├── core/                     # 核心架构
│   ├── types.ts             # 基础类型定义
│   ├── layeredTypes.ts      # 分层架构类型
│   ├── useBaseEditor.ts     # 基础编辑器组合函数
│   └── LayeredDataFlowManager.ts  # 数据流管理器
├── transformers/            # 转换器层
│   ├── JsonTransformer.ts
│   ├── MathJSTransformer.ts
│   ├── MathJSLayeredTransformer.ts
│   └── TypeScriptTransformer.ts
├── highlightMappers/        # 高亮映射器
│   └── MathJSHighlightMapper.ts
├── components/              # Vue 组件
│   ├── json/               # JSON 方案组件
│   ├── expression/         # 表达式方案组件
│   ├── LayeredEditorComponent.vue  # 分层架构编辑器
│   └── RefactoredExpressionComponent.vue
└── architecture.ts         # 统一导出
```

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建项目

```bash
npm run build
```

## 📖 文档

- [架构设计](./docs/architecture/) - 详细的架构设计文档
- [使用指南](./docs/guides/) - 开发和使用指南
- [API 参考](./docs/api/) - 完整的 API 文档
- [示例代码](./docs/examples/) - 实用的示例代码

## 🎯 使用场景

### JSON 配置编辑器
```typescript
import { JsonTransformer, LayeredDataFlowManager } from './src/architecture'

const transformer = new JsonTransformer()
const dataFlow = new LayeredDataFlowManager(transformer)
```

### 数学表达式编辑器
```typescript
import { MathJSLayeredTransformer, LayeredDataFlowManager } from './src/architecture'

const transformer = new MathJSLayeredTransformer()
const dataFlow = new LayeredDataFlowManager(transformer)
```

### TypeScript 代码编辑器
```typescript
import { TypeScriptTransformer, LayeredDataFlowManager } from './src/architecture'

const transformer = new TypeScriptTransformer()
const dataFlow = new LayeredDataFlowManager(transformer)
```

## 🛠️ 开发

### 技术栈

- **前端框架**：Vue 3 + TypeScript
- **构建工具**：Vite
- **编辑器**：Blockly + Monaco Editor
- **数学处理**：MathJS
- **代码解析**：TypeScript Compiler API

### 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🤝 贡献者

感谢所有为这个项目做出贡献的开发者！

## 📞 联系我们

如果您有任何问题或建议，请通过以下方式联系我们：

- 提交 Issue
- 发送邮件
- 加入讨论

---

**注意**：本项目正在积极开发中，API 可能会发生变化。建议在生产环境中使用前充分测试。
