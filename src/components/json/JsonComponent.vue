<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { throttle } from 'lodash'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

import BlocklyComponent from './BlocklyComponent.vue'
import MonacoEditor from './MonacoEditor.vue'

interface Props {
  modelValue: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const code = computed({
  get: () => props.modelValue,
  set: (val: string) => emit('update:modelValue', val)
})

// 分割面板大小管理 - 预先从 localStorage 读取
const getSavedSize = () => {
  const savedSize = localStorage.getItem('json-editor-splitter-position')
  if (savedSize) {
    const size = Number(savedSize)
    if (size >= 20 && size <= 80) {
      return size
    }
  }
  return 50 // 默认值
}

const leftPaneSize = ref(getSavedSize()) // 直接使用保存的值作为初始值
const blocklyComponentRef = ref<InstanceType<typeof BlocklyComponent> | null>(null)
const monacoEditorRef = ref<InstanceType<typeof MonacoEditor> | null>(null)
const splitpanesReady = ref(false) // 标记 splitpanes 是否已准备好

// 计算右侧面板大小
const rightPaneSize = computed(() => 100 - leftPaneSize.value)

// splitpanes 准备就绪事件
const onSplitpanesReady = () => {
  splitpanesReady.value = true

  // 由于已经预先设置了正确的 leftPaneSize，这里只需要调整编辑器尺寸
  nextTick(() => {
    const resizeEditors = () => {
      if (blocklyComponentRef.value) {
        blocklyComponentRef.value.resizeWorkspace()
      }
      if (monacoEditorRef.value) {
        monacoEditorRef.value.resizeEditor()
      }
    }

    // 稍微延迟以确保 splitpanes 完全渲染
    setTimeout(resizeEditors, 100)
    setTimeout(resizeEditors, 300)
  })
}

// 处理面板大小变化
const handleResize = throttle((event: any) => {
  // 根据 splitpanes 文档，resize 事件返回包含 prevPane 属性的对象
  if (event && event.prevPane && typeof event.prevPane.size === 'number') {
    const newSize = event.prevPane.size
    leftPaneSize.value = newSize
    localStorage.setItem('json-editor-splitter-position', newSize.toString())
  }

  // 通知编辑器重新计算尺寸
  nextTick(() => {
    // 通知 Blockly 重新计算尺寸
    if (blocklyComponentRef.value) {
      blocklyComponentRef.value.resizeWorkspace()
    }

    // 通知 Monaco 重新布局
    if (monacoEditorRef.value) {
      monacoEditorRef.value.resizeEditor()
    }
  })
}, 100)

// 重置到默认布局
const resetLayout = () => {
  leftPaneSize.value = 50
  localStorage.setItem('json-editor-splitter-position', '50')
  nextTick(() => {
    // 模拟正确的事件格式来触发编辑器重新布局
    handleResize({ prevPane: { size: 50 } })
  })
}

// 从 localStorage 恢复位置 - 简化版本，主要逻辑移到 ready 事件
onMounted(() => {
  // 组件挂载完成
})

// 暴露方法给父组件（如果需要）
defineExpose({
  resetLayout
})

</script>

<template>
  <div class="container">
    <div class="toolbar">
      <button @click="resetLayout" class="reset-button" title="重置布局为 50/50">
        重置布局
      </button>
    </div>
    <Splitpanes class="default-theme main-splitpanes" @resize="handleResize" @ready="onSplitpanesReady"
      :dbl-click-splitter="false">
      <Pane :size="leftPaneSize" :min-size="20" :max-size="80" class="blockly-pane">
        <BlocklyComponent ref="blocklyComponentRef" v-model="code" :parent-ready="splitpanesReady" />
      </Pane>
      <Pane :size="rightPaneSize" class="code-pane">
        <MonacoEditor ref="monacoEditorRef" v-model="code" />
      </Pane>
    </Splitpanes>
  </div>
</template>

<style scoped>
.container {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.toolbar {
  height: 40px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  padding: 0 12px;
  flex-shrink: 0;
}

.reset-button {
  background: #ffffff;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-button:hover {
  background: #007ACC;
  color: white;
  border-color: #007ACC;
}

.main-splitpanes {
  flex: 1;
  height: calc(100% - 40px);
}

.blockly-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.code-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 自定义分割线样式 */
:deep(.splitpanes__splitter) {
  background: #e0e0e0;
  position: relative;
  transition: background-color 0.2s ease;
}

/* 禁用 pane 的默认过渡动画以减少初始化时的抖动 */
:deep(.splitpanes__pane) {
  transition: none !important;
}

:deep(.splitpanes__splitter:hover) {
  background: #007ACC;
}

:deep(.splitpanes__splitter::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  z-index: 1;
}

/* 确保分割线在拖拽时有足够的点击区域 */
:deep(.splitpanes--vertical > .splitpanes__splitter) {
  width: 4px;
  border-left: 2px solid transparent;
  border-right: 2px solid transparent;
  background-clip: content-box;
}

/* 为分割线添加视觉指示器 */
:deep(.splitpanes__splitter::after) {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 40px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 1px;
  transition: background 0.2s ease;
}

:deep(.splitpanes__splitter:hover::after) {
  background: rgba(255, 255, 255, 0.8);
}
</style>