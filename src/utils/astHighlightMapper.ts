// AST 高亮映射工具
import { parse } from 'mathjs'

interface ASTNodeWithPosition {
  id: string
  type: string
  startPos: number
  endPos: number
  blockId?: string
  children?: ASTNodeWithPosition[]
  originalNode?: any // 保存原始的 MathJS 节点
}

export class ASTHighlightMapper {
  private nodeMap = new Map<string, ASTNodeWithPosition>()
  private blockToASTMap = new Map<string, string>() // blockId -> astNodeId
  private astToBlockMap = new Map<string, string>() // astNodeId -> blockId

  // 解析表达式并创建带位置信息的 AST
  parseExpressionWithPositions(expression: string): ASTNodeWithPosition | null {
    try {
      const mathAST = parse(expression)
      return this.addPositionToNode(mathAST, expression, 0)
    } catch (e) {
      console.warn('AST parsing failed:', e)
      return null
    }
  }

  // 为 AST 节点添加位置信息
  private addPositionToNode(node: any, fullExpression: string, currentOffset: number): ASTNodeWithPosition {
    const nodeId = this.generateNodeId()
    let startPos = currentOffset
    let endPos = currentOffset
    const children: ASTNodeWithPosition[] = []

    switch (node.type) {
      case 'ConstantNode':
        const valueStr = String(node.value)
        // 从当前偏移位置开始查找，避免重复匹配
        let valueIndex = fullExpression.indexOf(valueStr, currentOffset)

        // 如果没找到，可能前面有空格
        if (valueIndex < 0) {
          const trimmedStart = fullExpression.substring(currentOffset).trimStart()
          const spaceCount = fullExpression.substring(currentOffset).length - trimmedStart.length
          valueIndex = fullExpression.indexOf(valueStr, currentOffset + spaceCount)
        }

        if (valueIndex >= 0) {
          startPos = valueIndex
          endPos = valueIndex + valueStr.length
        } else {
          // fallback: 使用当前偏移
          startPos = currentOffset
          endPos = currentOffset + valueStr.length
        }
        break

      case 'SymbolNode':
        // 从当前偏移位置开始查找变量名
        let symbolIndex = fullExpression.indexOf(node.name, currentOffset)

        // 如果没找到，可能前面有空格
        if (symbolIndex < 0) {
          const trimmedStart = fullExpression.substring(currentOffset).trimStart()
          const spaceCount = fullExpression.substring(currentOffset).length - trimmedStart.length
          symbolIndex = fullExpression.indexOf(node.name, currentOffset + spaceCount)
        }

        if (symbolIndex >= 0) {
          startPos = symbolIndex
          endPos = symbolIndex + node.name.length
        } else {
          // fallback: 使用当前偏移
          startPos = currentOffset
          endPos = currentOffset + node.name.length
        }
        break

      case 'OperatorNode':
        // 对于运算符，需要更仔细地处理其子节点
        if (node.args.length > 0) {
          // 处理第一个操作数
          const firstChild = this.addPositionToNode(node.args[0], fullExpression, currentOffset)
          children.push(firstChild)

          let nextOffset = firstChild.endPos

          // 处理剩余的操作数
          for (let i = 1; i < node.args.length; i++) {
            // 跳过空格
            while (nextOffset < fullExpression.length && /\s/.test(fullExpression[nextOffset])) {
              nextOffset++
            }

            // 查找运算符位置
            const opPattern = new RegExp(`\\b${node.op}\\b|${node.op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')
            opPattern.lastIndex = nextOffset
            const opMatch = opPattern.exec(fullExpression)

            if (opMatch) {
              nextOffset = opMatch.index + opMatch[0].length
              // 跳过运算符后的空格
              while (nextOffset < fullExpression.length && /\s/.test(fullExpression[nextOffset])) {
                nextOffset++
              }
            }

            const childNode = this.addPositionToNode(node.args[i], fullExpression, nextOffset)
            children.push(childNode)
            nextOffset = childNode.endPos
          }

          // 运算符节点的范围是从第一个子节点到最后一个子节点
          startPos = children[0].startPos
          endPos = children[children.length - 1].endPos
        }
        break

      case 'FunctionNode':
        // 函数名
        const fnName = node.fn.name || node.fn.toString()
        let fnIndex = fullExpression.indexOf(fnName, currentOffset)

        // 如果没找到，尝试跳过前面可能的空格
        if (fnIndex < 0) {
          const trimmedStart = fullExpression.substring(currentOffset).trimStart()
          const spaceCount = fullExpression.substring(currentOffset).length - trimmedStart.length
          fnIndex = fullExpression.indexOf(fnName, currentOffset + spaceCount)
        }

        if (fnIndex >= 0) {
          startPos = fnIndex

          // 找到函数参数
          const openParen = fullExpression.indexOf('(', fnIndex)
          const closeParen = this.findMatchingParen(fullExpression, openParen)
          endPos = closeParen + 1

          // 处理参数 - 更精确地计算每个参数的位置
          let argOffset = openParen + 1
          for (let i = 0; i < node.args.length; i++) {
            // 跳过空格
            while (argOffset < fullExpression.length && /\s/.test(fullExpression[argOffset])) {
              argOffset++
            }

            const childNode = this.addPositionToNode(node.args[i], fullExpression, argOffset)
            children.push(childNode)

            // 移动到下一个参数位置 - 寻找逗号或右括号
            argOffset = childNode.endPos
            while (argOffset < closeParen && fullExpression[argOffset] !== ',' && fullExpression[argOffset] !== ')') {
              argOffset++
            }
            if (fullExpression[argOffset] === ',') {
              argOffset++ // 跳过逗号
            }
          }
        }
        break

      case 'ParenthesisNode':
        // 括号节点：需要找到实际的括号位置
        const openParenIndex = fullExpression.indexOf('(', currentOffset)
        if (openParenIndex >= 0) {
          const closeParenIndex = this.findMatchingParen(fullExpression, openParenIndex)

          // 处理括号内的内容
          const contentNode = this.addPositionToNode(node.content, fullExpression, openParenIndex + 1)
          children.push(contentNode)

          // 括号节点包括括号本身
          startPos = openParenIndex
          endPos = closeParenIndex + 1
        } else {
          // fallback: 只处理内容
          const contentNode = this.addPositionToNode(node.content, fullExpression, currentOffset)
          children.push(contentNode)
          startPos = contentNode.startPos
          endPos = contentNode.endPos
        }
        break

      default:
        console.warn('Unsupported AST node type for positioning:', node.type)
        break
    }

    const astNode: ASTNodeWithPosition = {
      id: nodeId,
      type: node.type,
      startPos,
      endPos,
      children,
      originalNode: node // 保存原始 MathJS 节点的引用
    }

    this.nodeMap.set(nodeId, astNode)
    return astNode
  }

  // 查找匹配的右括号
  private findMatchingParen(str: string, openIndex: number): number {
    let count = 1
    for (let i = openIndex + 1; i < str.length; i++) {
      if (str[i] === '(') count++
      else if (str[i] === ')') count--
      if (count === 0) return i
    }
    return str.length - 1
  }

  // 生成唯一节点 ID
  private generateNodeId(): string {
    return 'ast_' + Math.random().toString(36).substr(2, 9)
  }

  // 建立 AST 节点到 Blockly 块的映射
  mapASTToBlock(astNodeId: string, blockId: string) {
    this.astToBlockMap.set(astNodeId, blockId)
    this.blockToASTMap.set(blockId, astNodeId)
  }

  // 根据 Blockly 块 ID 获取对应的代码位置
  getPositionForBlock(blockId: string): { startPos: number, endPos: number } | null {
    const astNodeId = this.blockToASTMap.get(blockId)
    if (!astNodeId) return null

    const astNode = this.nodeMap.get(astNodeId)
    if (!astNode) return null

    return {
      startPos: astNode.startPos,
      endPos: astNode.endPos
    }
  }

  // 根据代码位置获取对应的 Blockly 块 ID
  getBlockForPosition(position: number): string | null {
    for (const [blockId, astNodeId] of this.blockToASTMap.entries()) {
      const astNode = this.nodeMap.get(astNodeId)
      if (astNode && position >= astNode.startPos && position <= astNode.endPos) {
        return blockId
      }
    }
    return null
  }

  // 根据AST节点ID获取对应的Blockly块ID
  getBlockByASTId(astNodeId: string): string | null {
    return this.astToBlockMap.get(astNodeId) || null
  }

  // 清空映射
  clear() {
    this.nodeMap.clear()
    this.blockToASTMap.clear()
    this.astToBlockMap.clear()
  }

  // 调试：打印所有映射
  debugPrint() {
    console.log('=== AST Highlight Mapper Debug ===')
    console.log('AST Nodes:')
    for (const [id, node] of this.nodeMap.entries()) {
      console.log(`  ${id}: ${node.type} [${node.startPos}-${node.endPos}]`)
    }
    console.log('Block to AST mappings:')
    for (const [blockId, astId] of this.blockToASTMap.entries()) {
      console.log(`  Block ${blockId} -> AST ${astId}`)
    }
  }
}
