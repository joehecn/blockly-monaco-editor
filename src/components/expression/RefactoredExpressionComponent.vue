<!--
  重构后的表达式组件 - 使用新的分层架构
-->
<template>
  <div class="editor-container">
    <splitpanes @resized="handlePaneResize" @ready="onSplitpanesReady" :horizontal="false">
      <pane :size="leftPaneSize" :min-size="20" :max-size="80">
        <div class="blockly-pane">
          <h3>可视化编辑器</h3>
          <BlocklyExpressionComponent ref="blocklyComponentRef" :model-value="code"
            @update:model-value="handleBlocklyChange" @block-select="handleBlocklyBlockSelect" />
        </div>
      </pane>

      <pane :size="rightPaneSize">
        <div class="monaco-pane">
          <h3>代码编辑器</h3>
          <div class="editor-info" v-if="editorState.errors.length > 0">
            <div class="errors">
              <h4>错误信息:</h4>
              <ul>
                <li v-for="error in editorState.errors" :key="error">{{ error }}</li>
              </ul>
              <button @click="clearErrors">清除错误</button>
            </div>
          </div>
          <MonacoExpressionEditor ref="monacoEditorRef" :model-value="code" @update:model-value="handleMonacoChange"
            @editor-mounted="handleMonacoEditorMounted" />
        </div>
      </pane>
    </splitpanes>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

import BlocklyExpressionComponent from './BlocklyExpressionComponent.vue'
import MonacoExpressionEditor from './MonacoExpressionEditor.vue'

import { MathJSLayeredTransformer } from '../../transformers/MathJSLayeredTransformer'
import { LayeredDataFlowManager } from '../../core/LayeredDataFlowManager'
import type { MathJSIntermediate } from '../../core/layeredTypes'

interface Props {
  modelValue: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// 分层架构核心
const transformer = new MathJSLayeredTransformer()
const dataFlowManager = new LayeredDataFlowManager<MathJSIntermediate>(transformer)

// 响应式状态
const code = ref(props.modelValue)
const editorState = ref({
  errors: [] as string[],
  isInSync: true,
  lastUpdateSource: 'monaco' as 'blockly' | 'monaco'
})

// 分割面板状态
const leftPaneSize = ref(50)
const rightPaneSize = computed(() => 100 - leftPaneSize.value)

// 组件引用
const blocklyComponentRef = ref()
const monacoEditorRef = ref()

// 同步状态
const isSyncing = ref(false)

// 工具函数
const clearErrors = () => {
  editorState.value.errors = []
}

const addError = (error: string) => {
  editorState.value.errors.push(error)
}

// 分割面板处理
const handlePaneResize = (panes: { size: number }[]) => {
  if (panes.length > 0) {
    leftPaneSize.value = panes[0].size
  }
}

const onSplitpanesReady = () => {
  // 调整编辑器尺寸
  setTimeout(() => {
    blocklyComponentRef.value?.resize?.()
    monacoEditorRef.value?.resize?.()
  }, 100)
}

// 数据同步函数
const syncContent = async (source: 'blockly' | 'monaco', newValue: string) => {
  if (isSyncing.value) return

  isSyncing.value = true
  try {
    if (source === 'blockly') {
      // 从 Blockly 更新
      await dataFlowManager.updateFromMonaco(newValue)
    } else {
      // 从 Monaco 更新
      await dataFlowManager.updateFromMonaco(newValue)
    }

    code.value = newValue
    emit('update:modelValue', newValue)
    editorState.value.lastUpdateSource = source
    editorState.value.isInSync = true

  } catch (error) {
    console.error('同步失败:', error)
    addError(`同步失败: ${error}`)
    editorState.value.isInSync = false
  } finally {
    isSyncing.value = false
  }
}

// 选择同步（暂时简化）
const syncSelection = (source: 'blockly' | 'monaco', selection: any) => {
  console.debug(`Selection from ${source}:`, selection)
  // 这里可以实现高亮同步逻辑
}

// 处理 Blockly 变化
const handleBlocklyChange = async (newValue: string) => {
  if (!isSyncing.value) {
    try {
      await syncContent('blockly', newValue)
    } catch (error) {
      addError(`Blockly sync error: ${error}`)
    }
  }
}

// 处理 Monaco 变化
const handleMonacoChange = async (newValue: string) => {
  if (!isSyncing.value) {
    try {
      await syncContent('monaco', newValue)
    } catch (error) {
      addError(`Monaco sync error: ${error}`)
    }
  }
}

// 处理 Blockly 块选择
const handleBlocklyBlockSelect = (blockInfo: { blockId: string, expression: string, startPos: number, endPos: number }) => {
  const selection = {
    id: blockInfo.blockId,
    type: 'block',
    startPos: blockInfo.startPos,
    endPos: blockInfo.endPos,
    content: blockInfo.expression
  }

  syncSelection('blockly', selection)
}

// 处理 Monaco 选择变化
const handleMonacoSelectionChange = (selection: { startPos: number, endPos: number, text: string }) => {
  const selectionInfo = {
    id: `monaco_${Date.now()}`,
    type: 'text',
    startPos: selection.startPos,
    endPos: selection.endPos,
    content: selection.text
  }

  syncSelection('monaco', selectionInfo)
}

// 处理 Monaco 编辑器挂载
const handleMonacoEditorMounted = (editor: any) => {
  // 监听选择变化
  editor.onDidChangeCursorSelection?.((e: any) => {
    const model = editor.getModel()
    if (!model) return

    const startOffset = model.getOffsetAt(e.selection.getStartPosition())
    const endOffset = model.getOffsetAt(e.selection.getEndPosition())
    const selectedText = model.getValueInRange(e.selection)

    handleMonacoSelectionChange({
      startPos: startOffset,
      endPos: endOffset,
      text: selectedText
    })
  })
}
</script>

<style scoped>
.editor-container {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.blockly-pane,
.monaco-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.blockly-pane h3,
.monaco-pane h3 {
  margin: 0;
  padding: 10px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
  font-size: 14px;
  font-weight: 500;
}

.editor-info {
  padding: 10px;
  background-color: #fff3cd;
  border-bottom: 1px solid #ffeaa7;
}

.errors {
  color: #856404;
}

.errors h4 {
  margin: 0 0 10px 0;
  font-size: 12px;
}

.errors ul {
  margin: 0 0 10px 0;
  padding-left: 20px;
  font-size: 11px;
}

.errors button {
  padding: 4px 8px;
  font-size: 11px;
  background-color: #ffc107;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}

.errors button:hover {
  background-color: #e0a800;
}
</style>
