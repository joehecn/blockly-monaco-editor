<script setup lang="ts">
import { ref } from 'vue';
import JsonComponent from './components/json/JsonComponent.vue'
import ExpressionComponent from './components/expression/ExpressionComponent.vue'
import RefactoredExpressionComponent from './components/expression/RefactoredExpressionComponent.vue'
import LayeredEditorComponent from './components/LayeredEditorComponent.vue'
import TestBlockly from './components/TestBlockly.vue'

const jsonCode = ref(JSON.stringify({ a: 1 }, null, 2)) // 初始 JSON 数据，可以根据需要修改
// const jsonCode = ref('')
// 使用复杂表达式进行测试
const expressionCode = ref('equalText(absence, "absence") and (equalText(absence_1, "absence") and (equalText(absence_2, "absence") and (equalText(absence_3, "absence") and (equalText(absence_4, "absence") and (equalText(absence_5, "absence") and (equalText(absence_6, "absence") and (equalText(absence_7, "absence") and (equalText(absence_8, "absence") and (equalText(absence_9, "absence") and (equalText(absence_10, "absence") and (equalText(absence_11, "absence") and equalText(absence_12, "absence"))))))))))))')
const refactoredExpressionCode = ref('1 + 2 * 3')
const layeredExpressionCode = ref('sin(x) + cos(y)')

const currentTab = ref<'json' | 'expression' | 'refactored' | 'layered' | 'test'>('expression')
</script>

<template>
  <div class="app-container">
    <div class="tab-bar">
      <button @click="currentTab = 'test'" :class="{ active: currentTab === 'test' }" class="tab-button">
        测试 Blockly
      </button>
      <button @click="currentTab = 'json'" :class="{ active: currentTab === 'json' }" class="tab-button">
        JSON 编辑器
      </button>
      <button @click="currentTab = 'expression'" :class="{ active: currentTab === 'expression' }" class="tab-button">
        表达式编辑器
      </button>
      <button @click="currentTab = 'refactored'" :class="{ active: currentTab === 'refactored' }" class="tab-button">
        重构表达式编辑器
      </button>
      <button @click="currentTab = 'layered'" :class="{ active: currentTab === 'layered' }" class="tab-button">
        分层架构编辑器
      </button>
    </div>

    <div class="tab-content">
      <TestBlockly v-if="currentTab === 'test'" />
      <JsonComponent v-if="currentTab === 'json'" v-model="jsonCode" />
      <ExpressionComponent v-if="currentTab === 'expression'" v-model="expressionCode" />
      <RefactoredExpressionComponent v-if="currentTab === 'refactored'" v-model="refactoredExpressionCode" />
      <LayeredEditorComponent v-if="currentTab === 'layered'" v-model="layeredExpressionCode"
        :show-debug-panel="true" />
    </div>

    <div class="status-bar">
      <span v-if="currentTab === 'json'">JSON: {{ jsonCode || '(空)' }}</span>
      <span v-if="currentTab === 'expression'">Expression: {{ expressionCode || '(空)' }}</span>
      <span v-if="currentTab === 'refactored'">Refactored Expression: {{ refactoredExpressionCode || '(空)' }}</span>
      <span v-if="currentTab === 'layered'">Layered Expression: {{ layeredExpressionCode || '(空)' }}</span>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.tab-bar {
  height: 40px;
  background: #f8f8f8;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  padding: 0 12px;
  flex-shrink: 0;
}

.tab-button {
  background: #ffffff;
  border: 1px solid #d0d0d0;
  border-radius: 4px 4px 0 0;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  margin-right: 4px;
  transition: all 0.2s ease;
}

.tab-button:hover {
  background: #f0f0f0;
}

.tab-button.active {
  background: #007ACC;
  color: white;
  border-color: #007ACC;
  border-bottom: 1px solid #007ACC;
}

.tab-content {
  flex: 1;
  overflow: hidden;
}

.status-bar {
  height: 24px;
  background: #f0f0f0;
  border-top: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 12px;
  color: #666;
  flex-shrink: 0;
}
</style>
