import { SystemState } from '@contracts'

/**
 * 状态机演示类
 * 用于模拟Blockly Monaco Editor的状态管理
 */
export class StateMachineDemo {
  private currentState: SystemState = SystemState.ALL_SYNCED
  private isRunning = false
  private intervalId: number | null = null

  /**
   * 启动状态机
   */
  start(): void {
    this.isRunning = true
    console.log('状态机已启动')
  }

  /**
   * 停止状态机
   */
  stop(): void {
    this.isRunning = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    console.log('状态机已停止')
  }

  /**
   * 获取当前状态
   * @returns 当前系统状态
   */
  getCurrentState(): SystemState {
    return this.currentState
  }

  /**
   * 模拟同步操作
   */
  simulateSync(): void {
    if (!this.isRunning) return
    this.currentState = SystemState.ALL_SYNCED
    console.log('模拟同步完成，状态变为:', this.currentState)
  }

  /**
   * 模拟Blockly编辑
   */
  simulateBlocklyEdit(): void {
    if (!this.isRunning) return
    this.currentState = SystemState.BLOCKLY_DIRTY
    console.log('模拟Blockly编辑，状态变为:', this.currentState)
  }

  /**
   * 模拟Monaco编辑
   */
  simulateMonacoEdit(): void {
    if (!this.isRunning) return
    this.currentState = SystemState.MONACO_DIRTY
    console.log('模拟Monaco编辑，状态变为:', this.currentState)
  }

  /**
   * 模拟冲突
   */
  simulateConflict(): void {
    if (!this.isRunning) return
    console.log('模拟冲突发生!')
  }
}

// 导出一个默认实例供全局使用
// export default new StateMachineDemo()