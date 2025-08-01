<script setup lang="ts">
import { ref } from 'vue'
import LayeredEditorComponent from './components/LayeredEditorComponent.vue'

// 测试表达式
const expression = ref('equalText(name, "John") and age > 18')
const showDebugPanel = ref(true)

const handleExpressionChange = (newExpression: string) => {
  console.log('表达式已更新:', newExpression)
}
</script>

<template>
  <div class="app-container">
    <div class="header">
      <h1>分层架构编辑器演示</h1>
      <div class="controls">
        <label>
          <input type="checkbox" v-model="showDebugPanel" />
          显示调试面板
        </label>
      </div>
    </div>

    <div class="editor-container">
      <LayeredEditorComponent v-model="expression" :show-debug-panel="showDebugPanel"
        @update:model-value="handleExpressionChange" />
    </div>

    <div class="footer">
      <h3>当前表达式：</h3>
      <pre><code>{{ expression }}</code></pre>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: 'Arial', sans-serif;
}

.header {
  padding: 20px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  margin: 0;
  color: #343a40;
  font-size: 24px;
}

.controls {
  display: flex;
  gap: 15px;
}

.controls label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
  cursor: pointer;
}

.editor-container {
  flex: 1;
  min-height: 500px;
}

.footer {
  padding: 15px 20px;
  background-color: #f8f9fa;
  border-top: 1px solid #dee2e6;
}

.footer h3 {
  margin: 0 0 10px 0;
  color: #495057;
  font-size: 16px;
}

.footer pre {
  margin: 0;
  padding: 10px;
  background-color: #e9ecef;
  border-radius: 4px;
  overflow-x: auto;
}

.footer code {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  color: #495057;
}
</style>
