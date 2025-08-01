/**
 * 数据流管理器 - 管理精确的分层数据转换
 * 
 * 管理数据流: blockly <-> blockly结构(Object) <-> 中间结构(Object) <-> code(String) <-> monaco
 */

import type {
  DataFlowManager,
  DataFlowState,
  LayeredTransformer
} from '../core/layeredTypes'

export class LayeredDataFlowManager<T = any> implements DataFlowManager<T> {
  private state: DataFlowState<T>
  private transformer: LayeredTransformer<T>
  private listeners: Array<(state: DataFlowState<T>) => void> = []

  constructor(transformer: LayeredTransformer<T>) {
    this.transformer = transformer
    this.state = {
      blocklyStructure: null,
      intermediateStructure: null,
      codeString: '',
      lastUpdateSource: 'monaco',
      lastUpdateTime: Date.now(),
      isInSync: true,
      syncErrors: []
    }
  }

  getState(): DataFlowState<T> {
    return { ...this.state }
  }

  async updateFromBlockly(blocklyStructure: any): Promise<void> {
    try {
      this.state.syncErrors = []

      // 第1步: 更新 Blockly 结构
      this.state.blocklyStructure = blocklyStructure

      // 第2步: Blockly结构 -> 中间结构
      this.state.intermediateStructure = this.transformer.blocklyToIntermediate(blocklyStructure)

      // 第3步: 中间结构 -> 代码字符串
      this.state.codeString = this.transformer.intermediateToCode(this.state.intermediateStructure)

      // 更新状态
      this.state.lastUpdateSource = 'blockly'
      this.state.lastUpdateTime = Date.now()
      this.state.isInSync = true

      this.notifyListeners()
    } catch (error) {
      this.handleError('updateFromBlockly', error)
    }
  }

  async updateFromMonaco(code: string): Promise<void> {
    try {
      this.state.syncErrors = []

      // 第1步: 更新代码字符串
      this.state.codeString = code

      // 第2步: 代码字符串 -> 中间结构
      const intermediate = this.transformer.codeToIntermediate(code)
      if (!intermediate) {
        throw new Error('Failed to parse code to intermediate structure')
      }
      this.state.intermediateStructure = intermediate

      // 第3步: 中间结构 -> Blockly结构
      this.state.blocklyStructure = this.transformer.intermediateToBlockly(intermediate)

      // 更新状态
      this.state.lastUpdateSource = 'monaco'
      this.state.lastUpdateTime = Date.now()
      this.state.isInSync = true

      this.notifyListeners()
    } catch (error) {
      this.handleError('updateFromMonaco', error)
    }
  }

  async updateFromIntermediate(intermediate: T): Promise<void> {
    try {
      this.state.syncErrors = []

      // 验证中间结构
      const validation = this.transformer.validateIntermediate(intermediate)
      if (!validation.valid) {
        throw new Error(`Invalid intermediate structure: ${validation.errors.join(', ')}`)
      }

      // 第1步: 更新中间结构
      this.state.intermediateStructure = intermediate

      // 第2步: 中间结构 -> 代码字符串
      this.state.codeString = this.transformer.intermediateToCode(intermediate)

      // 第3步: 中间结构 -> Blockly结构
      this.state.blocklyStructure = this.transformer.intermediateToBlockly(intermediate)

      // 更新状态
      this.state.lastUpdateSource = 'intermediate'
      this.state.lastUpdateTime = Date.now()
      this.state.isInSync = true

      this.notifyListeners()
    } catch (error) {
      this.handleError('updateFromIntermediate', error)
    }
  }

  checkSyncStatus(): { inSync: boolean; conflicts: string[] } {
    const conflicts: string[] = []

    try {
      // 检查 Blockly -> 中间结构 -> 代码 的一致性
      if (this.state.blocklyStructure && this.state.intermediateStructure) {
        const intermediateFromBlockly = this.transformer.blocklyToIntermediate(this.state.blocklyStructure)
        const codeFromIntermediate = this.transformer.intermediateToCode(intermediateFromBlockly)

        if (codeFromIntermediate !== this.state.codeString) {
          conflicts.push('Blockly structure and code string are not in sync')
        }
      }

      // 检查 代码 -> 中间结构 -> Blockly 的一致性
      if (this.state.codeString && this.state.intermediateStructure) {
        const intermediateFromCode = this.transformer.codeToIntermediate(this.state.codeString)
        if (!intermediateFromCode) {
          conflicts.push('Code string cannot be parsed to intermediate structure')
        } else {
          const blocklyFromIntermediate = this.transformer.intermediateToBlockly(intermediateFromCode)
          // 这里需要深度比较 Blockly 结构，简化为字符串比较
          if (JSON.stringify(blocklyFromIntermediate) !== JSON.stringify(this.state.blocklyStructure)) {
            conflicts.push('Code string and Blockly structure are not in sync')
          }
        }
      }
    } catch (error) {
      conflicts.push(`Sync check failed: ${error}`)
    }

    const inSync = conflicts.length === 0
    this.state.isInSync = inSync

    return { inSync, conflicts }
  }

  async forceSyncTo(target: 'blockly' | 'monaco'): Promise<void> {
    try {
      if (target === 'blockly') {
        // 强制同步到 Blockly: 从代码字符串开始
        if (this.state.codeString) {
          await this.updateFromMonaco(this.state.codeString)
        }
      } else {
        // 强制同步到 Monaco: 从 Blockly 结构开始
        if (this.state.blocklyStructure) {
          await this.updateFromBlockly(this.state.blocklyStructure)
        }
      }
    } catch (error) {
      this.handleError(`forceSyncTo-${target}`, error)
    }
  }

  onStateChange(callback: (state: DataFlowState<T>) => void): void {
    this.listeners.push(callback)
  }

  // 移除事件监听器
  removeStateChangeListener(callback: (state: DataFlowState<T>) => void): void {
    const index = this.listeners.indexOf(callback)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  // 获取当前数据的各种表示
  getCurrentRepresentations(): {
    blocklyStructure: any | null
    intermediateStructure: T | null
    codeString: string
    formattedCode: string
  } {
    const formattedCode = this.state.codeString ?
      this.transformer.formatCode(this.state.codeString) : ''

    return {
      blocklyStructure: this.state.blocklyStructure,
      intermediateStructure: this.state.intermediateStructure,
      codeString: this.state.codeString,
      formattedCode
    }
  }

  // 重置状态
  reset(): void {
    this.state = {
      blocklyStructure: null,
      intermediateStructure: null,
      codeString: '',
      lastUpdateSource: 'monaco',
      lastUpdateTime: Date.now(),
      isInSync: true,
      syncErrors: []
    }
    this.notifyListeners()
  }

  private handleError(operation: string, error: any): void {
    const errorMessage = `${operation}: ${error}`
    console.error(errorMessage)

    this.state.syncErrors.push(errorMessage)
    this.state.isInSync = false
    this.notifyListeners()
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState())
      } catch (error) {
        console.error('Error in state change listener:', error)
      }
    })
  }
}
