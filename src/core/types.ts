/**
 * 核心类型定义 - 为所有编辑器方案提供统一的类型基础
 */

// 基础编辑器接口
export interface BaseEditor {
  getValue(): string
  setValue(value: string): void
  focus(): void
  resize(): void
}

// 基础组件引用类型
export interface BaseComponentRef {
  getValue(): string
  setValue(value: string): void
  focus(): void
  resize(): void
}

// 位置信息
export interface Position {
  startPos: number
  endPos: number
}

// 选择信息
export interface SelectionInfo extends Position {
  id: string
  type: string
  content?: string
}

// 块信息 (Blockly)
export interface BlockInfo extends SelectionInfo {
  blockId: string
  expression?: string
}

// AST 节点信息
export interface ASTNodeInfo extends SelectionInfo {
  nodeId: string
  nodeType: string
  parent?: string
  children?: string[]
}

// 编辑器配置
export interface EditorConfig {
  readonly: boolean
  theme: 'vs' | 'vs-dark' | 'hc-black'
  language: string
  fontSize: number
  tabSize: number
}

// 分割面板配置
export interface SplitterConfig {
  storageKey: string
  defaultSize: number
  minSize: number
  maxSize: number
}

// 编辑器状态
export interface EditorState {
  content: string
  selection: SelectionInfo | null
  errors: string[]
  isLoading: boolean
}

// 同步事件类型
export interface SyncEvent {
  source: 'blockly' | 'monaco'
  type: 'content-change' | 'selection-change' | 'focus-change'
  data: any
}

// 抽象转换器接口
export interface AbstractTransformer<T = any> {
  // Blockly 结构 -> 中间表示
  fromBlockly(blocklyData: any): T

  // 中间表示 -> Monaco 文本
  toMonaco(data: T): string

  // Monaco 文本 -> 中间表示
  fromMonaco(text: string): T | null

  // 中间表示 -> Blockly 结构
  toBlockly(data: T): any

  // 验证中间表示
  validate(data: T): { valid: boolean; errors: string[] }

  // 格式化
  format(data: T): T
}

// 高亮映射器接口
export interface HighlightMapper<T = any> {
  // 创建映射关系
  createMapping(data: T, content: string): Map<string, Position>

  // 根据位置查找元素
  findElementByPosition(position: number, mapping: Map<string, Position>): string | null

  // 根据元素查找位置
  findPositionByElement(elementId: string, mapping: Map<string, Position>): Position | null

  // 更新映射
  updateMapping(data: T, content: string, mapping: Map<string, Position>): void
}

// 编辑器协调器接口
export interface EditorCoordinator<T = any> {
  // 设置转换器
  setTransformer(transformer: AbstractTransformer<T>): void

  // 设置高亮映射器
  setHighlightMapper(mapper: HighlightMapper<T>): void

  // 同步内容
  syncContent(source: 'blockly' | 'monaco', content: string): void

  // 同步选择
  syncSelection(source: 'blockly' | 'monaco', selection: SelectionInfo): void

  // 获取当前状态
  getState(): EditorState
}
