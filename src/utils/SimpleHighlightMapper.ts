// 简化的高亮映射器 - 避免实时 AST 解析，提高性能
export class SimpleHighlightMapper {
  private blockPositions = new Map<string, { startPos: number, endPos: number }>()
  private positionToBlocks = new Array<{ blockId: string, startPos: number, endPos: number }>()

  constructor() { }

  // 重建位置映射表（仅在 Blockly 工作区变化时调用）
  rebuildPositionMap(workspace: any, fullCode: string) {
    console.debug('🔄 Rebuilding position map for code:', fullCode)

    // 清空现有映射
    this.blockPositions.clear()
    this.positionToBlocks.length = 0

    // 获取所有块，按生成顺序排序
    const allBlocks = workspace.getAllBlocks(false) // false = 只获取顶层块

    // 方案一：基于块的层级顺序进行匹配
    this.mapBlocksByHierarchy(allBlocks, fullCode)

    // 排序位置数组，便于后续查找
    this.positionToBlocks.sort((a, b) => a.startPos - b.startPos)

    console.debug('✅ Position map rebuilt:', {
      blockCount: this.blockPositions.size,
      positionCount: this.positionToBlocks.length
    })
  }

  // 基于块层级结构进行智能匹配
  private mapBlocksByHierarchy(blocks: any[], fullCode: string) {
    for (const block of blocks) {
      // 获取这个块生成的代码
      const blockCode = this.getBlockCode(block)
      if (!blockCode) continue

      // 智能查找位置：考虑上下文和已映射的位置
      const position = this.findBestPosition(blockCode, fullCode, block)
      if (position) {
        this.blockPositions.set(block.id, position)
        this.positionToBlocks.push({
          blockId: block.id,
          ...position
        })

        console.debug(`📍 Mapped block ${block.id} (${block.type}): "${blockCode}" -> [${position.startPos}-${position.endPos}]`)
      }
    }
  }

  // 智能位置查找：避免重复匹配问题
  private findBestPosition(blockCode: string, fullCode: string, block: any): { startPos: number, endPos: number } | null {
    // 获取所有可能的匹配位置
    const allMatches: number[] = []
    let searchStart = 0
    while (true) {
      const index = fullCode.indexOf(blockCode, searchStart)
      if (index === -1) break
      allMatches.push(index)
      searchStart = index + 1
    }

    if (allMatches.length === 0) {
      console.warn(`❌ No matches found for block code: "${blockCode}"`)
      return null
    }

    if (allMatches.length === 1) {
      // 唯一匹配，直接使用
      return {
        startPos: allMatches[0],
        endPos: allMatches[0] + blockCode.length
      }
    }

    // 多个匹配：使用启发式算法选择最佳位置
    const bestMatch = this.selectBestMatch(allMatches, blockCode, fullCode, block)
    return {
      startPos: bestMatch,
      endPos: bestMatch + blockCode.length
    }
  }

  // 启发式算法：选择最合适的匹配位置
  private selectBestMatch(matches: number[], blockCode: string, _fullCode: string, block: any): number {
    // 策略 1：避开已被占用的位置
    const availableMatches = matches.filter(pos => !this.isPositionOccupied(pos, pos + blockCode.length))

    if (availableMatches.length > 0) {
      // 策略 2：如果有父子关系，选择在父块范围内的位置
      const parentBlock = block.getParent?.()
      if (parentBlock) {
        const parentPosition = this.blockPositions.get(parentBlock.id)
        if (parentPosition) {
          const inParentRange = availableMatches.filter(pos =>
            pos >= parentPosition.startPos && pos + blockCode.length <= parentPosition.endPos
          )
          if (inParentRange.length > 0) {
            return inParentRange[0] // 取第一个在父块范围内的位置
          }
        }
      }

      // 策略 3：选择第一个可用位置
      return availableMatches[0]
    }

    // 如果所有位置都被占用，选择第一个匹配（可能会有重叠，但总比没有好）
    console.warn(`⚠️ All positions occupied for "${blockCode}", using first match`)
    return matches[0]
  }

  // 检查位置是否已被其他块占用
  private isPositionOccupied(startPos: number, endPos: number): boolean {
    return this.positionToBlocks.some(item =>
      !(endPos <= item.startPos || startPos >= item.endPos) // 检查是否有重叠
    )
  }

  // 获取块对应的代码（简化版，避免复杂的代码生成）
  private getBlockCode(block: any): string {
    try {
      // 根据块类型生成简单的代码表示
      switch (block.type) {
        case 'math_number':
          return block.getFieldValue('NUM') || '0'
        case 'math_arithmetic':
          const op = block.getFieldValue('OP')
          const left = this.getInputBlockCode(block, 'A')
          const right = this.getInputBlockCode(block, 'B')
          return `${left} ${op} ${right}`
        case 'variables_get':
          return block.getFieldValue('VAR') || 'var'
        case 'math_single':
          const func = block.getFieldValue('OP')
          const input = this.getInputBlockCode(block, 'NUM')
          return `${func}(${input})`
        // 可以根据需要添加更多块类型
        default:
          // fallback: 尝试使用 Blockly 的代码生成器
          if (typeof window !== 'undefined' && (window as any).Blockly?.JavaScript) {
            return (window as any).Blockly.JavaScript.blockToCode(block, (window as any).Blockly.JavaScript.ORDER_NONE)
          }
          return ''
      }
    } catch (e) {
      console.warn(`Failed to get code for block ${block.id}:`, e)
      return ''
    }
  }

  // 获取输入块的代码
  private getInputBlockCode(block: any, inputName: string): string {
    const inputBlock = block.getInputTargetBlock(inputName)
    return inputBlock ? this.getBlockCode(inputBlock) : ''
  }

  // 公共 API：根据块 ID 获取位置
  getPositionForBlock(blockId: string): { startPos: number, endPos: number } | null {
    return this.blockPositions.get(blockId) || null
  }

  // 公共 API：根据位置查找块
  findBlockAtPosition(position: number): string | null {
    // 查找包含该位置的最小块（最精确的匹配）
    let bestMatch: { blockId: string, startPos: number, endPos: number } | null = null
    let bestSize = Infinity

    for (const item of this.positionToBlocks) {
      if (position >= item.startPos && position <= item.endPos) {
        const size = item.endPos - item.startPos
        if (size < bestSize) {
          bestSize = size
          bestMatch = item
        }
      }
    }

    return bestMatch?.blockId || null
  }

  // 查找选择范围内的所有块
  findBlocksInRange(startPos: number, endPos: number): string[] {
    const blocks: string[] = []

    for (const item of this.positionToBlocks) {
      // 检查是否有交集
      if (!(endPos <= item.startPos || startPos >= item.endPos)) {
        blocks.push(item.blockId)
      }
    }

    return blocks
  }

  // 调试：打印映射信息
  debugPrint() {
    console.log('=== Simple Highlight Mapper Debug ===')
    console.log('Block positions:')
    for (const [blockId, pos] of this.blockPositions.entries()) {
      console.log(`  ${blockId}: [${pos.startPos}-${pos.endPos}]`)
    }
    console.log('Position array:', this.positionToBlocks)
  }

  // 清空映射
  clear() {
    this.blockPositions.clear()
    this.positionToBlocks.length = 0
  }
}
