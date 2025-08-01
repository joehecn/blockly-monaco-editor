import { parse, SymbolNode, ConstantNode, OperatorNode, FunctionNode, ParenthesisNode } from 'mathjs'

interface BaseBlock {
  type: string
  x?: number
  y?: number
  fields?: Record<string, string>
  inputs?: Record<string, { block: Block }>
}

type Block = BaseBlock

export const expression2blocklyGenerator = {

  fromExpression(expr: string, x = 0, y = 0) {
    try {
      const node = parse(expr)
      const block = expression2blocklyGenerator.nodeToBlock(node)

      if (block) {
        block.x = x
        block.y = y
      }

      return {
        blocks: {
          languageVersion: 0,
          blocks: [block],
        },
      }
    } catch (e) {
      console.warn('Expression parsing failed:', e)
      // 返回一个默认的数字块
      return {
        blocks: {
          languageVersion: 0,
          blocks: [{
            type: 'math_number',
            x,
            y,
            fields: { NUM: '0' }
          }],
        },
      }
    }
  },

  nodeToBlock(node: any): Block {
    switch (node.type) {
      case 'ConstantNode':
        return expression2blocklyGenerator.constantNodeToBlock(node as ConstantNode)

      case 'SymbolNode':
        return expression2blocklyGenerator.symbolNodeToBlock(node as SymbolNode)

      case 'OperatorNode':
        return expression2blocklyGenerator.operatorNodeToBlock(node as OperatorNode)

      case 'FunctionNode':
        return expression2blocklyGenerator.functionNodeToBlock(node as FunctionNode)

      case 'ParenthesisNode':
        return expression2blocklyGenerator.parenthesisNodeToBlock(node as ParenthesisNode)

      case 'ConditionalNode':
        return expression2blocklyGenerator.conditionalNodeToBlock(node)

      default:
        console.warn('Unsupported node type:', node.type)
        return {
          type: 'math_number',
          fields: { NUM: '0' }
        }
    }
  },

  constantNodeToBlock(node: ConstantNode): Block {
    const value = node.value

    // 检查是否是数学常量
    if (value === Math.PI) {
      return {
        type: 'math_constant',
        fields: { CONSTANT: 'PI' }
      }
    } else if (value === Math.E) {
      return {
        type: 'math_constant',
        fields: { CONSTANT: 'E' }
      }
    } else if (value === 1.618033988749895) {
      return {
        type: 'math_constant',
        fields: { CONSTANT: 'PHI' }
      }
    } else if (value === Infinity) {
      return {
        type: 'math_constant',
        fields: { CONSTANT: 'INFINITY' }
      }
    } else if (typeof value === 'boolean') {
      // 布尔值常量
      return {
        type: 'logic_boolean',
        fields: { BOOL: value ? 'TRUE' : 'FALSE' }
      }
    } else if (typeof value === 'string') {
      // 字符串常量
      return {
        type: 'text_string',
        fields: { TEXT: value }
      }
    } else {
      // 数字常量
      return {
        type: 'math_number',
        fields: { NUM: String(value) }
      }
    }
  },

  symbolNodeToBlock(node: SymbolNode): Block {
    // 处理特殊常量
    if (node.name === 'pi') {
      return {
        type: 'math_constant',
        fields: { CONSTANT: 'PI' }
      }
    } else if (node.name === 'e') {
      return {
        type: 'math_constant',
        fields: { CONSTANT: 'E' }
      }
    } else if (node.name === 'true') {
      return {
        type: 'logic_boolean',
        fields: { BOOL: 'TRUE' }
      }
    } else if (node.name === 'false') {
      return {
        type: 'logic_boolean',
        fields: { BOOL: 'FALSE' }
      }
    } else {
      // 普通变量
      return {
        type: 'math_variable',
        fields: { VAR: node.name }
      }
    }
  },

  operatorNodeToBlock(node: OperatorNode): Block {
    const operatorMap: Record<string, string> = {
      '+': 'ADD',
      '-': 'MINUS',
      '*': 'MULTIPLY',
      '/': 'DIVIDE',
      '^': 'POWER'
    }

    const comparisonMap: Record<string, string> = {
      '==': 'EQ',
      '!=': 'NEQ',
      '<': 'LT',
      '<=': 'LTE',
      '>': 'GT',
      '>=': 'GTE',
      'equal': 'EQ',
      'unequal': 'NEQ',
      'smaller': 'LT',
      'smallerEq': 'LTE',
      'larger': 'GT',
      'largerEq': 'GTE'
    }

    const logicalMap: Record<string, string> = {
      'and': 'AND',
      'or': 'OR'
    }

    // 检查是否是算术运算符
    const mathOp = operatorMap[node.op]
    if (mathOp && node.args.length === 2) {
      return {
        type: 'math_arithmetic',
        fields: { OP: mathOp },
        inputs: {
          A: { block: expression2blocklyGenerator.nodeToBlock(node.args[0]) },
          B: { block: expression2blocklyGenerator.nodeToBlock(node.args[1]) }
        }
      }
    }

    // 检查是否是比较运算符
    const compareOp = comparisonMap[node.op]
    if (compareOp && node.args.length === 2) {
      return {
        type: 'logic_compare',
        fields: { OP: compareOp },
        inputs: {
          A: { block: expression2blocklyGenerator.nodeToBlock(node.args[0]) },
          B: { block: expression2blocklyGenerator.nodeToBlock(node.args[1]) }
        }
      }
    }

    // 检查是否是逻辑运算符
    const logicalOp = logicalMap[node.op]
    if (logicalOp && node.args.length === 2) {
      return {
        type: 'logic_operation',
        fields: { OP: logicalOp },
        inputs: {
          A: { block: expression2blocklyGenerator.nodeToBlock(node.args[0]) },
          B: { block: expression2blocklyGenerator.nodeToBlock(node.args[1]) }
        }
      }
    }

    // 处理逻辑非运算符
    if (node.op === 'not' && node.args.length === 1) {
      return {
        type: 'logic_negate',
        inputs: {
          BOOL: { block: expression2blocklyGenerator.nodeToBlock(node.args[0]) }
        }
      }
    }

    console.warn('Unsupported operator:', node.op)
    return {
      type: 'math_number',
      fields: { NUM: '0' }
    }
  },

  functionNodeToBlock(node: FunctionNode): Block {
    const singleArgFunctions = ['sin', 'cos', 'tan', 'log', 'sqrt', 'abs', 'ceil', 'floor', 'round', 'exp']
    const dualArgFunctions = ['equalText', 'compareExpr', 'min', 'max', 'pow', 'atan2', 'gcd', 'lcm']

    const functionName = node.fn.name

    // 特殊处理 concat 函数（字符串连接）
    if (functionName === 'concat' && node.args.length === 2) {
      return {
        type: 'text_join',
        inputs: {
          A: { block: expression2blocklyGenerator.nodeToBlock(node.args[0]) },
          B: { block: expression2blocklyGenerator.nodeToBlock(node.args[1]) }
        }
      }
    }

    if (singleArgFunctions.includes(functionName) && node.args.length === 1) {
      return {
        type: 'math_function',
        fields: { FUNC: functionName },
        inputs: {
          ARG: { block: expression2blocklyGenerator.nodeToBlock(node.args[0]) }
        }
      }
    } else if (dualArgFunctions.includes(functionName) && node.args.length === 2) {
      return {
        type: 'math_function_dual',
        fields: { FUNC: functionName },
        inputs: {
          ARG1: { block: expression2blocklyGenerator.nodeToBlock(node.args[0]) },
          ARG2: { block: expression2blocklyGenerator.nodeToBlock(node.args[1]) }
        }
      }
    } else {
      console.warn('Unsupported function or argument count:', functionName, node.args.length)
      return {
        type: 'math_number',
        fields: { NUM: '0' }
      }
    }
  },

  parenthesisNodeToBlock(node: ParenthesisNode): Block {
    // 直接返回括号内的内容，不创建括号块
    // Blockly 的块嵌套结构本身就表达了优先级，无需额外的括号块
    return expression2blocklyGenerator.nodeToBlock(node.content)
  },

  conditionalNodeToBlock(node: any): Block {
    // 处理三元运算符：condition ? trueValue : falseValue
    return {
      type: 'logic_ternary',
      inputs: {
        IF: { block: expression2blocklyGenerator.nodeToBlock(node.condition) },
        THEN: { block: expression2blocklyGenerator.nodeToBlock(node.trueExpr) },
        ELSE: { block: expression2blocklyGenerator.nodeToBlock(node.falseExpr) }
      }
    }
  }
}
