<script setup lang="ts">
import 'blockly/blocks'

import { onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { debounce } from 'lodash'

import * as Blockly from 'blockly/core'
import * as En from 'blockly/msg/en'

import { blocks } from '../../blocks/json.ts'
import { toolbox } from '../../toolbox/json.ts'
import { jsonGenerator } from '../../generators/json.ts'
import { json2blocklyGenerator } from '../../generators/json_.ts'

interface Props {
  modelValue: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const blocklyDiv = ref<HTMLDivElement | null>(null)
const workspace = shallowRef<Blockly.WorkspaceSvg | null>(null)

const emitContentChange = debounce((e: Blockly.Events.Abstract) => {
  if (!workspace.value) return

  if (
    e.isUiEvent ||
    e.type === Blockly.Events.FINISHED_LOADING ||
    workspace.value.isDragging()
  ) {
    return
  }

  const code = jsonGenerator.workspaceToCode(workspace.value)
  if (code === props.modelValue) return

  try {
    JSON.parse(code)
    emit('update:modelValue', code)
  } catch (e) {
    console.warn('[SYS] Blockly 编辑器内容解析失败', e)
  }
}, 300)

const loadWorkspaceFromModelValue = (value: string) => {
  if (!workspace.value) return
  try {
    const code = jsonGenerator.workspaceToCode(workspace.value)
    if (value === code) return

    const data = json2blocklyGenerator.fromJsonString(value)
    Blockly.Events.disable()
    try {
      Blockly.serialization.workspaces.load(data, workspace.value)
    } finally {
      Blockly.Events.enable()
    }
  } catch (e) {
    console.warn('[SYS] Blockly 解析失败', e)
  }
}

// 监听外部 modelValue 变化，更新 blockly
watch(
  () => props.modelValue,
  loadWorkspaceFromModelValue
)

onMounted(() => {
  if (workspace.value) return

  Blockly.setLocale(En as unknown as { [key: string]: string })

  Blockly.common.defineBlocks(blocks)

  workspace.value = Blockly.inject(blocklyDiv.value!, {
    media: '/media',
    renderer: 'thrasos',
    toolbox,
    grid: {
      spacing: 25,
      length: 3,
      colour: '#ccc',
      snap: true,
    },
    scrollbars: true,
    trashcan: true,
    zoom: {
      controls: true,
      wheel: true
    },
  })

  workspace.value.addChangeListener(emitContentChange)

  loadWorkspaceFromModelValue(props.modelValue)
})

onUnmounted(() => {
  if (!workspace.value) return

  workspace.value.removeChangeListener(emitContentChange)
  workspace.value.dispose()
  workspace.value = null
})
</script>

<template>
  <div class="blocklyDiv" ref="blocklyDiv" tabindex="0"></div>
</template>

<style scoped>
.blocklyDiv {
  height: 100%;
  width: 100%;
  min-height: 300px;
  text-align: left;
}
</style>