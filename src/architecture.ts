/**
 * 核心架构导出文件
 */

// 核心类型
export * from './core/types'
export { useBaseEditor } from './core/useBaseEditor'

// 转换器
export { JsonTransformer } from './transformers/JsonTransformer'
export { MathJSTransformer } from './transformers/MathJSTransformer'
export { TypeScriptTransformer } from './transformers/TypeScriptTransformer'

// 高亮映射器
export { MathJSHighlightMapper } from './highlightMappers/MathJSHighlightMapper'

// 类型定义
export type { JsonData } from './transformers/JsonTransformer'
export type { MathJSData } from './transformers/MathJSTransformer'
export type { TypeScriptData } from './transformers/TypeScriptTransformer'
