import * as Blockly from 'blockly/core'
import { evaluate, simplify, format } from 'mathjs'

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

// 数字块
expressionGenerator.forBlock['math_number'] = function (block) {
  const code = String(parseFloat(block.getFieldValue('NUM')))
  return [code, Order.ATOMIC]
}

// 数学运算块
expressionGenerator.forBlock['math_arithmetic'] = function (block, generator) {
  const OPERATORS: Record<string, [string, number]> = {
    'ADD': [' + ', Order.ADDITIVE],
    'MINUS': [' - ', Order.ADDITIVE],
    'MULTIPLY': [' * ', Order.MULTIPLICATIVE],
    'DIVIDE': [' / ', Order.MULTIPLICATIVE],
    'POWER': ['^', Order.POWER]
  }

  const op = block.getFieldValue('OP') as string
  const tuple = OPERATORS[op]
  const operator = tuple[0]
  const order = tuple[1]

  const argument0 = generator.valueToCode(block, 'A', order) || '0'
  const argument1 = generator.valueToCode(block, 'B', order) || '0'

  const code = argument0 + operator + argument1
  return [code, order]
}

// 变量块
expressionGenerator.forBlock['math_variable'] = function (block) {
  const varName = block.getFieldValue('VAR')
  return [varName, Order.ATOMIC]
}

// 函数块
expressionGenerator.forBlock['math_function'] = function (block, generator) {
  const func = block.getFieldValue('FUNC')
  const arg = generator.valueToCode(block, 'ARG', Order.NONE) || '0'

  const code = `${func}(${arg})`
  return [code, Order.FUNCTION_CALL]
}

// 双参数函数块
expressionGenerator.forBlock['math_function_dual'] = function (block, generator) {
  const func = block.getFieldValue('FUNC')
  const arg1 = generator.valueToCode(block, 'ARG1', Order.NONE) || '0'
  const arg2 = generator.valueToCode(block, 'ARG2', Order.NONE) || '0'

  const code = `${func}(${arg1}, ${arg2})`
  return [code, Order.FUNCTION_CALL]
}

// 括号块 (完全自动化：始终返回内容，不添加括号)
expressionGenerator.forBlock['math_parentheses'] = function (block, generator) {
  const expr = generator.valueToCode(block, 'EXPR', Order.NONE) || 'false'

  // 直接返回内部表达式，完全忽略括号块的存在
  // Blockly 的嵌套结构已经确定了优先级，无需额外括号
  return [expr, getExpressionOrder(expr)]
}

// 逻辑括号块 (同样完全自动化)
expressionGenerator.forBlock['logic_parentheses'] = function (block, generator) {
  const expr = generator.valueToCode(block, 'EXPR', Order.NONE) || 'false'

  // 直接返回内部表达式，信任 Blockly 的结构表达的优先级
  return [expr, getExpressionOrder(expr)]
}

// 常量块
expressionGenerator.forBlock['math_constant'] = function (block) {
  const CONSTANTS: Record<string, string> = {
    'PI': 'pi',
    'E': 'e',
    'PHI': '1.618033988749895',
    'INFINITY': 'Infinity'
  }

  const constantKey = block.getFieldValue('CONSTANT') as string
  const constant = CONSTANTS[constantKey]
  return [constant, Order.ATOMIC]
}

// 比较运算块
expressionGenerator.forBlock['logic_compare'] = function (block, generator) {
  const OPERATORS: Record<string, [string, number]> = {
    'EQ': [' == ', Order.RELATIONAL],
    'NEQ': [' != ', Order.RELATIONAL],
    'LT': [' < ', Order.RELATIONAL],
    'LTE': [' <= ', Order.RELATIONAL],
    'GT': [' > ', Order.RELATIONAL],
    'GTE': [' >= ', Order.RELATIONAL]
  }

  const op = block.getFieldValue('OP') as string
  const tuple = OPERATORS[op]
  const operator = tuple[0]
  const order = tuple[1]

  const argument0 = generator.valueToCode(block, 'A', order) || '0'
  const argument1 = generator.valueToCode(block, 'B', order) || '0'

  const code = argument0 + operator + argument1
  return [code, order]
}

// 逻辑运算块
expressionGenerator.forBlock['logic_operation'] = function (block, generator) {
  const OPERATORS: Record<string, [string, number]> = {
    'AND': [' and ', Order.LOGICAL_AND],
    'OR': [' or ', Order.LOGICAL_OR]
  }

  const op = block.getFieldValue('OP') as string
  const tuple = OPERATORS[op]
  const operator = tuple[0]
  const order = tuple[1]

  const argument0 = generator.valueToCode(block, 'A', order) || 'false'
  const argument1 = generator.valueToCode(block, 'B', order) || 'false'

  const code = argument0 + operator + argument1
  return [code, order]
}

// 逻辑非块
expressionGenerator.forBlock['logic_negate'] = function (block, generator) {
  const argument = generator.valueToCode(block, 'BOOL', Order.UNARY_SIGN) || 'false'
  const code = 'not ' + argument
  return [code, Order.UNARY_SIGN]
}

// 布尔值块
expressionGenerator.forBlock['logic_boolean'] = function (block) {
  const code = (block.getFieldValue('BOOL') === 'TRUE') ? 'true' : 'false'
  return [code, Order.ATOMIC]
}

// 三元运算块 (优化括号)
expressionGenerator.forBlock['logic_ternary'] = function (block, generator) {
  const valueIf = generator.valueToCode(block, 'IF', Order.LOGICAL_OR) || 'false'
  const valueThen = generator.valueToCode(block, 'THEN', Order.LOGICAL_OR) || '0'
  const valueElse = generator.valueToCode(block, 'ELSE', Order.LOGICAL_OR) || '0'

  // MathJS 三元运算符语法：condition ? valueTrue : valueFalse
  // 只在必要时添加外层括号
  const code = `${valueIf} ? ${valueThen} : ${valueElse}`
  return [code, Order.LOGICAL_OR]
}

// 字符串字面量块
expressionGenerator.forBlock['text_string'] = function (block) {
  const text = block.getFieldValue('TEXT')
  // 转义字符串中的引号和反斜杠
  const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const code = `"${escapedText}"`
  return [code, Order.ATOMIC]
}

// 字符串连接块  
expressionGenerator.forBlock['text_join'] = function (block, generator) {
  const valueA = generator.valueToCode(block, 'A', Order.NONE) || '""'
  const valueB = generator.valueToCode(block, 'B', Order.NONE) || '""'
  const code = `concat(${valueA}, ${valueB})`
  return [code, Order.FUNCTION_CALL]
}

// 验证表达式是否有效
export function validateExpression(expression: string): boolean {
  try {
    // 使用宽松的验证策略：创建包含所有可能变量的作用域
    const scope = createUniversalScope(expression)
    evaluate(expression, scope)
    return true
  } catch (e: any) {
    // 如果仍然失败，尝试纯字符串模式
    if (e?.message?.includes('Unexpected type of argument in function compareText') ||
      e?.message?.includes('Unexpected type of argument in function equalText')) {
      try {
        const stringScope = createUniversalScope(expression, true)
        evaluate(expression, stringScope)
        return true
      } catch (e2: any) {
        console.warn('[SYS] 表达式验证失败:', e2?.message || e2)
        return false
      }
    }

    console.warn('[SYS] 表达式验证失败:', e?.message || e)
    return false
  }
}

// 表达式后处理：清理不必要的括号
export function cleanupExpression(expression: string): string {
  if (!expression) return expression

  let cleaned = expression.trim()
  let lastCleaned = ''

  // 迭代清理，直到不再有变化
  while (cleaned !== lastCleaned) {
    lastCleaned = cleaned
    cleaned = removeUnnecessaryParentheses(cleaned)
  }

  return cleaned
}

// 移除不必要的括号
function removeUnnecessaryParentheses(expr: string): string {
  // 移除最外层的多余括号
  while (expr.startsWith('((') && expr.endsWith('))') && isBalancedParentheses(expr)) {
    const inner = expr.slice(1, -1)
    if (isBalancedParentheses(inner) && inner.startsWith('(') && inner.endsWith(')')) {
      expr = inner
    } else {
      break
    }
  }

  // 移除函数调用周围的多余括号 - 修复正则表达式
  expr = expr.replace(/\(([a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\))\)/g, '$1')

  // 移除简单原子表达式周围的括号，但要确保不破坏函数调用
  expr = expr.replace(/\(([a-zA-Z_][a-zA-Z0-9_]*)\)(?!\s*\()/g, '$1')  // 变量（但不是函数名）
  expr = expr.replace(/\((\d+(?:\.\d+)?)\)/g, '$1')  // 数字
  expr = expr.replace(/\((".*?")\)/g, '$1')  // 字符串

  return expr
}

// 创建通用作用域 - 使用代理对象动态处理未知变量
function createUniversalScope(_expression: string, forceString: boolean = false): any {
  const knownVariables: Record<string, any> = {}

  // 添加自定义函数
  knownVariables.compareExpr = function (expr1: any, expr2: any) {
    try {
      const simplified1 = simplify(String(expr1))
      const simplified2 = simplify(String(expr2))
      return format(simplified1) === format(simplified2)
    } catch (e) {
      return false
    }
  }

  // 添加字符串比较函数
  knownVariables.equalText = function (text1: any, text2: any) {
    return String(text1) === String(text2)
  }

  knownVariables.compareText = function (text1: any, text2: any) {
    return String(text1) === String(text2)
  }

  // 添加字符串连接函数
  knownVariables.concat = function (text1: any, text2: any) {
    return String(text1) + String(text2)
  }

  // 添加常用数学函数
  knownVariables.sin = Math.sin
  knownVariables.cos = Math.cos
  knownVariables.tan = Math.tan
  knownVariables.log = Math.log
  knownVariables.sqrt = Math.sqrt
  knownVariables.abs = Math.abs
  knownVariables.ceil = Math.ceil
  knownVariables.floor = Math.floor
  knownVariables.round = Math.round
  knownVariables.exp = Math.exp
  knownVariables.pi = Math.PI
  knownVariables.e = Math.E

  // 使用 Proxy 来动态处理未知变量
  return new Proxy(knownVariables, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string]
      }

      // 动态生成变量值
      const varName = String(prop)

      // 跳过保留关键字和内部属性
      if (varName === 'end' || varName === 'constructor' || varName === 'prototype' ||
        varName.startsWith('_') || varName === 'Symbol(Symbol.toPrimitive)' ||
        varName === 'Symbol(Symbol.iterator)' || typeof prop === 'symbol') {
        return undefined
      }

      if (forceString) {
        return varName // 字符串模式：返回变量名本身
      } else {
        // 智能模式：根据变量名推测类型
        if (isLikelyStringVariable(varName)) {
          return varName // 字符串变量
        } else {
          return 1 // 数字变量
        }
      }
    },

    has(_target, prop) {
      const varName = String(prop)
      // 保留关键字和内部属性不存在
      if (varName === 'end' || varName === 'constructor' || varName === 'prototype' ||
        varName.startsWith('_') || typeof prop === 'symbol') {
        return false
      }
      return true // 其他所有属性都存在
    }
  })
}

// 智能判断变量是否像字符串变量
function isLikelyStringVariable(variableName: string): boolean {
  const stringIndicators = [
    // 明显的字符串词汇
    'name', 'text', 'str', 'msg', 'message', 'title', 'content',
    'leak', 'word', 'phrase', 'sentence', 'label', 'tag',
    // 标识符相关
    'id', 'key', 'value', 'data', 'info', 'desc', 'description',
    // 路径和网络相关
    'path', 'url', 'link', 'file', 'dir', 'folder', 'email',
    // 用户和认证相关
    'user', 'username', 'password', 'token', 'code', 'hash',
    // 其他常见字符串
    'type', 'kind', 'category', 'class', 'status', 'state'
  ]

  const lowerName = variableName.toLowerCase()

  // 1. 包含字符串关键词
  if (stringIndicators.some(indicator => lowerName.includes(indicator))) {
    return true
  }

  // 2. 以字符串前缀开头
  if (/^(str|txt|msg|text|name|user|pass)/i.test(variableName)) {
    return true
  }

  // 3. 以字符串后缀结尾
  if (/(string|text|name|msg|message|word|phrase|title|label|tag|id|key|path|url|email)$/i.test(variableName)) {
    return true
  }

  // 4. 驼峰命名中包含字符串相关词汇
  if (/[A-Z](Name|Text|Msg|Message|String|Word|Title|Label|Tag|Id|Key|Path|Url|Email)/g.test(variableName)) {
    return true
  }

  // 默认为数字变量
  return false
}

// 获取表达式的操作符优先级
function getExpressionOrder(expr: string): number {
  // 检查逻辑或
  if (expr.includes(' or ')) {
    return Order.LOGICAL_OR
  }

  // 检查逻辑与
  if (expr.includes(' and ')) {
    return Order.LOGICAL_AND
  }

  // 检查比较操作符
  if (/[<>=!]/.test(expr)) {
    return Order.RELATIONAL
  }

  // 检查加减
  if (/[+-]/.test(expr)) {
    return Order.ADDITIVE
  }

  // 检查乘除
  if (/[*/]/.test(expr)) {
    return Order.MULTIPLICATIVE
  }

  // 检查幂
  if (expr.includes('^')) {
    return Order.POWER
  }

  // 函数调用
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)$/.test(expr)) {
    return Order.FUNCTION_CALL
  }

  // 默认为原子级别
  return Order.ATOMIC
}

// 检查括号是否平衡 (表达式清理功能需要)
function isBalancedParentheses(expr: string): boolean {
  let count = 0
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === '(') count++
    else if (expr[i] === ')') count--
    if (count < 0) return false
  }
  return count === 0
}
