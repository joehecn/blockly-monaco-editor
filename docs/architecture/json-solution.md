# JSON 结构桥接方案

## 概述

JSON 结构桥接方案是最简单直观的数据转换方案，适用于配置文件编辑和数据结构可视化。

```
blockly <-> blockly结构(Object) <-> json结构(Object) <-> code(String) <-> monaco
```

## 数据流详解

### 第一层：Blockly 结构 → JSON 结构
```typescript
// Blockly 块结构
const blocklyStructure = {
  type: 'object',
  id: 'obj_1',
  fields: {
    name: 'user',
    properties: [
      { type: 'string', name: 'username' },
      { type: 'number', name: 'age' }
    ]
  }
}

// 转换为 JSON 中间结构
const jsonIntermediate = {
  type: 'json',
  version: '1.0',
  data: {
    user: {
      username: 'string',
      age: 'number'
    }
  },
  metadata: {
    timestamp: Date.now(),
    schema: 'object-definition'
  }
}
```

### 第二层：JSON 结构 → 代码字符串
```typescript
// JSON 中间结构转换为代码
const codeString = JSON.stringify(jsonIntermediate.data, null, 2)
```

## 转换器实现

### JsonLayeredTransformer

```typescript
import type { LayeredTransformer, JsonIntermediate } from '../core/layeredTypes'

export class JsonLayeredTransformer implements LayeredTransformer<JsonIntermediate> {
  
  // 对象层转换
  blocklyToIntermediate(blocklyStructure: any): JsonIntermediate {
    return {
      type: 'json',
      version: '1.0',
      data: this.extractDataFromBlockly(blocklyStructure),
      metadata: {
        timestamp: Date.now(),
        source: 'blockly'
      }
    }
  }

  intermediateToBlockly(intermediate: JsonIntermediate): any {
    return this.createBlocklyFromData(intermediate.data)
  }

  // 序列化层转换
  intermediateToCode(intermediate: JsonIntermediate): string {
    return JSON.stringify(intermediate.data, null, 2)
  }

  codeToIntermediate(code: string): JsonIntermediate | null {
    try {
      const data = JSON.parse(code)
      return {
        type: 'json',
        version: '1.0',
        data,
        metadata: {
          timestamp: Date.now(),
          source: 'monaco'
        }
      }
    } catch (error) {
      return null
    }
  }

  // 验证和格式化
  validateIntermediate(intermediate: JsonIntermediate): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (intermediate.type !== 'json') {
      errors.push('Invalid type, expected "json"')
    }
    
    if (!intermediate.data) {
      errors.push('Data is missing')
    }
    
    return { valid: errors.length === 0, errors }
  }

  formatCode(code: string): string {
    try {
      const parsed = JSON.parse(code)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return code
    }
  }
}
```

## Blockly 块定义

### 基础数据类型块

```typescript
// 字符串块
Blockly.defineBlocksWithJsonArray([{
  type: 'json_string',
  message0: 'String: %1',
  args0: [{ type: 'field_input', name: 'VALUE', text: '' }],
  output: 'String',
  colour: 160
}])

// 数字块
Blockly.defineBlocksWithJsonArray([{
  type: 'json_number',
  message0: 'Number: %1',
  args0: [{ type: 'field_number', name: 'VALUE', value: 0 }],
  output: 'Number',
  colour: 230
}])

// 布尔块
Blockly.defineBlocksWithJsonArray([{
  type: 'json_boolean',
  message0: 'Boolean: %1',
  args0: [{ type: 'field_dropdown', name: 'VALUE', options: [['true', 'true'], ['false', 'false']] }],
  output: 'Boolean',
  colour: 120
}])
```

### 复合数据类型块

```typescript
// 对象块
Blockly.defineBlocksWithJsonArray([{
  type: 'json_object',
  message0: 'Object %1 %2',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'PROPERTIES', check: 'Property' }
  ],
  output: 'Object',
  colour: 290
}])

// 属性块
Blockly.defineBlocksWithJsonArray([{
  type: 'json_property',
  message0: '%1 : %2',
  args0: [
    { type: 'field_input', name: 'KEY', text: 'key' },
    { type: 'input_value', name: 'VALUE' }
  ],
  previousStatement: 'Property',
  nextStatement: 'Property',
  colour: 290
}])

// 数组块
Blockly.defineBlocksWithJsonArray([{
  type: 'json_array',
  message0: 'Array %1 %2',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'ITEMS', check: 'ArrayItem' }
  ],
  output: 'Array',
  colour: 260
}])
```

## 代码生成器

```typescript
import * as Blockly from 'blockly/core'

export const jsonGenerator = new Blockly.CodeGenerator('JSON')

// 字符串生成器
jsonGenerator.forBlock['json_string'] = function(block) {
  const value = block.getFieldValue('VALUE')
  return [JSON.stringify(value), jsonGenerator.ORDER_ATOMIC]
}

// 数字生成器
jsonGenerator.forBlock['json_number'] = function(block) {
  const value = parseFloat(block.getFieldValue('VALUE'))
  return [value.toString(), jsonGenerator.ORDER_ATOMIC]
}

// 对象生成器
jsonGenerator.forBlock['json_object'] = function(block, generator) {
  const properties = generator.statementToCode(block, 'PROPERTIES')
  const code = `{\n${properties}\n}`
  return [code, jsonGenerator.ORDER_ATOMIC]
}

// 属性生成器
jsonGenerator.forBlock['json_property'] = function(block, generator) {
  const key = block.getFieldValue('KEY')
  const value = generator.valueToCode(block, 'VALUE', jsonGenerator.ORDER_ATOMIC) || 'null'
  return `  "${key}": ${value}`
}
```

## Monaco 配置

### JSON 语言支持

```typescript
import * as monaco from 'monaco-editor'

// 配置 JSON 语言
monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
  validate: true,
  allowComments: false,
  schemas: [{
    uri: 'http://myserver/foo-schema.json',
    fileMatch: ['*'],
    schema: {
      type: 'object',
      properties: {
        // 自定义 JSON Schema
      }
    }
  }]
})

// 设置编辑器选项
const editorOptions = {
  language: 'json',
  theme: 'vs-light',
  automaticLayout: true,
  formatOnPaste: true,
  formatOnType: true,
  minimap: { enabled: false }
}
```

### 语法高亮和验证

```typescript
// 自定义 JSON 主题
monaco.editor.defineTheme('json-theme', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'string.key.json', foreground: '0451a5' },
    { token: 'string.value.json', foreground: 'a31515' },
    { token: 'number.json', foreground: '098658' },
    { token: 'keyword.json', foreground: '0000ff' }
  ],
  colors: {}
})
```

## 高亮映射

### JSON 高亮映射器

```typescript
export class JsonHighlightMapper implements LayeredHighlightMapper<JsonIntermediate> {
  
  createIntermediateToCodeMapping(intermediate: JsonIntermediate, code: string): Map<string, Position> {
    const mapping = new Map<string, Position>()
    
    // 解析 JSON 字符串，创建位置映射
    this.parseJsonWithPositions(code, mapping)
    
    return mapping
  }

  createBlocklyToIntermediateMapping(blockly: any, intermediate: JsonIntermediate): Map<string, string> {
    const mapping = new Map<string, string>()
    
    // 遍历 Blockly 结构，创建到中间结构的映射
    this.traverseBlocklyStructure(blockly, intermediate, mapping)
    
    return mapping
  }

  private parseJsonWithPositions(json: string, mapping: Map<string, Position>): void {
    // 实现 JSON 解析和位置映射
    let position = 0
    let depth = 0
    
    for (let i = 0; i < json.length; i++) {
      const char = json[i]
      
      switch (char) {
        case '{':
        case '[':
          depth++
          break
        case '}':
        case ']':
          depth--
          break
        case '"':
          // 处理字符串的位置映射
          const stringEnd = this.findStringEnd(json, i)
          mapping.set(`string_${position}`, { startPos: i, endPos: stringEnd })
          i = stringEnd
          break
      }
    }
  }
}
```

## 使用示例

### 基础使用

```vue
<template>
  <LayeredEditorComponent
    v-model="jsonData"
    :transformer="jsonTransformer"
    :highlight-mapper="jsonMapper"
  />
</template>

<script setup>
import { ref } from 'vue'
import { JsonLayeredTransformer } from './transformers/JsonLayeredTransformer'
import { JsonHighlightMapper } from './highlightMappers/JsonHighlightMapper'

const jsonData = ref('{\n  "name": "example",\n  "value": 42\n}')
const jsonTransformer = new JsonLayeredTransformer()
const jsonMapper = new JsonHighlightMapper()
</script>
```

### 高级配置

```typescript
// 自定义 JSON 转换器
class CustomJsonTransformer extends JsonLayeredTransformer {
  
  protected extractDataFromBlockly(blocklyStructure: any): any {
    // 自定义 Blockly 到 JSON 的转换逻辑
    return super.extractDataFromBlockly(blocklyStructure)
  }

  protected createBlocklyFromData(data: any): any {
    // 自定义 JSON 到 Blockly 的转换逻辑
    return super.createBlocklyFromData(data)
  }
}

// 使用自定义转换器
const customTransformer = new CustomJsonTransformer()
const dataFlow = new LayeredDataFlowManager(customTransformer)
```

## 最佳实践

### 1. 数据验证
- 在转换前验证 Blockly 结构
- 使用 JSON Schema 验证 Monaco 输入
- 提供清晰的错误信息

### 2. 性能优化
- 缓存转换结果
- 使用增量更新
- 避免不必要的重新解析

### 3. 用户体验
- 提供实时预览
- 支持撤销/重做
- 智能代码补全

## 扩展点

1. **自定义块类型**：添加新的 JSON 数据类型支持
2. **Schema 验证**：集成 JSON Schema 验证
3. **格式化选项**：提供多种 JSON 格式化风格
4. **导入导出**：支持多种数据格式的导入导出
