/**
 * 新架构使用示例
 */
import { createApp } from 'vue'
import {
  JsonTransformer,
  MathJSTransformer,
  TypeScriptTransformer,
  MathJSHighlightMapper,
  useBaseEditor
} from '../src/architecture'

// 示例 1: 使用 JSON 转换器
const jsonTransformer = new JsonTransformer()

// Blockly 数据转换为 Monaco JSON
const blocklyData = { type: 'number', value: 42 }
const jsonData = jsonTransformer.fromBlockly(blocklyData)
const monacoContent = jsonTransformer.toMonaco(jsonData)
console.log('JSON Monaco content:', monacoContent)

// 示例 2: 使用 MathJS 转换器
const mathTransformer = new MathJSTransformer()
const mathHighlightMapper = new MathJSHighlightMapper()

// 表达式转换
const expression = 'equalText(name, "John") and age > 18'
const mathData = mathTransformer.fromMonaco(expression)
if (mathData) {
  console.log('MathJS Data:', mathData)

  // 创建位置映射
  const mapping = mathHighlightMapper.createMapping(mathData, expression)
  console.log('Position mapping:', mapping)
}

// 示例 3: 使用 TypeScript 转换器（为方案三做准备）
const tsTransformer = new TypeScriptTransformer()

// TypeScript 代码转换
const tsCode = `
function validateUser(name: string, age: number): boolean {
  return name.length > 0 && age >= 18;
}
`

const tsData = tsTransformer.fromMonaco(tsCode)
if (tsData) {
  console.log('TypeScript Data:', tsData)

  // 验证代码
  const validation = tsTransformer.validate(tsData)
  console.log('Validation result:', validation)

  // 格式化代码
  const formatted = tsTransformer.format(tsData)
  console.log('Formatted code:', formatted.code)
}

// 示例 4: 在 Vue 组件中使用基础编辑器
/*
<script setup>
import { useBaseEditor } from '../src/architecture'
import { MathJSTransformer } from '../src/architecture'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const {
  code,
  editorState,
  syncContent,
  clearErrors
} = useBaseEditor(props, emit, {
  modelValue: props.modelValue,
  splitterConfig: {
    storageKey: 'my-editor-position',
    defaultSize: 50,
    minSize: 20,
    maxSize: 80
  },
  transformer: new MathJSTransformer()
})

// 处理编辑器变化
const handleChange = async (source, value) => {
  try {
    await syncContent(source, value)
  } catch (error) {
    console.error('Sync failed:', error)
  }
}
</script>
*/
