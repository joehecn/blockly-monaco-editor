# 自定义 Blockly 块开发指南

本指南介绍如何创建自定义 Blockly 块，并将其集成到我们的分层架构中。

## 🧩 基础概念

### Blockly 块的组成
- **定义 (Definition)**: 块的结构、字段和连接点
- **生成器 (Generator)**: 将块转换为代码的逻辑
- **工具箱 (Toolbox)**: 块在工具面板中的组织方式

### 我们的架构中的位置
```
自定义块定义 → Blockly 工作区 → 中间结构 → 代码字符串
```

## 📝 创建基础块

### 1. 简单值块

#### src/blocks/custom/valueBlocks.ts
```typescript
import * as Blockly from 'blockly'

// 文本值块
export const textValueBlock = {
  type: 'custom_text_value',
  message0: '文本 %1',
  args0: [
    {
      type: 'field_input',
      name: 'TEXT',
      text: '输入文本'
    }
  ],
  output: 'String',
  colour: 160,
  tooltip: '输入一个文本值',
  helpUrl: ''
}

// 数字值块
export const numberValueBlock = {
  type: 'custom_number_value',
  message0: '数字 %1',
  args0: [
    {
      type: 'field_number',
      name: 'NUMBER',
      value: 0
    }
  ],
  output: 'Number',
  colour: 230,
  tooltip: '输入一个数字值',
  helpUrl: ''
}

// 变量块
export const variableBlock = {
  type: 'custom_variable',
  message0: '变量 %1',
  args0: [
    {
      type: 'field_variable',
      name: 'VAR',
      variable: 'item'
    }
  ],
  output: null,
  colour: 330,
  tooltip: '获取变量的值',
  helpUrl: ''
}

// 注册块定义
export function registerValueBlocks() {
  Blockly.Blocks['custom_text_value'] = {
    init: function() {
      this.jsonInit(textValueBlock)
    }
  }
  
  Blockly.Blocks['custom_number_value'] = {
    init: function() {
      this.jsonInit(numberValueBlock)
    }
  }
  
  Blockly.Blocks['custom_variable'] = {
    init: function() {
      this.jsonInit(variableBlock)
    }
  }
}
```

### 2. 比较操作块

#### src/blocks/custom/comparisonBlocks.ts
```typescript
import * as Blockly from 'blockly'

// 等于比较块
export const equalBlock = {
  type: 'custom_equal',
  message0: '%1 等于 %2',
  args0: [
    {
      type: 'input_value',
      name: 'A',
      check: null
    },
    {
      type: 'input_value',
      name: 'B',
      check: null
    }
  ],
  output: 'Boolean',
  colour: 210,
  tooltip: '检查两个值是否相等',
  helpUrl: ''
}

// 文本包含块
export const containsBlock = {
  type: 'custom_contains',
  message0: '%1 包含 %2',
  args0: [
    {
      type: 'input_value',
      name: 'TEXT',
      check: 'String'
    },
    {
      type: 'input_value',
      name: 'SUBSTRING',
      check: 'String'
    }
  ],
  output: 'Boolean',
  colour: 210,
  tooltip: '检查文本是否包含子字符串',
  helpUrl: ''
}

// 数值比较块
export const numberCompareBlock = {
  type: 'custom_number_compare',
  message0: '%1 %2 %3',
  args0: [
    {
      type: 'input_value',
      name: 'A',
      check: 'Number'
    },
    {
      type: 'field_dropdown',
      name: 'OP',
      options: [
        ['=', 'EQ'],
        ['≠', 'NEQ'],
        ['>', 'GT'],
        ['≥', 'GTE'],
        ['<', 'LT'],
        ['≤', 'LTE']
      ]
    },
    {
      type: 'input_value',
      name: 'B',
      check: 'Number'
    }
  ],
  output: 'Boolean',
  colour: 210,
  tooltip: '比较两个数字',
  helpUrl: ''
}

export function registerComparisonBlocks() {
  Blockly.Blocks['custom_equal'] = {
    init: function() {
      this.jsonInit(equalBlock)
    }
  }
  
  Blockly.Blocks['custom_contains'] = {
    init: function() {
      this.jsonInit(containsBlock)
    }
  }
  
  Blockly.Blocks['custom_number_compare'] = {
    init: function() {
      this.jsonInit(numberCompareBlock)
    }
  }
}
```

### 3. 逻辑操作块

#### src/blocks/custom/logicBlocks.ts
```typescript
import * as Blockly from 'blockly'

// AND 逻辑块
export const andBlock = {
  type: 'custom_and',
  message0: '%1 并且 %2',
  args0: [
    {
      type: 'input_value',
      name: 'A',
      check: 'Boolean'
    },
    {
      type: 'input_value',
      name: 'B',
      check: 'Boolean'
    }
  ],
  output: 'Boolean',
  colour: 210,
  tooltip: '逻辑 AND 操作',
  helpUrl: ''
}

// OR 逻辑块
export const orBlock = {
  type: 'custom_or',
  message0: '%1 或者 %2',
  args0: [
    {
      type: 'input_value',
      name: 'A',
      check: 'Boolean'
    },
    {
      type: 'input_value',
      name: 'B',
      check: 'Boolean'
    }
  ],
  output: 'Boolean',
  colour: 210,
  tooltip: '逻辑 OR 操作',
  helpUrl: ''
}

// NOT 逻辑块
export const notBlock = {
  type: 'custom_not',
  message0: '非 %1',
  args0: [
    {
      type: 'input_value',
      name: 'BOOL',
      check: 'Boolean'
    }
  ],
  output: 'Boolean',
  colour: 210,
  tooltip: '逻辑 NOT 操作',
  helpUrl: ''
}

export function registerLogicBlocks() {
  Blockly.Blocks['custom_and'] = {
    init: function() {
      this.jsonInit(andBlock)
    }
  }
  
  Blockly.Blocks['custom_or'] = {
    init: function() {
      this.jsonInit(orBlock)
    }
  }
  
  Blockly.Blocks['custom_not'] = {
    init: function() {
      this.jsonInit(notBlock)
    }
  }
}
```

## 🔄 创建转换器扩展

### 自定义块转换器

#### src/transformers/CustomBlockTransformer.ts
```typescript
import { MathJSLayeredTransformer } from './MathJSLayeredTransformer'
import { IntermediateStructure } from '../core/layeredTypes'

export class CustomBlockTransformer extends MathJSLayeredTransformer {
  
  /**
   * 扩展 Blockly 到中间结构的转换
   */
  async blocklyToIntermediate(blocklyStructure: any): Promise<IntermediateStructure> {
    // 首先尝试父类转换
    try {
      return await super.blocklyToIntermediate(blocklyStructure)
    } catch (error) {
      // 如果父类无法处理，尝试自定义块转换
      return this.handleCustomBlock(blocklyStructure)
    }
  }
  
  /**
   * 处理自定义块类型
   */
  private async handleCustomBlock(blocklyStructure: any): Promise<IntermediateStructure> {
    const { type, fields, inputs } = blocklyStructure
    
    switch (type) {
      case 'custom_text_value':
        return this.createTextNode(fields.TEXT)
        
      case 'custom_number_value':
        return this.createNumberNode(fields.NUMBER)
        
      case 'custom_variable':
        return this.createVariableNode(fields.VAR)
        
      case 'custom_equal':
        return this.createEqualNode(inputs.A, inputs.B)
        
      case 'custom_contains':
        return this.createContainsNode(inputs.TEXT, inputs.SUBSTRING)
        
      case 'custom_number_compare':
        return this.createCompareNode(inputs.A, fields.OP, inputs.B)
        
      case 'custom_and':
        return this.createAndNode(inputs.A, inputs.B)
        
      case 'custom_or':
        return this.createOrNode(inputs.A, inputs.B)
        
      case 'custom_not':
        return this.createNotNode(inputs.BOOL)
        
      default:
        throw new Error(`未知的自定义块类型: ${type}`)
    }
  }
  
  /**
   * 创建文本节点
   */
  private createTextNode(text: string): IntermediateStructure {
    return {
      type: 'ConstantNode',
      value: text,
      valueType: 'string',
      raw: `"${text}"`
    }
  }
  
  /**
   * 创建数字节点
   */
  private createNumberNode(number: number): IntermediateStructure {
    return {
      type: 'ConstantNode',
      value: number,
      valueType: 'number',
      raw: number.toString()
    }
  }
  
  /**
   * 创建变量节点
   */
  private createVariableNode(variableName: string): IntermediateStructure {
    return {
      type: 'SymbolNode',
      name: variableName
    }
  }
  
  /**
   * 创建等于比较节点
   */
  private async createEqualNode(leftInput: any, rightInput: any): Promise<IntermediateStructure> {
    const left = await this.blocklyToIntermediate(leftInput)
    const right = await this.blocklyToIntermediate(rightInput)
    
    return {
      type: 'FunctionNode',
      fn: 'equalText',
      args: [left, right]
    }
  }
  
  /**
   * 创建包含检查节点
   */
  private async createContainsNode(textInput: any, substringInput: any): Promise<IntermediateStructure> {
    const text = await this.blocklyToIntermediate(textInput)
    const substring = await this.blocklyToIntermediate(substringInput)
    
    return {
      type: 'FunctionNode',
      fn: 'contains',
      args: [text, substring]
    }
  }
  
  /**
   * 创建数字比较节点
   */
  private async createCompareNode(leftInput: any, operator: string, rightInput: any): Promise<IntermediateStructure> {
    const left = await this.blocklyToIntermediate(leftInput)
    const right = await this.blocklyToIntermediate(rightInput)
    
    const operatorMap = {
      'EQ': '==',
      'NEQ': '!=',
      'GT': '>',
      'GTE': '>=',
      'LT': '<',
      'LTE': '<='
    }
    
    return {
      type: 'OperatorNode',
      fn: operatorMap[operator] || '==',
      args: [left, right]
    }
  }
  
  /**
   * 创建 AND 逻辑节点
   */
  private async createAndNode(leftInput: any, rightInput: any): Promise<IntermediateStructure> {
    const left = await this.blocklyToIntermediate(leftInput)
    const right = await this.blocklyToIntermediate(rightInput)
    
    return {
      type: 'OperatorNode',
      fn: 'and',
      args: [left, right]
    }
  }
  
  /**
   * 创建 OR 逻辑节点
   */
  private async createOrNode(leftInput: any, rightInput: any): Promise<IntermediateStructure> {
    const left = await this.blocklyToIntermediate(leftInput)
    const right = await this.blocklyToIntermediate(rightInput)
    
    return {
      type: 'OperatorNode',
      fn: 'or',
      args: [left, right]
    }
  }
  
  /**
   * 创建 NOT 逻辑节点
   */
  private async createNotNode(boolInput: any): Promise<IntermediateStructure> {
    const bool = await this.blocklyToIntermediate(boolInput)
    
    return {
      type: 'OperatorNode',
      fn: 'not',
      args: [bool]
    }
  }
  
  /**
   * 扩展中间结构到 Blockly 的转换
   */
  async intermediateToBlockly(intermediate: IntermediateStructure): Promise<any> {
    // 检查是否是自定义函数
    if (intermediate.type === 'FunctionNode') {
      switch (intermediate.fn) {
        case 'equalText':
          return this.createEqualBlockly(intermediate.args)
        case 'contains':
          return this.createContainsBlockly(intermediate.args)
      }
    }
    
    // 检查是否是自定义操作符
    if (intermediate.type === 'OperatorNode') {
      switch (intermediate.fn) {
        case 'and':
          return this.createAndBlockly(intermediate.args)
        case 'or':
          return this.createOrBlockly(intermediate.args)
        case 'not':
          return this.createNotBlockly(intermediate.args)
      }
    }
    
    // 使用父类处理其他情况
    return super.intermediateToBlockly(intermediate)
  }
  
  /**
   * 创建等于块的 Blockly 结构
   */
  private async createEqualBlockly(args: IntermediateStructure[]): Promise<any> {
    return {
      type: 'custom_equal',
      inputs: {
        A: await this.intermediateToBlockly(args[0]),
        B: await this.intermediateToBlockly(args[1])
      }
    }
  }
  
  /**
   * 创建包含块的 Blockly 结构
   */
  private async createContainsBlockly(args: IntermediateStructure[]): Promise<any> {
    return {
      type: 'custom_contains',
      inputs: {
        TEXT: await this.intermediateToBlockly(args[0]),
        SUBSTRING: await this.intermediateToBlockly(args[1])
      }
    }
  }
  
  /**
   * 创建 AND 块的 Blockly 结构
   */
  private async createAndBlockly(args: IntermediateStructure[]): Promise<any> {
    return {
      type: 'custom_and',
      inputs: {
        A: await this.intermediateToBlockly(args[0]),
        B: await this.intermediateToBlockly(args[1])
      }
    }
  }
  
  /**
   * 创建 OR 块的 Blockly 结构
   */
  private async createOrBlockly(args: IntermediateStructure[]): Promise<any> {
    return {
      type: 'custom_or',
      inputs: {
        A: await this.intermediateToBlockly(args[0]),
        B: await this.intermediateToBlockly(args[1])
      }
    }
  }
  
  /**
   * 创建 NOT 块的 Blockly 结构
   */
  private async createNotBlockly(args: IntermediateStructure[]): Promise<any> {
    return {
      type: 'custom_not',
      inputs: {
        BOOL: await this.intermediateToBlockly(args[0])
      }
    }
  }
}
```

## 🎨 工具箱配置

### 创建自定义工具箱

#### src/toolbox/customToolbox.ts
```typescript
export const customToolbox = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: '值',
      colour: 160,
      contents: [
        {
          kind: 'block',
          type: 'custom_text_value',
          fields: {
            TEXT: '示例文本'
          }
        },
        {
          kind: 'block',
          type: 'custom_number_value',
          fields: {
            NUMBER: 42
          }
        },
        {
          kind: 'block',
          type: 'custom_variable',
          fields: {
            VAR: 'myVariable'
          }
        }
      ]
    },
    {
      kind: 'category',
      name: '比较',
      colour: 210,
      contents: [
        {
          kind: 'block',
          type: 'custom_equal',
          inputs: {
            A: {
              block: {
                type: 'custom_text_value',
                fields: { TEXT: 'name' }
              }
            },
            B: {
              block: {
                type: 'custom_text_value',
                fields: { TEXT: 'John' }
              }
            }
          }
        },
        {
          kind: 'block',
          type: 'custom_contains',
          inputs: {
            TEXT: {
              block: {
                type: 'custom_variable',
                fields: { VAR: 'description' }
              }
            },
            SUBSTRING: {
              block: {
                type: 'custom_text_value',
                fields: { TEXT: '关键词' }
              }
            }
          }
        },
        {
          kind: 'block',
          type: 'custom_number_compare',
          fields: {
            OP: 'GT'
          },
          inputs: {
            A: {
              block: {
                type: 'custom_variable',
                fields: { VAR: 'age' }
              }
            },
            B: {
              block: {
                type: 'custom_number_value',
                fields: { NUMBER: 18 }
              }
            }
          }
        }
      ]
    },
    {
      kind: 'category',
      name: '逻辑',
      colour: 210,
      contents: [
        {
          kind: 'block',
          type: 'custom_and'
        },
        {
          kind: 'block',
          type: 'custom_or'
        },
        {
          kind: 'block',
          type: 'custom_not'
        }
      ]
    }
  ]
}
```

## 🔌 集成到应用

### 注册自定义块

#### src/main.ts
```typescript
import { createApp } from 'vue'
import App from './App.vue'

// 导入自定义块
import { registerValueBlocks } from './blocks/custom/valueBlocks'
import { registerComparisonBlocks } from './blocks/custom/comparisonBlocks'
import { registerLogicBlocks } from './blocks/custom/logicBlocks'

// 注册所有自定义块
registerValueBlocks()
registerComparisonBlocks()
registerLogicBlocks()

const app = createApp(App)
app.mount('#app')
```

### 使用自定义编辑器组件

#### src/components/CustomEditorComponent.vue
```vue
<template>
  <div class="custom-editor">
    <h2>自定义块编辑器</h2>
    
    <LayeredEditorComponent
      v-model="expression"
      :transformer="customTransformer"
      :toolbox="customToolbox"
      :show-debug-panel="showDebug"
      @update:model-value="handleExpressionChange"
    />
    
    <div class="controls">
      <button @click="showDebug = !showDebug">
        {{ showDebug ? '隐藏' : '显示' }}调试面板
      </button>
      
      <button @click="loadExample">加载示例</button>
      <button @click="clearExpression">清空表达式</button>
    </div>
    
    <div class="result">
      <h3>当前表达式：</h3>
      <pre><code>{{ expression }}</code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import LayeredEditorComponent from './LayeredEditorComponent.vue'
import { CustomBlockTransformer } from '../transformers/CustomBlockTransformer'
import { customToolbox } from '../toolbox/customToolbox'

// 创建自定义转换器
const customTransformer = new CustomBlockTransformer()

// 响应式数据
const expression = ref('')
const showDebug = ref(false)

// 事件处理
const handleExpressionChange = (newExpression: string) => {
  console.log('表达式已更新:', newExpression)
}

const loadExample = () => {
  expression.value = 'equalText(name, "Alice") and age > 25'
}

const clearExpression = () => {
  expression.value = ''
}
</script>

<style scoped>
.custom-editor {
  height: 100vh;
  padding: 20px;
}

.controls {
  margin: 20px 0;
  display: flex;
  gap: 10px;
}

.controls button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.controls button:hover {
  background: #f5f5f5;
}

.result {
  margin-top: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
}

.result pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.result code {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 14px;
}
</style>
```

## 🧪 测试自定义块

### 创建测试文件

#### tests/customBlocks.test.ts
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { CustomBlockTransformer } from '@/transformers/CustomBlockTransformer'

describe('CustomBlockTransformer', () => {
  let transformer: CustomBlockTransformer
  
  beforeEach(() => {
    transformer = new CustomBlockTransformer()
  })
  
  describe('自定义值块', () => {
    it('应该正确转换文本值块', async () => {
      const blocklyStructure = {
        type: 'custom_text_value',
        fields: { TEXT: 'Hello World' }
      }
      
      const intermediate = await transformer.blocklyToIntermediate(blocklyStructure)
      expect(intermediate.type).toBe('ConstantNode')
      expect(intermediate.value).toBe('Hello World')
      expect(intermediate.valueType).toBe('string')
    })
    
    it('应该正确转换数字值块', async () => {
      const blocklyStructure = {
        type: 'custom_number_value',
        fields: { NUMBER: 42 }
      }
      
      const intermediate = await transformer.blocklyToIntermediate(blocklyStructure)
      expect(intermediate.type).toBe('ConstantNode')
      expect(intermediate.value).toBe(42)
      expect(intermediate.valueType).toBe('number')
    })
  })
  
  describe('自定义比较块', () => {
    it('应该正确转换等于比较块', async () => {
      const blocklyStructure = {
        type: 'custom_equal',
        inputs: {
          A: { type: 'custom_text_value', fields: { TEXT: 'name' } },
          B: { type: 'custom_text_value', fields: { TEXT: 'John' } }
        }
      }
      
      const intermediate = await transformer.blocklyToIntermediate(blocklyStructure)
      expect(intermediate.type).toBe('FunctionNode')
      expect(intermediate.fn).toBe('equalText')
      expect(intermediate.args).toHaveLength(2)
    })
  })
  
  describe('往返转换', () => {
    it('应该支持完整的往返转换', async () => {
      const originalBlockly = {
        type: 'custom_and',
        inputs: {
          A: {
            type: 'custom_equal',
            inputs: {
              A: { type: 'custom_text_value', fields: { TEXT: 'name' } },
              B: { type: 'custom_text_value', fields: { TEXT: 'Alice' } }
            }
          },
          B: {
            type: 'custom_number_compare',
            fields: { OP: 'GT' },
            inputs: {
              A: { type: 'custom_variable', fields: { VAR: 'age' } },
              B: { type: 'custom_number_value', fields: { NUMBER: 18 } }
            }
          }
        }
      }
      
      // Blockly → 中间结构
      const intermediate = await transformer.blocklyToIntermediate(originalBlockly)
      
      // 中间结构 → 代码
      const code = await transformer.intermediateToCode(intermediate)
      expect(code).toBe('equalText(name, "Alice") and age > 18')
      
      // 代码 → 中间结构 → Blockly
      const backToIntermediate = await transformer.codeToIntermediate(code)
      const backToBlockly = await transformer.intermediateToBlockly(backToIntermediate)
      
      expect(backToBlockly.type).toBe('custom_and')
    })
  })
})
```

### 调试脚本

#### debug-scripts/debug-custom-blocks.js
```javascript
import { CustomBlockTransformer } from '../src/transformers/CustomBlockTransformer.js'

async function debugCustomBlocks() {
  console.log('🧩 自定义块调试测试\n')
  
  const transformer = new CustomBlockTransformer()
  
  // 测试不同类型的自定义块
  const testBlocks = [
    {
      name: '文本值块',
      block: {
        type: 'custom_text_value',
        fields: { TEXT: 'Hello' }
      }
    },
    {
      name: '数字值块',
      block: {
        type: 'custom_number_value',
        fields: { NUMBER: 42 }
      }
    },
    {
      name: '等于比较块',
      block: {
        type: 'custom_equal',
        inputs: {
          A: { type: 'custom_text_value', fields: { TEXT: 'name' } },
          B: { type: 'custom_text_value', fields: { TEXT: 'John' } }
        }
      }
    },
    {
      name: '复合逻辑块',
      block: {
        type: 'custom_and',
        inputs: {
          A: {
            type: 'custom_equal',
            inputs: {
              A: { type: 'custom_text_value', fields: { TEXT: 'status' } },
              B: { type: 'custom_text_value', fields: { TEXT: 'active' } }
            }
          },
          B: {
            type: 'custom_number_compare',
            fields: { OP: 'GT' },
            inputs: {
              A: { type: 'custom_variable', fields: { VAR: 'score' } },
              B: { type: 'custom_number_value', fields: { NUMBER: 80 } }
            }
          }
        }
      }
    }
  ]
  
  for (const test of testBlocks) {
    console.log(`📝 测试: ${test.name}`)
    
    try {
      // 转换为中间结构
      const intermediate = await transformer.blocklyToIntermediate(test.block)
      console.log('🌳 中间结构:', JSON.stringify(intermediate, null, 2))
      
      // 转换为代码
      const code = await transformer.intermediateToCode(intermediate)
      console.log(`📄 生成代码: ${code}`)
      
      // 往返测试
      const backToIntermediate = await transformer.codeToIntermediate(code)
      const backToBlockly = await transformer.intermediateToBlockly(backToIntermediate)
      console.log('🔄 往返成功:', JSON.stringify(backToBlockly, null, 2))
      
      console.log('✅ 测试通过\n')
      
    } catch (error) {
      console.error(`❌ 测试失败: ${error.message}\n`)
    }
  }
}

debugCustomBlocks()
```

## 📚 最佳实践

### 1. 块设计原则
- **单一职责**: 每个块只做一件事
- **清晰命名**: 使用描述性的块名称和字段名
- **类型安全**: 正确设置输入输出类型检查
- **用户友好**: 提供清晰的提示信息和帮助文档

### 2. 颜色约定
```typescript
const COLOR_SCHEME = {
  values: 160,      // 绿色 - 值类型块
  logic: 210,       // 蓝色 - 逻辑操作块
  math: 230,        // 橙色 - 数学运算块
  text: 160,        // 绿色 - 文本操作块
  variables: 330,   // 紫色 - 变量块
  functions: 290    // 深蓝色 - 函数块
}
```

### 3. 错误处理
```typescript
// 在转换器中添加详细的错误信息
private handleCustomBlock(blocklyStructure: any): IntermediateStructure {
  const { type } = blocklyStructure
  
  if (!type) {
    throw new Error('块结构缺少 type 字段')
  }
  
  if (!this.isCustomBlockType(type)) {
    throw new Error(`未知的自定义块类型: ${type}。请确保已正确注册该块。`)
  }
  
  // ... 处理逻辑
}
```

### 4. 性能优化
```typescript
// 缓存转换结果
private conversionCache = new Map<string, IntermediateStructure>()

async blocklyToIntermediate(blocklyStructure: any): Promise<IntermediateStructure> {
  const cacheKey = JSON.stringify(blocklyStructure)
  
  if (this.conversionCache.has(cacheKey)) {
    return this.conversionCache.get(cacheKey)!
  }
  
  const result = await this.performConversion(blocklyStructure)
  this.conversionCache.set(cacheKey, result)
  
  return result
}
```

## 🚀 下一步

1. **扩展更多块类型**: 根据具体需求添加更多自定义块
2. **优化用户体验**: 添加块的预览、提示和验证
3. **集成测试**: 编写更全面的集成测试
4. **文档完善**: 为每个自定义块编写详细的使用文档

查看更多资源：
- [高级块开发](./advanced-blocks.md)
- [性能优化指南](./performance.md)
- [故障排除](./troubleshooting.md)
