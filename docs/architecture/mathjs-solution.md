# MathJS AST 桥接方案

## 概述

MathJS AST 桥接方案专门用于数学表达式的处理，支持复杂的数学运算和函数。这是当前项目的重点实现方案。

```
blockly <-> blockly结构(Object) <-> mathjs ast结构(Object) <-> code(String) <-> monaco
```

## 数据流详解

### 第一层：Blockly 结构 → MathJS AST 结构

```typescript
// Blockly 数学表达式结构
const blocklyStructure = {
  type: 'function_call',
  id: 'func_1',
  fields: { FUNC: 'equalText' },
  inputs: {
    ARGS: [
      { type: 'symbol', value: 'name' },
      { type: 'string', value: '"John"' }
    ]
  }
}

// 转换为 MathJS 中间结构
const mathjsIntermediate = {
  type: 'mathjs',
  version: '1.0',
  ast: {
    type: 'FunctionNode',
    fn: 'equalText',
    args: [
      { type: 'SymbolNode', name: 'name' },
      { type: 'ConstantNode', value: 'John' }
    ]
  },
  functions: ['equalText'],
  variables: ['name'],
  metadata: {
    originalExpression: 'equalText(name, "John")',
    complexity: 'simple',
    timestamp: Date.now()
  }
}
```

### 第二层：MathJS AST 结构 → 代码字符串

```typescript
// MathJS AST 转换为表达式字符串
import { format } from 'mathjs'

const codeString = format(mathjsIntermediate.ast, { 
  notation: 'auto',
  precision: 14 
})
// 结果: "equalText(name, \"John\")"
```

## 转换器实现

### MathJSLayeredTransformer

```typescript
import { parse, format } from 'mathjs'
import type { LayeredTransformer, MathJSIntermediate } from '../core/layeredTypes'

export class MathJSLayeredTransformer implements LayeredTransformer<MathJSIntermediate> {
  
  // 对象层转换
  blocklyToIntermediate(blocklyStructure: any): MathJSIntermediate {
    try {
      // 从 Blockly 结构生成表达式字符串
      const expression = this.generateExpressionFromBlockly(blocklyStructure)
      
      // 解析为 MathJS AST
      const ast = expression ? parse(expression) : null
      
      return {
        type: 'mathjs',
        version: '1.0',
        ast,
        functions: this.extractFunctions(expression),
        variables: this.extractVariables(expression),
        metadata: {
          originalExpression: expression,
          blocklyType: blocklyStructure?.type,
          timestamp: Date.now()
        }
      }
    } catch (error) {
      return this.createEmptyIntermediate()
    }
  }

  intermediateToBlockly(intermediate: MathJSIntermediate): any {
    try {
      if (!intermediate.ast) {
        return this.createEmptyBlocklyStructure()
      }
      
      // 将 MathJS AST 转换为 Blockly 结构
      return this.astToBlocklyStructure(intermediate.ast)
    } catch (error) {
      return this.createEmptyBlocklyStructure()
    }
  }

  // 序列化层转换
  intermediateToCode(intermediate: MathJSIntermediate): string {
    try {
      if (!intermediate.ast) {
        return ''
      }
      
      // 使用 MathJS 的格式化功能
      return format(intermediate.ast, { 
        notation: 'auto',
        precision: 14
      })
    } catch (error) {
      return intermediate.metadata?.originalExpression || ''
    }
  }

  codeToIntermediate(code: string): MathJSIntermediate | null {
    try {
      if (!code.trim()) {
        return this.createEmptyIntermediate()
      }
      
      const ast = parse(code)
      
      return {
        type: 'mathjs',
        version: '1.0',
        ast,
        functions: this.extractFunctions(code),
        variables: this.extractVariables(code),
        metadata: {
          originalExpression: code,
          timestamp: Date.now()
        }
      }
    } catch (error) {
      return null
    }
  }
}
```

## Blockly 块定义

### 数学运算块

```typescript
// 数字块
Blockly.defineBlocksWithJsonArray([{
  type: 'math_number',
  message0: '%1',
  args0: [{ type: 'field_number', name: 'NUM', value: 0 }],
  output: 'Number',
  colour: 230,
  helpUrl: '%{BKY_MATH_NUMBER_HELPURL}',
  tooltip: '%{BKY_MATH_NUMBER_TOOLTIP}',
  extensions: ['parent_tooltip_when_inline']
}])

// 算术运算块
Blockly.defineBlocksWithJsonArray([{
  type: 'math_arithmetic',
  message0: '%1 %2 %3',
  args0: [
    { type: 'input_value', name: 'A', check: 'Number' },
    { type: 'field_dropdown', name: 'OP', options: [
      ['+', 'ADD'],
      ['-', 'MINUS'],
      ['×', 'MULTIPLY'],
      ['÷', 'DIVIDE'],
      ['^', 'POWER']
    ]},
    { type: 'input_value', name: 'B', check: 'Number' }
  ],
  inputsInline: true,
  output: 'Number',
  colour: 230
}])

// 变量块
Blockly.defineBlocksWithJsonArray([{
  type: 'variables_get',
  message0: '%1',
  args0: [{ type: 'field_variable', name: 'VAR', variable: 'item' }],
  output: null,
  colour: 330
}])
```

### 函数块

```typescript
// equalText 函数块
Blockly.defineBlocksWithJsonArray([{
  type: 'function_equaltext',
  message0: 'equalText(%1, %2)',
  args0: [
    { type: 'input_value', name: 'VALUE1', check: ['String', 'Variable'] },
    { type: 'input_value', name: 'VALUE2', check: ['String', 'Variable'] }
  ],
  output: 'Boolean',
  colour: 120,
  tooltip: '检查两个值是否相等'
}])

// 逻辑运算块
Blockly.defineBlocksWithJsonArray([{
  type: 'logic_operation',
  message0: '%1 %2 %3',
  args0: [
    { type: 'input_value', name: 'A', check: 'Boolean' },
    { type: 'field_dropdown', name: 'OP', options: [
      ['and', 'AND'],
      ['or', 'OR']
    ]},
    { type: 'input_value', name: 'B', check: 'Boolean' }
  ],
  inputsInline: true,
  output: 'Boolean',
  colour: 120
}])

// 字符串块
Blockly.defineBlocksWithJsonArray([{
  type: 'text',
  message0: '"%1"',
  args0: [{ type: 'field_input', name: 'TEXT', text: '' }],
  output: 'String',
  colour: 160
}])
```

## 代码生成器

```typescript
import * as Blockly from 'blockly/core'

export const expressionGenerator = new Blockly.CodeGenerator('Expression')

const Order = {
  ATOMIC: 0,
  FUNCTION_CALL: 1,
  POWER: 2,
  UNARY_SIGN: 3,
  MULTIPLICATIVE: 4,
  ADDITIVE: 5,
  RELATIONAL: 6,
  LOGICAL_AND: 7,
  LOGICAL_OR: 8,
  NONE: 99
}

// 数字块生成器
expressionGenerator.forBlock['math_number'] = function (block) {
  const code = String(parseFloat(block.getFieldValue('NUM')))
  return [code, Order.ATOMIC]
}

// 算术运算生成器
expressionGenerator.forBlock['math_arithmetic'] = function (block, generator) {
  const OPERATORS: Record<string, [string, number]> = {
    'ADD': [' + ', Order.ADDITIVE],
    'MINUS': [' - ', Order.ADDITIVE],
    'MULTIPLY': [' * ', Order.MULTIPLICATIVE],
    'DIVIDE': [' / ', Order.MULTIPLICATIVE],
    'POWER': [' ^ ', Order.POWER]
  }
  
  const tuple = OPERATORS[block.getFieldValue('OP')]
  const operator = tuple[0]
  const order = tuple[1]
  
  const argument0 = generator.valueToCode(block, 'A', order) || '0'
  const argument1 = generator.valueToCode(block, 'B', order) || '0'
  
  const code = `(${argument0}${operator}${argument1})`
  return [code, order]
}

// equalText 函数生成器
expressionGenerator.forBlock['function_equaltext'] = function (block, generator) {
  const value1 = generator.valueToCode(block, 'VALUE1', Order.NONE) || '""'
  const value2 = generator.valueToCode(block, 'VALUE2', Order.NONE) || '""'
  
  const code = `equalText(${value1}, ${value2})`
  return [code, Order.FUNCTION_CALL]
}

// 逻辑运算生成器
expressionGenerator.forBlock['logic_operation'] = function (block, generator) {
  const operator = block.getFieldValue('OP') === 'AND' ? ' and ' : ' or '
  const order = block.getFieldValue('OP') === 'AND' ? Order.LOGICAL_AND : Order.LOGICAL_OR
  
  const argument0 = generator.valueToCode(block, 'A', order) || 'false'
  const argument1 = generator.valueToCode(block, 'B', order) || 'false'
  
  const code = `(${argument0}${operator}${argument1})`
  return [code, order]
}

// 变量生成器
expressionGenerator.forBlock['variables_get'] = function (block) {
  const code = block.getFieldValue('VAR')
  return [code, Order.ATOMIC]
}

// 字符串生成器
expressionGenerator.forBlock['text'] = function (block) {
  const code = `"${block.getFieldValue('TEXT')}"`
  return [code, Order.ATOMIC]
}
```

## Monaco 配置

### 自定义语言支持

```typescript
import * as monaco from 'monaco-editor'

// 注册自定义语言
monaco.languages.register({ id: 'mathexpression' })

// 定义语法高亮规则
monaco.languages.setMonarchTokensProvider('mathexpression', {
  tokenizer: {
    root: [
      // 函数名
      [/\b(equalText|sin|cos|tan|log|sqrt|abs)\b/, 'function'],
      
      // 逻辑操作符
      [/\b(and|or|not)\b/, 'keyword'],
      
      // 数字
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/\d+/, 'number'],
      
      // 字符串
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string'],
      
      // 变量名
      [/[a-zA-Z_][a-zA-Z0-9_]*/, 'variable'],
      
      // 操作符
      [/[+\-*/^]/, 'operator'],
      [/[()[\]]/, 'bracket'],
      [/[,;]/, 'delimiter']
    ],
    
    string: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop']
    ]
  }
})

// 定义主题
monaco.editor.defineTheme('mathexpression-theme', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'function', foreground: '795E26' },
    { token: 'keyword', foreground: '0000FF' },
    { token: 'number', foreground: '098658' },
    { token: 'string', foreground: 'A31515' },
    { token: 'variable', foreground: '001080' },
    { token: 'operator', foreground: '000000' }
  ],
  colors: {}
})
```

### 自动补全

```typescript
// 注册自动补全提供器
monaco.languages.registerCompletionItemProvider('mathexpression', {
  provideCompletionItems: (model, position) => {
    const suggestions = [
      {
        label: 'equalText',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'equalText(${1:value1}, ${2:value2})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: '检查两个值是否相等'
      },
      {
        label: 'and',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'and',
        documentation: '逻辑与操作符'
      },
      {
        label: 'or',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'or',
        documentation: '逻辑或操作符'
      }
    ]
    
    return { suggestions }
  }
})
```

## 高亮映射

### MathJS 高亮映射器

当前实现基于 `src/utils/astHighlightMapper.ts`，已重构为分层架构：

```typescript
export class MathJSHighlightMapper implements LayeredHighlightMapper<MathJSIntermediate> {
  
  createIntermediateToCodeMapping(intermediate: MathJSIntermediate, code: string): Map<string, Position> {
    const mapping = new Map<string, Position>()
    
    if (!intermediate.ast || !code) {
      return mapping
    }

    try {
      const rootNode = this.addPositionToNode(intermediate.ast, code, 0)
      if (rootNode) {
        this.collectPositions(rootNode, mapping)
      }
    } catch (error) {
      console.error('Failed to create mapping:', error)
    }

    return mapping
  }

  private addPositionToNode(node: any, fullExpression: string, currentOffset: number): ASTNodeWithPosition {
    const nodeId = this.generateNodeId()
    let startPos = currentOffset
    let endPos = currentOffset
    const children: ASTNodeWithPosition[] = []

    switch (node.type) {
      case 'ConstantNode':
        const valueStr = String(node.value)
        let valueIndex = fullExpression.indexOf(valueStr, currentOffset)
        
        if (valueIndex >= 0) {
          startPos = valueIndex
          endPos = valueIndex + valueStr.length - 1
        }
        break

      case 'SymbolNode':
        const symbolIndex = fullExpression.indexOf(node.name, currentOffset)
        if (symbolIndex >= 0) {
          startPos = symbolIndex
          endPos = symbolIndex + node.name.length - 1
        }
        break

      case 'FunctionNode':
        const funcName = node.fn?.name || node.fn
        const funcIndex = fullExpression.indexOf(funcName, currentOffset)
        if (funcIndex >= 0) {
          startPos = funcIndex
          const openParenIndex = fullExpression.indexOf('(', funcIndex)
          let closeParenIndex = this.findMatchingParen(fullExpression, openParenIndex)
          if (closeParenIndex < 0) {
            closeParenIndex = fullExpression.length - 1
          }
          endPos = closeParenIndex

          // 处理函数参数
          if (node.args && node.args.length > 0) {
            let argOffset = openParenIndex + 1
            node.args.forEach((arg: any, index: number) => {
              const argNode = this.addPositionToNode(arg, fullExpression, argOffset)
              children.push(argNode)
              argOffset = argNode.endPos + 1
              
              if (index < node.args.length - 1) {
                const commaIndex = fullExpression.indexOf(',', argOffset)
                if (commaIndex > 0) {
                  argOffset = commaIndex + 1
                }
              }
            })
          }
        }
        break

      case 'OperatorNode':
        if (node.args && node.args.length >= 2) {
          const leftArg = this.addPositionToNode(node.args[0], fullExpression, currentOffset)
          children.push(leftArg)
          
          const operatorIndex = fullExpression.indexOf(node.op, leftArg.endPos + 1)
          const rightArg = this.addPositionToNode(node.args[1], fullExpression, operatorIndex + node.op.length)
          children.push(rightArg)
          
          startPos = leftArg.startPos
          endPos = rightArg.endPos
        }
        break
    }

    return {
      id: nodeId,
      type: node.type,
      startPos,
      endPos,
      children,
      originalNode: node
    }
  }
}
```

## 复杂表达式处理

### 嵌套表达式示例

```typescript
// 复杂的嵌套表达式
const complexExpression = `
equalText(absence, "absence") and 
(equalText(absence_1, "absence") and 
 (equalText(absence_2, "absence") and 
  equalText(absence_3, "absence")))
`

// Blockly 结构表示
const complexBlocklyStructure = {
  type: 'logic_operation',
  fields: { OP: 'AND' },
  inputs: {
    A: {
      type: 'function_equaltext',
      inputs: {
        VALUE1: { type: 'variables_get', fields: { VAR: 'absence' } },
        VALUE2: { type: 'text', fields: { TEXT: 'absence' } }
      }
    },
    B: {
      type: 'logic_operation',
      fields: { OP: 'AND' },
      inputs: {
        // 更多嵌套结构...
      }
    }
  }
}
```

### 性能优化

```typescript
// 缓存转换结果
class OptimizedMathJSTransformer extends MathJSLayeredTransformer {
  private cache = new Map<string, MathJSIntermediate>()
  
  codeToIntermediate(code: string): MathJSIntermediate | null {
    // 检查缓存
    const cached = this.cache.get(code)
    if (cached) {
      return { ...cached, metadata: { ...cached.metadata, timestamp: Date.now() } }
    }
    
    // 正常转换
    const result = super.codeToIntermediate(code)
    if (result) {
      this.cache.set(code, result)
    }
    
    return result
  }
  
  // 清理缓存
  clearCache(): void {
    this.cache.clear()
  }
}
```

## 错误处理

### 语法错误检测

```typescript
export class MathJSErrorHandler {
  
  static validateExpression(expression: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    try {
      parse(expression)
    } catch (error) {
      errors.push(`语法错误: ${error.message}`)
    }
    
    // 检查函数调用
    const functionCalls = expression.match(/\b\w+\s*\(/g)
    if (functionCalls) {
      functionCalls.forEach(call => {
        const funcName = call.replace(/\s*\($/, '')
        if (!this.isValidFunction(funcName)) {
          errors.push(`未知函数: ${funcName}`)
        }
      })
    }
    
    // 检查括号匹配
    if (!this.checkBracketMatching(expression)) {
      errors.push('括号不匹配')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }
  
  private static isValidFunction(name: string): boolean {
    const validFunctions = ['equalText', 'sin', 'cos', 'tan', 'log', 'sqrt', 'abs']
    return validFunctions.includes(name)
  }
  
  private static checkBracketMatching(expression: string): boolean {
    let openCount = 0
    for (const char of expression) {
      if (char === '(') openCount++
      if (char === ')') openCount--
      if (openCount < 0) return false
    }
    return openCount === 0
  }
}
```

## 使用示例

### 基础数学表达式编辑器

```vue
<template>
  <LayeredEditorComponent
    v-model="mathExpression"
    :transformer="mathTransformer"
    :highlight-mapper="mathMapper"
    :show-debug-panel="true"
  />
</template>

<script setup>
import { ref } from 'vue'
import { MathJSLayeredTransformer } from './transformers/MathJSLayeredTransformer'
import { MathJSHighlightMapper } from './highlightMappers/MathJSHighlightMapper'

const mathExpression = ref('equalText(name, "John") and age > 18')
const mathTransformer = new MathJSLayeredTransformer()
const mathMapper = new MathJSHighlightMapper()
</script>
```

### 高级配置和扩展

```typescript
// 扩展 MathJS 函数
import { create, all } from 'mathjs'

const math = create(all)

// 添加自定义函数
math.import({
  customFunction: function(x: number): number {
    return x * 2 + 1
  }
}, { override: true })

// 使用扩展的 MathJS 实例
class ExtendedMathJSTransformer extends MathJSLayeredTransformer {
  protected parseMathExpression(expression: string) {
    return math.parse(expression)
  }
  
  protected formatMathExpression(ast: any): string {
    return math.format(ast)
  }
}
```

## 最佳实践

### 1. 表达式复杂度管理
- 限制嵌套深度
- 优化长表达式的显示
- 提供表达式简化功能

### 2. 用户体验优化
- 实时语法检查
- 智能错误提示
- 表达式预览和求值

### 3. 性能考虑
- 使用增量解析
- 缓存 AST 转换结果
- 延迟加载复杂表达式

### 4. 扩展性设计
- 支持自定义函数
- 可配置的操作符优先级
- 插件化的语法扩展
