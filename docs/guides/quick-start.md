# 快速上手指南

本指南将帮助您在 5 分钟内开始使用 Blockly Monaco 编辑器。

## 🚀 第一步：基础设置

### 安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd blockly-monaco-editor

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 基础导入

```typescript
import { 
  MathJSLayeredTransformer, 
  LayeredDataFlowManager,
  LayeredEditorComponent 
} from './src/architecture'
```

## 📝 第二步：创建第一个编辑器

### Vue 3 组件示例

```vue
<template>
  <div class="editor-container">
    <h2>我的第一个数学表达式编辑器</h2>
    
    <!-- 使用分层编辑器组件 -->
    <LayeredEditorComponent
      v-model="expression"
      :transformer="transformer"
      :show-debug-panel="true"
      @update:model-value="handleExpressionChange"
    />
    
    <!-- 显示当前表达式 -->
    <div class="result">
      <h3>当前表达式：</h3>
      <code>{{ expression }}</code>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MathJSLayeredTransformer } from '../transformers/MathJSLayeredTransformer'
import LayeredEditorComponent from '../components/LayeredEditorComponent.vue'

// 创建转换器
const transformer = new MathJSLayeredTransformer()

// 响应式数据
const expression = ref('equalText(name, "John") and age > 18')

// 事件处理
const handleExpressionChange = (newExpression: string) => {
  console.log('表达式已更新:', newExpression)
}
</script>

<style scoped>
.editor-container {
  height: 100vh;
  padding: 20px;
}

.result {
  margin-top: 20px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.result code {
  background-color: white;
  padding: 5px;
  border-radius: 3px;
  font-family: monospace;
}
</style>
```

## 🔧 第三步：理解数据流

### 数据流向图解

```
用户在 Blockly 中拖拽块
        ↓
Blockly 结构 (Object) 
        ↓
MathJS AST 结构 (Object)
        ↓
表达式字符串 (String)
        ↓
Monaco 编辑器显示
```

### 数据流管理器使用

```typescript
import { LayeredDataFlowManager } from '../core/LayeredDataFlowManager'
import { MathJSLayeredTransformer } from '../transformers/MathJSLayeredTransformer'

// 创建数据流管理器
const transformer = new MathJSLayeredTransformer()
const dataFlow = new LayeredDataFlowManager(transformer)

// 监听状态变化
dataFlow.onStateChange((state) => {
  console.log('数据流状态:', state)
  console.log('是否同步:', state.isInSync)
  console.log('当前表达式:', state.codeString)
})

// 从 Monaco 更新
await dataFlow.updateFromMonaco('equalText(name, "Alice")')

// 从 Blockly 更新
await dataFlow.updateFromBlockly(blocklyStructure)

// 检查同步状态
const syncStatus = dataFlow.checkSyncStatus()
if (!syncStatus.inSync) {
  console.warn('数据不同步:', syncStatus.conflicts)
}
```

## 🎨 第四步：自定义配置

### 创建自定义转换器

```typescript
import { MathJSLayeredTransformer } from '../transformers/MathJSLayeredTransformer'

class MyCustomTransformer extends MathJSLayeredTransformer {
  
  // 重写函数提取逻辑
  protected extractFunctions(expression: string): string[] {
    const functions = super.extractFunctions(expression)
    
    // 添加自定义函数
    const customFunctions = ['myCustomFunction', 'anotherFunction']
    return [...functions, ...customFunctions]
  }
  
  // 重写验证逻辑
  validateIntermediate(intermediate: any): { valid: boolean; errors: string[] } {
    const result = super.validateIntermediate(intermediate)
    
    // 添加自定义验证
    if (intermediate.functions.includes('forbiddenFunction')) {
      result.valid = false
      result.errors.push('不允许使用 forbiddenFunction')
    }
    
    return result
  }
}

// 使用自定义转换器
const customTransformer = new MyCustomTransformer()
const dataFlow = new LayeredDataFlowManager(customTransformer)
```

### 配置 Monaco 编辑器

```typescript
import * as monaco from 'monaco-editor'

// 自定义主题
monaco.editor.defineTheme('my-theme', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'function', foreground: '#0066cc', fontStyle: 'bold' },
    { token: 'keyword', foreground: '#cc0066', fontStyle: 'bold' },
    { token: 'variable', foreground: '#006600' }
  ],
  colors: {
    'editor.background': '#fafafa'
  }
})

// 编辑器选项
const editorOptions = {
  theme: 'my-theme',
  fontSize: 14,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true
}
```

## 📊 第五步：添加调试功能

### 启用调试面板

```vue
<template>
  <!-- 启用调试面板 -->
  <LayeredEditorComponent
    v-model="expression"
    :transformer="transformer"
    :show-debug-panel="true"
  />
  
  <!-- 自定义状态显示 -->
  <div class="debug-info">
    <h3>调试信息</h3>
    <div>同步状态: {{ dataFlowState.isInSync ? '✅ 已同步' : '❌ 未同步' }}</div>
    <div>最后更新: {{ formatLastUpdate(dataFlowState.lastUpdateSource) }}</div>
    <div>错误数量: {{ dataFlowState.syncErrors.length }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const formatLastUpdate = (source) => {
  const map = {
    'blockly': '可视化编辑器',
    'monaco': '代码编辑器',
    'intermediate': '中间结构'
  }
  return map[source] || source
}
</script>
```

### 状态监控

```typescript
// 创建状态监控器
class StateMonitor {
  private dataFlow: LayeredDataFlowManager
  
  constructor(dataFlow: LayeredDataFlowManager) {
    this.dataFlow = dataFlow
    this.setupMonitoring()
  }
  
  private setupMonitoring() {
    this.dataFlow.onStateChange((state) => {
      // 记录状态变化
      console.log('📊 状态变化:', {
        timestamp: new Date().toISOString(),
        source: state.lastUpdateSource,
        isInSync: state.isInSync,
        hasErrors: state.syncErrors.length > 0
      })
      
      // 检查性能
      if (state.codeString.length > 1000) {
        console.warn('⚠️ 表达式过长，可能影响性能')
      }
      
      // 检查错误
      if (state.syncErrors.length > 0) {
        console.error('❌ 同步错误:', state.syncErrors)
      }
    })
  }
}

// 使用监控器
const monitor = new StateMonitor(dataFlow)
```

## ✅ 完成！下一步做什么？

### 学习更多功能
1. [自定义 Blockly 块](./custom-blocks.md)
2. [性能优化](./performance.md)
3. [错误处理](./error-handling.md)

### 查看示例
1. [JSON 配置编辑器示例](../examples/json-editor.md)
2. [复杂数学表达式示例](../examples/complex-math.md)
3. [TypeScript 代码生成示例](../examples/typescript-generator.md)

### 常见问题
- **Q: 为什么我的自定义块不显示？**
  A: 检查块定义是否正确注册，参考 [自定义块指南](./custom-blocks.md)

- **Q: 数据同步很慢怎么办？**
  A: 查看 [性能优化指南](./performance.md) 了解优化技巧

- **Q: 如何处理语法错误？**
  A: 参考 [错误处理策略](./error-handling.md) 实现错误处理

## 🎉 恭喜！

您已经成功创建了第一个 Blockly Monaco 编辑器！现在您可以：

- ✅ 在 Blockly 中拖拽块来创建表达式
- ✅ 在 Monaco 中直接编辑代码
- ✅ 享受实时双向同步
- ✅ 使用调试面板查看内部状态

继续探索更高级的功能，创建属于您自己的可视化编程工具！
