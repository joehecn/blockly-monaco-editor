<template>
  <div id="app">
    <header class="app-header">
      <h1>Blockly Monaco Editor</h1>
      <p>基于五层双流状态模型的可视化编程编辑器</p>
    </header>

    <main class="app-main">
      <div class="editor-container">
        <div class="blockly-panel">
          <h2>Blockly 可视化编辑器</h2>
          <div id="blockly-div" class="editor-content">
            <!-- Blockly 工作区将在这里渲染 -->
          </div>
          <button @click="simulateBlocklyEdit" class="edit-button">模拟编辑</button>
        </div>

        <div class="sync-controls">
          <div class="state-indicator">
            <span class="state-label">当前状态:</span>
            <span :class="['state-badge', stateClass]">{{ currentState }}</span>
          </div>
          <button @click="syncData" class="sync-button" :disabled="!canSync">
            双向同步
          </button>
          <button @click="simulateConflict" class="conflict-button">模拟冲突</button>
        </div>

        <div class="monaco-panel">
          <h2>Monaco 代码编辑器</h2>
          <div id="monaco-div" class="editor-content">
            <!-- Monaco 编辑器将在这里渲染 -->
          </div>
          <button @click="simulateMonacoEdit" class="edit-button">模拟编辑</button>
        </div>
      </div>

      <div class="visualizer-container">
        <h2>状态机可视化调试</h2>
        <canvas id="state-machine-visualizer"></canvas>
      </div>
    </main>

  <div class="test-section">
    <ContractTest />
  </div>
</div>
</template>

<style scoped>
.test-section {
  padding: 20px;
  margin-top: 30px;
  border-top: 1px solid #eee;
}
</style>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { StateMachineDemo } from './state-machine-demo'
import { SystemState } from '@contracts'
import ContractTest from './components/ContractTest.vue'

// 创建状态机演示实例
const stateMachineDemo = new StateMachineDemo()

// 响应式状态
const currentState = ref<SystemState>(SystemState.ALL_SYNCED)

// 计算状态样式类
const stateClass = computed(() => {
  const stateMap = {
    [SystemState.ALL_SYNCED]: 'synced',
    [SystemState.BLOCKLY_DIRTY]: 'dirty',
    [SystemState.MONACO_DIRTY]: 'dirty',
    [SystemState.SYNC_PROCESSING]: 'syncing'
  }
  return stateMap[currentState.value]
})

// 计算是否可以同步
const canSync = computed(() => {
  return true
})

// 同步数据
const syncData = () => {
  console.log('执行双向同步...')
  stateMachineDemo.simulateSync()
  updateCurrentState()
}

// 模拟Blockly编辑
const simulateBlocklyEdit = () => {
  stateMachineDemo.simulateBlocklyEdit()
  updateCurrentState()
}

// 模拟Monaco编辑
const simulateMonacoEdit = () => {
  stateMachineDemo.simulateMonacoEdit()
  updateCurrentState()
}

// 模拟冲突
const simulateConflict = () => {
  stateMachineDemo.simulateConflict()
  updateCurrentState()
}

// 更新当前状态
const updateCurrentState = () => {
  currentState.value = stateMachineDemo.getCurrentState()
}

// 组件挂载时
onMounted(() => {
  stateMachineDemo.start()
  // 定期更新状态
  setInterval(updateCurrentState, 500)
})

// 组件卸载时
onUnmounted(() => {
  stateMachineDemo.stop()
})
</script>

<style scoped>
.app-header {
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  margin-bottom: 20px;
}

.app-header h1 {
  margin: 0 0 10px 0;
  font-size: 2.5em;
}

.app-header p {
  margin: 0;
  opacity: 0.9;
}

.editor-container {
  display: flex;
  height: calc(100vh - 200px);
  gap: 20px;
  padding: 0 20px;
}

.blockly-panel,
.monaco-panel {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.blockly-panel h2,
.monaco-panel h2 {
  margin: 0;
  padding: 15px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  font-size: 1.2em;
}

.editor-content {
  height: calc(100% - 60px);
  background: #fafafa;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}

.sync-controls {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 20px;
  gap: 20px;
  min-width: 200px;
}

.state-indicator {
  text-align: center;
}

.state-label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #333;
}

.state-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.9em;
  font-weight: bold;
  text-transform: uppercase;
}

.state-badge.synced {
  background: #4caf50;
  color: white;
}

.state-badge.dirty {
  background: #ff9800;
  color: white;
}

.state-badge.flowing {
  background: #2196f3;
  color: white;
  animation: pulse 2s infinite;
}

.sync-button {
  padding: 12px 24px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1em;
  transition: background 0.3s;
}

.sync-button:hover:not(:disabled) {
  background: #5a6fd8;
}

.sync-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.conflict-button {
  padding: 8px 16px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background 0.3s;
  margin-top: 10px;
}

.conflict-button:hover {
  background: #d32f2f;
}

.edit-button {
  padding: 8px 16px;
  background: #764ba2;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background 0.3s;
  margin-top: 10px;
}

.edit-button:hover {
  background: #5d4037;
}

.visualizer-container {
  margin: 20px;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #f9f9f9;
}

.visualizer-container h2 {
  margin-top: 0;
  font-size: 1.2em;
  color: #333;
}

#state-machine-visualizer {
  width: 100%;
  height: 400px;
  background: white;
  border: 1px solid #eee;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.7;
  }
}
</style>
