<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { debounce } from 'lodash'
import * as monaco from 'monaco-editor'
import { validateExpression } from '../../generators/expression'

const props = defineProps({
  modelValue: { type: String, default: '' },
  theme: { type: String, default: 'vs-dark' },
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'editor-mounted', editor: monaco.editor.IStandaloneCodeEditor): void
}>()

const editorContainer = ref<HTMLElement | null>(null)
const editorInstance = ref<monaco.editor.IStandaloneCodeEditor | null>(null)

// 响应外部 modelValue 变化（父组件修改时同步到编辑器）
watch(
  () => props.modelValue,
  (newVal) => {
    const rawEditor = toRaw(editorInstance.value)
    if (!rawEditor) return
    if (newVal === rawEditor.getValue()) return
    rawEditor.setValue(newVal)
    rawEditor.pushUndoStop()
  }
)

// 动态切换主题
watch(
  () => props.theme,
  (newTheme) => {
    if (newTheme) {
      monaco.editor.setTheme(newTheme)
    }
  }
)

// 防抖 emit
const emitContentChange = debounce(() => {
  const value = toRaw(editorInstance.value)?.getValue() || ''
  if (value === props.modelValue) return

  if (validateExpression(value)) {
    emit('update:modelValue', value)
  } else {
    console.warn('[SYS] Monaco 编辑器表达式无效', value)
  }
}, 300)

// 初始化编辑器
onMounted(() => {
  if (!editorContainer.value) return

  // 注册自定义的数学表达式语言
  monaco.languages.register({ id: 'mathexpression' })

  // 设置语法高亮
  monaco.languages.setMonarchTokensProvider('mathexpression', {
    tokenizer: {
      root: [
        // 数字
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/\d+/, 'number'],

        // 函数名
        [/\b(sin|cos|tan|log|sqrt|abs|ceil|floor|round|exp|pi|e)\b/, 'keyword'],

        // 逻辑关键字
        [/\b(and|or|not|true|false)\b/, 'keyword'],

        // 比较操作符
        [/[<>]=?|[!=]=/, 'operator'],

        // 算术操作符
        [/[+\-*/^]/, 'operator'],

        // 条件操作符
        [/[?:]/, 'operator'],

        // 括号
        [/[()]/, 'delimiter'],

        // 变量
        [/[a-zA-Z_][a-zA-Z0-9_]*/, 'variable'],

        // 空白字符
        [/\s+/, 'white'],
      ],
    },
  })

  editorInstance.value = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: 'mathexpression',
    theme: props.theme,
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'off',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    scrollbar: {
      vertical: 'hidden',
      horizontal: 'hidden'
    }
  })

  // 注入样式到 Monaco 编辑器
  const styleElement = document.createElement('style')
  styleElement.textContent = `
    .monaco-editor {
      background-color: var(--vscode-editor-background);
    }
  `
  document.head.appendChild(styleElement)

  console.debug('Monaco editor initialized')

  // 监听内容变化 → 触发 v-model 更新
  editorInstance.value.onDidChangeModelContent(emitContentChange)

  emit('editor-mounted', toRaw(editorInstance.value)!)
})

// 暴露给父组件的方法
const resizeEditor = () => {
  const rawEditor = toRaw(editorInstance.value)
  if (rawEditor) {
    // 强制重新布局
    setTimeout(() => {
      rawEditor.layout()
    }, 50)
  }
}

// 暴露方法给父组件
defineExpose({
  resizeEditor
})

// 销毁实例
onBeforeUnmount(() => {
  toRaw(editorInstance.value)?.dispose()
  editorInstance.value = null
})
</script>

<template>
  <div ref="editorContainer" class="monaco-editor" />
</template>

<style scoped>
.monaco-editor {
  width: 100%;
  height: 100%;
  min-height: 300px;
  border: 1px solid #444;
}
</style>
