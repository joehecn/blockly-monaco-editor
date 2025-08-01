/**
 * MathJS 表达式转换器 - 实现 Blockly ↔ MathJS AST ↔ Monaco 的转换
 */
import { parse, format } from 'mathjs'
import type { AbstractTransformer } from '../core/types'

export interface MathJSData {
  type: 'mathjs'
  ast: any  // MathJS AST
  expression: string
  metadata?: {
    version: string
    timestamp: number
    functions: string[]
  }
}

export class MathJSTransformer implements AbstractTransformer<MathJSData> {
  fromBlockly(blocklyData: any): MathJSData {
    try {
      // 假设 blocklyData 包含生成的表达式
      const expression = typeof blocklyData === 'string' ? blocklyData : ''
      const ast = expression ? parse(expression) : null

      return {
        type: 'mathjs',
        ast,
        expression,
        metadata: {
          version: '1.0',
          timestamp: Date.now(),
          functions: this.extractFunctions(expression)
        }
      }
    } catch (error) {
      console.error('Failed to convert from Blockly:', error)
      return {
        type: 'mathjs',
        ast: null,
        expression: '',
        metadata: {
          version: '1.0',
          timestamp: Date.now(),
          functions: []
        }
      }
    }
  }

  toMonaco(data: MathJSData): string {
    try {
      if (data.ast) {
        // 使用 MathJS 格式化功能
        return format(data.ast, { notation: 'auto' })
      }
      return data.expression || ''
    } catch (error) {
      console.error('Failed to convert to Monaco:', error)
      return data.expression || ''
    }
  }

  fromMonaco(text: string): MathJSData | null {
    try {
      const ast = parse(text)
      return {
        type: 'mathjs',
        ast,
        expression: text,
        metadata: {
          version: '1.0',
          timestamp: Date.now(),
          functions: this.extractFunctions(text)
        }
      }
    } catch (error) {
      console.error('Failed to parse Monaco content:', error)
      return null
    }
  }

  toBlockly(data: MathJSData): any {
    // 这里需要将 MathJS AST 转换回 Blockly 结构
    // 这是一个复杂的过程，需要遍历 AST 并创建对应的块
    return {
      type: 'expression',
      expression: data.expression,
      ast: data.ast
    }
  }

  validate(data: MathJSData): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!data) {
      errors.push('Data is null or undefined')
      return { valid: false, errors }
    }

    if (data.type !== 'mathjs') {
      errors.push('Invalid data type, expected "mathjs"')
    }

    if (!data.expression && !data.ast) {
      errors.push('Neither expression nor AST is provided')
    }

    // 验证表达式语法
    if (data.expression) {
      try {
        parse(data.expression)
      } catch (error) {
        errors.push(`Invalid expression syntax: ${error}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  format(data: MathJSData): MathJSData {
    try {
      const formattedExpression = data.ast ? format(data.ast, { notation: 'auto' }) : data.expression
      return {
        ...data,
        expression: formattedExpression,
        metadata: {
          version: data.metadata?.version || '1.0',
          timestamp: Date.now(),
          functions: this.extractFunctions(formattedExpression)
        }
      }
    } catch (error) {
      console.error('Failed to format data:', error)
      return data
    }
  }

  private extractFunctions(expression: string): string[] {
    const functions: string[] = []
    const functionRegex = /(\w+)\s*\(/g
    let match

    while ((match = functionRegex.exec(expression)) !== null) {
      const funcName = match[1]
      if (!functions.includes(funcName)) {
        functions.push(funcName)
      }
    }

    return functions
  }
}
