<!--
  分层架构编辑器组件
  基于精确的数据流: blockly <-> blockly结构(Object) <-> 中间结构(Object) <-> code(String) <-> monaco
-->
<template>
  <div class="layered-editor">
    <!-- 状态显示区 -->
    <div class="status-bar">
      <div class="status-item">
        <span
          :class="['status-indicator', { 'synced': dataFlowState.isInSync, 'error': !dataFlowState.isInSync }]"></span>
        {{ dataFlowState.isInSync ? '已同步' : '同步错误' }}
      </div>
      <div class="status-item">
        最后更新: {{ formatUpdateSource(dataFlowState.lastUpdateSource) }}
      </div>
      <div class="status-item">
        <button @click="checkSync" class="sync-button">检查同步</button>
        <button @click="forceSyncToMonaco" class="sync-button">同步到代码</button>
        <button @click="forceSyncToBlockly" class="sync-button">同步到块</button>
      </div>
    </div>

    <!-- 错误显示区 -->
    <div v-if="dataFlowState.syncErrors.length > 0" class="error-panel">
      <h4>同步错误:</h4>
      <ul>
        <li v-for="error in dataFlowState.syncErrors" :key="error">{{ error }}</li>
      </ul>
      <button @click="clearErrors" class="clear-button">清除错误</button>
    </div>

    <!-- 编辑器区域 -->
    <splitpanes @resized="handlePaneResize" @ready="onSplitpanesReady">
      <pane :size="leftPaneSize" :min-size="20" :max-size="80">
        <div class="blockly-pane">
          <div class="pane-header">
            <h3>可视化编辑器 (Blockly)</h3>
            <div class="data-info">
              <small>Blockly结构: {{ hasBlocklyData ? '有数据' : '无数据' }}</small>
            </div>
          </div>
          <BlocklyExpressionComponent ref="blocklyRef" :model-value="blocklyValue"
            @update:model-value="handleBlocklyUpdate" @block-select="handleBlocklyBlockSelect" />
        </div>
      </pane>

      <pane :size="rightPaneSize">
        <div class="monaco-pane">
          <div class="pane-header">
            <h3>代码编辑器 (Monaco)</h3>
            <div class="data-info">
              <small>中间结构: {{ hasIntermediateData ? '有数据' : '无数据' }}</small>
              <small>代码长度: {{ dataFlowState.codeString.length }}</small>
            </div>
          </div>
          <MonacoExpressionEditor ref="monacoRef" :model-value="monacoValue" @update:model-value="handleMonacoUpdate"
            @editor-mounted="handleMonacoEditorMounted" />
        </div>
      </pane>
    </splitpanes>

    <!-- 调试面板 (开发模式) -->
    <div v-if="showDebugPanel" class="debug-panel">
      <h4>数据流调试</h4>
      <div class="debug-tabs">
        <button v-for="tab in debugTabs" :key="tab" :class="['tab-button', { active: activeDebugTab === tab }]"
          @click="activeDebugTab = tab">
          {{ tab }}
        </button>
      </div>
      <div class="debug-content">
        <pre v-if="activeDebugTab === 'Blockly结构'">{{ JSON.stringify(dataFlowState.blocklyStructure, null, 2) }}</pre>
        <pre v-if="activeDebugTab === '中间结构'">{{ JSON.stringify(dataFlowState.intermediateStructure, null, 2) }}</pre>
        <pre v-if="activeDebugTab === '代码字符串'">{{ dataFlowState.codeString }}</pre>
        <pre v-if="activeDebugTab === '状态'">{{ JSON.stringify(dataFlowState, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

import BlocklyExpressionComponent from './expression/BlocklyExpressionComponent.vue'
import MonacoExpressionEditor from './expression/MonacoExpressionEditor.vue'

import { MathJSLayeredTransformer } from '../transformers/MathJSLayeredTransformer'
import { LayeredDataFlowManager } from '../core/LayeredDataFlowManager'
import type { DataFlowState, MathJSIntermediate } from '../core/layeredTypes'

interface Props {
  modelValue: string
  showDebugPanel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showDebugPanel: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// 分层架构核心
const transformer = new MathJSLayeredTransformer()
const dataFlowManager = new LayeredDataFlowManager<MathJSIntermediate>(transformer)

// 数据流状态
const dataFlowState = ref<DataFlowState<MathJSIntermediate>>({
  blocklyStructure: null,
  intermediateStructure: null,
  codeString: props.modelValue,
  lastUpdateSource: 'monaco',
  lastUpdateTime: Date.now(),
  isInSync: true,
  syncErrors: []
})

// UI 状态
const leftPaneSize = ref(50)
const rightPaneSize = computed(() => 100 - leftPaneSize.value)
const blocklyRef = ref()
const monacoRef = ref()

// 调试面板
const debugTabs = ['Blockly结构', '中间结构', '代码字符串', '状态']
const activeDebugTab = ref('中间结构')

// 计算属性
const blocklyValue = computed(() => {
  // 这里需要将 Blockly 结构转换为组件期望的格式
  return dataFlowState.value.blocklyStructure ?
    JSON.stringify(dataFlowState.value.blocklyStructure) : ''
})

const monacoValue = computed(() => dataFlowState.value.codeString)

const hasBlocklyData = computed(() => !!dataFlowState.value.blocklyStructure)
const hasIntermediateData = computed(() => !!dataFlowState.value.intermediateStructure)

// 事件处理
const handleBlocklyUpdate = async (value: string) => {
  try {
    // 将字符串解析为 Blockly 结构
    const blocklyStructure = value ? JSON.parse(value) : null
    await dataFlowManager.updateFromBlockly(blocklyStructure)
  } catch (error) {
    console.error('Blockly update failed:', error)
  }
}

const handleBlocklyBlockSelect = (blockInfo: any) => {
  // 处理块选择事件，可以实现高亮同步
  console.debug('Block selected:', blockInfo)
}

const handleMonacoUpdate = async (code: string) => {
  try {
    await dataFlowManager.updateFromMonaco(code)
  } catch (error) {
    console.error('Monaco update failed:', error)
  }
}

const handleSelectionChange = (selection: any) => {
  // 处理选择变化，可以实现高亮同步
  console.debug('Selection change:', selection)
}

const handleMonacoEditorMounted = (editor: any) => {
  // 处理 Monaco 编辑器挂载事件
  console.debug('Monaco editor mounted:', editor)

  // 可以在这里添加选择变化监听器
  editor.onDidChangeCursorSelection?.((e: any) => {
    handleSelectionChange(e)
  })
}

// 同步控制
const checkSync = () => {
  const result = dataFlowManager.checkSyncStatus()
  if (!result.inSync) {
    console.warn('同步冲突:', result.conflicts)
  } else {
    console.log('数据已同步')
  }
}

const forceSyncToMonaco = async () => {
  await dataFlowManager.forceSyncTo('monaco')
}

const forceSyncToBlockly = async () => {
  await dataFlowManager.forceSyncTo('blockly')
}

const clearErrors = () => {
  dataFlowState.value.syncErrors = []
}

// 工具函数
const formatUpdateSource = (source: string) => {
  const sourceMap: Record<string, string> = {
    'blockly': '可视化编辑器',
    'monaco': '代码编辑器',
    'intermediate': '中间结构'
  }
  return sourceMap[source] || source
}

// 分割面板
const handlePaneResize = (panes: { size: number }[]) => {
  if (panes.length > 0) {
    leftPaneSize.value = panes[0].size
  }
}

const onSplitpanesReady = () => {
  // 调整编辑器尺寸
  setTimeout(() => {
    blocklyRef.value?.resizeWorkspace()
    monacoRef.value?.resizeEditor()
  }, 100)
}

// 生命周期
onMounted(() => {
  // 监听数据流状态变化
  dataFlowManager.onStateChange((newState: DataFlowState<MathJSIntermediate>) => {
    dataFlowState.value = newState

    // 发出 modelValue 更新事件
    emit('update:modelValue', newState.codeString)
  })

  // 初始化数据流
  if (props.modelValue) {
    dataFlowManager.updateFromMonaco(props.modelValue)
  }
})

onUnmounted(() => {
  // 清理资源
})

// 监听外部 modelValue 变化
watch(() => props.modelValue, (newValue) => {
  if (newValue !== dataFlowState.value.codeString) {
    dataFlowManager.updateFromMonaco(newValue)
  }
})
</script>

<style scoped>
.layered-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 8px 16px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  font-size: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #28a745;
}

.status-indicator.error {
  background-color: #dc3545;
}

.sync-button {
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid #ced4da;
  background-color: white;
  cursor: pointer;
  border-radius: 3px;
}

.sync-button:hover {
  background-color: #e9ecef;
}

.error-panel {
  padding: 10px 16px;
  background-color: #f8d7da;
  border-bottom: 1px solid #f5c6cb;
  color: #721c24;
}

.error-panel h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
}

.error-panel ul {
  margin: 0 0 8px 0;
  padding-left: 20px;
  font-size: 11px;
}

.clear-button {
  padding: 2px 6px;
  font-size: 10px;
  background-color: #f5c6cb;
  border: 1px solid #f1aeb5;
  cursor: pointer;
  border-radius: 2px;
}

.blockly-pane,
.monaco-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.blockly-pane> :not(.pane-header),
.monaco-pane> :not(.pane-header) {
  flex: 1;
  min-height: 0;
}

.pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.pane-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

.data-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: right;
}

.data-info small {
  font-size: 10px;
  color: #6c757d;
}

.debug-panel {
  border-top: 1px solid #dee2e6;
  background-color: #f8f9fa;
  max-height: 300px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.debug-panel h4 {
  margin: 0;
  padding: 8px 12px;
  font-size: 12px;
  background-color: #e9ecef;
  border-bottom: 1px solid #dee2e6;
}

.debug-tabs {
  display: flex;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.tab-button {
  padding: 6px 12px;
  font-size: 11px;
  border: none;
  background-color: transparent;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.tab-button.active {
  background-color: white;
  border-bottom-color: #007bff;
}

.debug-content {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.debug-content pre {
  margin: 0;
  font-size: 10px;
  font-family: 'Monaco', 'Consolas', monospace;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
