<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { debounce } from 'lodash'

import * as monaco from 'monaco-editor'

const props = defineProps({
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'json' },
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

// 动态切换语言
watch(
  () => props.language,
  (newLang) => {
    const model = toRaw(editorInstance.value)?.getModel()
    if (model && newLang) {
      monaco.editor.setModelLanguage(model, newLang)
    }
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

  try {
    JSON.parse(value)
    emit('update:modelValue', value)
  } catch (e) {
    console.warn('[SYS] Monaco 编辑器内容解析失败', e)
  }
}, 300)

// 初始化编辑器
onMounted(() => {
  if (!editorContainer.value) return

  editorInstance.value = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: props.language,
    theme: props.theme,
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
  })

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