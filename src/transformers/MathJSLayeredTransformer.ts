/**
 * MathJS 分层转换器 - 实现精确的数据流转换
 * 
 * 数据流: blockly <-> blockly结构(Object) <-> mathjs ast结构(Object) <-> code(String) <-> monaco
 */

import { parse, format } from 'mathjs'
import type {
  LayeredTransformer,
  MathJSIntermediate
} from '../core/layeredTypes'

export class MathJSLayeredTransformer implements LayeredTransformer<MathJSIntermediate> {

  // === 对象层转换 ===

  /**
   * Blockly结构(Object) -> MathJS AST结构(Object)
   */
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
      console.error('Failed to convert Blockly to MathJS intermediate:', error)
      return this.createEmptyIntermediate()
    }
  }

  /**
   * MathJS AST结构(Object) -> Blockly结构(Object)
   */
  intermediateToBlockly(intermediate: MathJSIntermediate): any {
    try {
      if (!intermediate.ast) {
        return this.createEmptyBlocklyStructure()
      }

      // 将 MathJS AST 转换为 Blockly 结构
      return this.astToBlocklyStructure(intermediate.ast)
    } catch (error) {
      console.error('Failed to convert MathJS intermediate to Blockly:', error)
      return this.createEmptyBlocklyStructure()
    }
  }

  // === 序列化层转换 ===

  /**
   * MathJS AST结构(Object) -> code(String)
   */
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
      console.error('Failed to convert MathJS intermediate to code:', error)
      return intermediate.metadata?.originalExpression || ''
    }
  }

  /**
   * code(String) -> MathJS AST结构(Object)
   */
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
      console.error('Failed to parse code to MathJS intermediate:', error)
      return null
    }
  }

  // === 完整链路转换 (便利方法) ===

  /**
   * Blockly结构 -> code(String)
   */
  blocklyToCode(blocklyStructure: any): string {
    const intermediate = this.blocklyToIntermediate(blocklyStructure)
    return this.intermediateToCode(intermediate)
  }

  /**
   * code(String) -> Blockly结构
   */
  codeToBlockly(code: string): any | null {
    const intermediate = this.codeToIntermediate(code)
    if (!intermediate) {
      return null
    }
    return this.intermediateToBlockly(intermediate)
  }

  // === 验证和格式化 ===

  validateIntermediate(intermediate: MathJSIntermediate): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!intermediate) {
      errors.push('Intermediate structure is null')
      return { valid: false, errors }
    }

    if (intermediate.type !== 'mathjs') {
      errors.push('Invalid intermediate type, expected "mathjs"')
    }

    if (!intermediate.ast && !intermediate.metadata?.originalExpression) {
      errors.push('Both AST and original expression are missing')
    }

    // 验证 AST 的有效性
    if (intermediate.ast) {
      try {
        format(intermediate.ast)
      } catch (error) {
        errors.push(`Invalid MathJS AST: ${error}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  formatCode(code: string): string {
    try {
      const intermediate = this.codeToIntermediate(code)
      if (!intermediate) {
        return code
      }
      return this.intermediateToCode(intermediate)
    } catch (error) {
      console.warn('Failed to format code:', error)
      return code
    }
  }

  // === 私有辅助方法 ===

  private generateExpressionFromBlockly(blocklyStructure: any): string {
    // 简化实现：这里需要根据具体的 Blockly 块类型生成表达式
    if (!blocklyStructure) {
      return ''
    }

    switch (blocklyStructure.type) {
      case 'math_number':
        return String(blocklyStructure.fields?.NUM || 0)

      case 'variable':
        return String(blocklyStructure.fields?.VAR || 'x')

      case 'math_arithmetic':
        const left = this.generateExpressionFromBlockly(blocklyStructure.inputs?.A)
        const right = this.generateExpressionFromBlockly(blocklyStructure.inputs?.B)
        const op = blocklyStructure.fields?.OP || '+'
        return `(${left} ${op} ${right})`

      case 'function_call':
        const funcName = blocklyStructure.fields?.FUNC || 'unknown'
        const args = blocklyStructure.inputs?.ARGS || []
        const argExpressions = args.map((arg: any) => this.generateExpressionFromBlockly(arg))
        return `${funcName}(${argExpressions.join(', ')})`

      default:
        console.warn(`Unknown block type: ${blocklyStructure.type}`)
        return ''
    }
  }

  private astToBlocklyStructure(ast: any): any {
    // 简化实现：这里需要根据 MathJS AST 节点类型生成对应的 Blockly 结构
    if (!ast) {
      return this.createEmptyBlocklyStructure()
    }

    switch (ast.type) {
      case 'ConstantNode':
        return {
          type: 'math_number',
          id: this.generateId(),
          fields: { NUM: ast.value }
        }

      case 'SymbolNode':
        return {
          type: 'variable',
          id: this.generateId(),
          fields: { VAR: ast.name }
        }

      case 'OperatorNode':
        return {
          type: 'math_arithmetic',
          id: this.generateId(),
          fields: { OP: ast.op },
          inputs: {
            A: this.astToBlocklyStructure(ast.args[0]),
            B: this.astToBlocklyStructure(ast.args[1])
          }
        }

      case 'FunctionNode':
        return {
          type: 'function_call',
          id: this.generateId(),
          fields: { FUNC: ast.fn.name || ast.fn },
          inputs: {
            ARGS: ast.args.map((arg: any) => this.astToBlocklyStructure(arg))
          }
        }

      case 'ParenthesisNode':
        // 括号节点，直接处理其内容
        return this.astToBlocklyStructure(ast.content)

      case 'AccessorNode':
        // 访问器节点，如数组访问 a[i]
        return {
          type: 'array_access',
          id: this.generateId(),
          inputs: {
            OBJECT: this.astToBlocklyStructure(ast.object),
            INDEX: this.astToBlocklyStructure(ast.index)
          }
        }

      default:
        console.warn(`Unknown AST node type: ${ast.type}`)
        return this.createEmptyBlocklyStructure()
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

  private extractVariables(expression: string): string[] {
    const variables: string[] = []
    // 简化实现：提取变量名
    const variableRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g
    let match

    while ((match = variableRegex.exec(expression)) !== null) {
      const varName = match[1]
      // 排除已知函数名
      if (!this.isKnownFunction(varName) && !variables.includes(varName)) {
        variables.push(varName)
      }
    }

    return variables
  }

  private isKnownFunction(name: string): boolean {
    const knownFunctions = ['sin', 'cos', 'tan', 'log', 'sqrt', 'abs', 'equalText', 'and', 'or', 'not']
    return knownFunctions.includes(name)
  }

  private createEmptyIntermediate(): MathJSIntermediate {
    return {
      type: 'mathjs',
      version: '1.0',
      ast: null,
      functions: [],
      variables: [],
      metadata: {
        timestamp: Date.now()
      }
    }
  }

  private createEmptyBlocklyStructure(): any {
    return {
      type: 'empty',
      id: this.generateId()
    }
  }

  private generateId(): string {
    return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
