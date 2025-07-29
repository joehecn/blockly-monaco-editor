<script setup lang="ts">
import { computed } from 'vue'

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

</script>

<template>
  <div class="container">
    <div class="blockly">
      <BlocklyComponent v-model="code" />
    </div>
    <div class="code">
      <MonacoEditor v-model="code" />
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  height: 100%;
}

.blockly {
  flex: 1;
  height: 100%;
  width: 100%;
}

.code {
  flex: 1;
  height: 100%;
  width: 100%;
}
</style>