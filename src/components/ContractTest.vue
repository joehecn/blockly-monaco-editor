<template>
  <div class="contract-test">
    <h2>契约导入测试</h2>
    <p>状态值: {{ state }}</p>
    <p>数据类型: {{ dataType }}</p>
    <p>状态管理器初始状态: {{ stateManagerState }}</p>
    <p v-if="debounceController">防抖控制器已创建</p>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { SystemState, DataType } from '@contracts';
import type { DataTransformer } from '@contracts';
import { createStateManager } from '@/modules/state-management';
import { createDebounceController } from '@/modules/timing-control';

// 测试状态管理契约
const state = ref<SystemState>(SystemState.ALL_SYNCED);

// 测试数据转换契约
const dataType = ref<string>('');
const mockTransformer: Partial<DataTransformer<any, any>> = {
  getSupportedDataType: () => DataType.JSON
};

// 测试核心功能导入
const stateManager = createStateManager();
const stateManagerState = ref<string>(stateManager.getCurrentState());
const debounceController = createDebounceController(undefined, () => {
  console.log('防抖函数执行了!');
});

onMounted(() => {
  dataType.value = mockTransformer.getSupportedDataType?.() || '';
  console.log('测试完成，所有导入均正常工作!');
});
</script>

<style scoped>
.contract-test {
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  margin: 20px;
}

h2 {
  color: #333;
  margin-bottom: 16px;
}

p {
  margin: 8px 0;
  color: #666;
}
</style>