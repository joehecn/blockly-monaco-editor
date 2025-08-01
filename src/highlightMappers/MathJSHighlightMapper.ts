/**
 * MathJS 高亮映射器 - 基于现有的 astHighlightMapper 重构
 */
import type { HighlightMapper, Position } from '../core/types'
import type { MathJSData } from '../transformers/MathJSTransformer'

interface ASTNodeWithPosition {
  id: string
  type: string
  startPos: number
  endPos: number
  blockId?: string
  children?: ASTNodeWithPosition[]
  originalNode?: any
}

export class MathJSHighlightMapper implements HighlightMapper<MathJSData> {
  private nodeMap = new Map<string, ASTNodeWithPosition>()
  private blockToASTMap = new Map<string, string>()
  private astToBlockMap = new Map<string, string>()

  createMapping(data: MathJSData, content: string): Map<string, Position> {
    const mapping = new Map<string, Position>()

    if (!data.ast || !content) {
      return mapping
    }

    try {
      const rootNode = this.addPositionToNode(data.ast, content, 0)
      if (rootNode) {
        this.collectPositions(rootNode, mapping)
      }
    } catch (error) {
      console.error('Failed to create mapping:', error)
    }

    return mapping
  }

  findElementByPosition(position: number, mapping: Map<string, Position>): string | null {
    for (const [elementId, pos] of mapping) {
      if (position >= pos.startPos && position <= pos.endPos) {
        return elementId
      }
    }
    return null
  }

  findPositionByElement(elementId: string, mapping: Map<string, Position>): Position | null {
    return mapping.get(elementId) || null
  }

  updateMapping(data: MathJSData, content: string, mapping: Map<string, Position>): void {
    mapping.clear()
    const newMapping = this.createMapping(data, content)
    newMapping.forEach((pos, id) => mapping.set(id, pos))
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
        let valueIndex = fullExpression.indexOf(valueStr, currentOffset)

        if (valueIndex < 0) {
          const trimmedStart = fullExpression.substring(currentOffset).trimStart()
          const spaceCount = fullExpression.substring(currentOffset).length - trimmedStart.length
          valueIndex = fullExpression.indexOf(valueStr, currentOffset + spaceCount)
        }

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

      case 'ParenthesisNode':
        const openIndex = fullExpression.indexOf('(', currentOffset)
        if (openIndex >= 0) {
          startPos = openIndex
          const contentNode = this.addPositionToNode(node.content, fullExpression, openIndex + 1)
          children.push(contentNode)
          endPos = this.findMatchingParen(fullExpression, openIndex)
        }
        break

      default:
        console.warn(`Unhandled node type: ${node.type}`)
        if (node.args) {
          let childOffset = currentOffset
          node.args.forEach((arg: any) => {
            const childNode = this.addPositionToNode(arg, fullExpression, childOffset)
            children.push(childNode)
            childOffset = childNode.endPos + 1
          })

          if (children.length > 0) {
            startPos = children[0].startPos
            endPos = children[children.length - 1].endPos
          }
        }
    }

    const result: ASTNodeWithPosition = {
      id: nodeId,
      type: node.type,
      startPos,
      endPos,
      children,
      originalNode: node
    }

    this.nodeMap.set(nodeId, result)
    return result
  }

  private findMatchingParen(text: string, openIndex: number): number {
    let count = 1
    for (let i = openIndex + 1; i < text.length; i++) {
      if (text[i] === '(') count++
      else if (text[i] === ')') count--
      if (count === 0) return i
    }
    return text.length - 1
  }

  private generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private collectPositions(node: ASTNodeWithPosition, mapping: Map<string, Position>): void {
    mapping.set(node.id, {
      startPos: node.startPos,
      endPos: node.endPos
    })

    if (node.children) {
      node.children.forEach(child => this.collectPositions(child, mapping))
    }
  }

  // 公共方法，用于与 Blockly 的映射关系
  mapBlockToAST(blockId: string, astNodeId: string): void {
    this.blockToASTMap.set(blockId, astNodeId)
    this.astToBlockMap.set(astNodeId, blockId)
  }

  getASTNodeByBlockId(blockId: string): string | undefined {
    return this.blockToASTMap.get(blockId)
  }

  getBlockIdByASTNode(astNodeId: string): string | undefined {
    return this.astToBlockMap.get(astNodeId)
  }

  clearMappings(): void {
    this.nodeMap.clear()
    this.blockToASTMap.clear()
    this.astToBlockMap.clear()
  }
}
