/**
 * 精确的数据流转换器 - 基于更精确的架构表达
 * 
 * 数据流: blockly <-> blockly结构(Object) <-> 中间结构(Object) <-> code(String) <-> monaco
 */

import type { Position } from './types'

// 分层转换器接口 - 明确区分对象转换和字符串序列化
export interface LayeredTransformer<TIntermediate = any> {
  // === 对象层转换 ===
  // Blockly结构(Object) <-> 中间结构(Object)
  blocklyToIntermediate(blocklyStructure: any): TIntermediate
  intermediateToBlockly(intermediate: TIntermediate): any

  // === 序列化层转换 ===
  // 中间结构(Object) <-> code(String)
  intermediateToCode(intermediate: TIntermediate): string
  codeToIntermediate(code: string): TIntermediate | null

  // === 完整链路转换 (便利方法) ===
  // Blockly结构 -> code(String)
  blocklyToCode(blocklyStructure: any): string
  // code(String) -> Blockly结构
  codeToBlockly(code: string): any | null

  // === 验证和格式化 ===
  validateIntermediate(intermediate: TIntermediate): { valid: boolean; errors: string[] }
  formatCode(code: string): string
}

// Blockly 结构的标准接口
export interface BlocklyStructure {
  type: string
  id?: string
  fields?: Record<string, any>
  inputs?: Record<string, any>
  next?: BlocklyStructure
  children?: BlocklyStructure[]
  workspace?: any
}

// 中间结构的基础接口
export interface IntermediateStructure {
  type: 'json' | 'mathjs' | 'typescript'
  version: string
  metadata?: Record<string, any>
}

// JSON 中间结构
export interface JsonIntermediate extends IntermediateStructure {
  type: 'json'
  data: any
}

// MathJS 中间结构
export interface MathJSIntermediate extends IntermediateStructure {
  type: 'mathjs'
  ast: any // MathJS AST 对象
  functions: string[]
  variables: string[]
}

// TypeScript 中间结构
export interface TypeScriptIntermediate extends IntermediateStructure {
  type: 'typescript'
  ast: any // TypeScript AST 对象
  imports: string[]
  exports: string[]
  functions: string[]
  variables: string[]
  types: string[]
}

// 数据流状态跟踪
export interface DataFlowState<T = any> {
  // 当前各层的数据状态
  blocklyStructure: any | null
  intermediateStructure: T | null
  codeString: string

  // 最后更新来源
  lastUpdateSource: 'blockly' | 'monaco' | 'intermediate'
  lastUpdateTime: number

  // 同步状态
  isInSync: boolean
  syncErrors: string[]
}

// 数据流管理器
export interface DataFlowManager<T = any> {
  // 获取当前状态
  getState(): DataFlowState<T>

  // 从不同层次更新数据
  updateFromBlockly(blocklyStructure: any): Promise<void>
  updateFromMonaco(code: string): Promise<void>
  updateFromIntermediate(intermediate: T): Promise<void>

  // 检查同步状态
  checkSyncStatus(): { inSync: boolean; conflicts: string[] }

  // 强制同步到特定目标
  forceSyncTo(target: 'blockly' | 'monaco'): Promise<void>

  // 事件监听
  onStateChange(callback: (state: DataFlowState<T>) => void): void
}

// 层次感知的高亮映射器
export interface LayeredHighlightMapper<T = any> {
  // 创建从中间结构到代码的映射
  createIntermediateToCodeMapping(intermediate: T, code: string): Map<string, Position>

  // 创建从 Blockly 结构到中间结构的映射
  createBlocklyToIntermediateMapping(blockly: any, intermediate: T): Map<string, string>

  // 完整的映射链: Blockly -> Intermediate -> Code
  createFullMapping(blockly: any, intermediate: T, code: string): {
    blocklyToIntermediate: Map<string, string>
    intermediateToCode: Map<string, Position>
    blocklyToCode: Map<string, Position>
  }

  // 根据位置反向查找
  findBlocklyElementByCodePosition(position: number, mapping: any): string | null
}
