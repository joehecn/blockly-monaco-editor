<script setup lang="ts">
import { ref } from 'vue';
import JsonComponent from './components/json/JsonComponent.vue'

// const code = ref(JSON.stringify({ a: 1 }, null, 2)) // 初始 JSON 数据，可以根据需要修改
const code = ref('')
</script>

<template>
  <JsonComponent v-model="code" />
</template>
