<script setup lang="ts">
import 'blockly/blocks'

import { onUnmounted, ref, shallowRef, watch, nextTick } from 'vue'
import { debounce } from 'lodash'

import * as Blockly from 'blockly/core'
import * as En from 'blockly/msg/en'

import { blocks } from '../../blocks/json.ts'
import { toolbox } from '../../toolbox/json.ts'
import { jsonGenerator } from '../../generators/json.ts'
import { json2blocklyGenerator } from '../../generators/json_.ts'

interface Props {
  modelValue: string
  parentReady?: boolean // 父组件是否准备好
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const blocklyDiv = ref<HTMLDivElement | null>(null)
const workspace = shallowRef<Blockly.WorkspaceSvg | null>(null)
const isInitialized = ref(false) // 标记是否已初始化

// 存储根块的坐标信息
const rootBlockPosition = { x: 50, y: 50 }

// 暴露给父组件的方法
const resizeWorkspace: () => void = () => {
  if (workspace.value && isInitialized.value) {
    // 延迟调整尺寸，确保容器已经稳定
    setTimeout(() => {
      if (workspace.value) {
        Blockly.svgResize(workspace.value)
      }
    }, 50)
  }
}

// 暴露方法给父组件
defineExpose({
  resizeWorkspace
})

const emitContentChange = debounce((e: Blockly.Events.Abstract) => {
  if (!workspace.value) return

  if (
    e.isUiEvent ||
    e.type === Blockly.Events.FINISHED_LOADING ||
    workspace.value.isDragging()
  ) {
    return
  }

  // 保存根块的坐标
  const topBlocks = workspace.value.getTopBlocks(false)
  if (topBlocks.length > 0) {
    const position = topBlocks[0].getRelativeToSurfaceXY()
    // rootBlockPosition = { x: position.x, y: position.y }
    rootBlockPosition.x = position.x
    rootBlockPosition.y = position.y
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
  if (!workspace.value || !isInitialized.value) return
  try {
    const code = jsonGenerator.workspaceToCode(workspace.value)
    if (value === code) return

    // 使用保存的坐标信息
    const data = json2blocklyGenerator.fromJsonString(value, rootBlockPosition.x, rootBlockPosition.y)
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

// 监听父组件状态变化
watch(
  () => props.parentReady,
  (isReady) => {
    if (isReady && !workspace.value) {
      initBlockly()
    }
  },
  { immediate: true }
)

// 初始化 Blockly 的函数
const initBlockly = () => {
  if (workspace.value) return

  nextTick(() => {
    if (!blocklyDiv.value) return

    Blockly.setLocale(En as unknown as { [key: string]: string })
    Blockly.common.defineBlocks(blocks)

    workspace.value = Blockly.inject(blocklyDiv.value, {
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

    // 标记为已初始化
    isInitialized.value = true

    // 延迟加载内容，确保 workspace 完全准备好
    setTimeout(() => {
      loadWorkspaceFromModelValue(props.modelValue)
    }, 100)
  })
}

onUnmounted(() => {
  if (!workspace.value) return

  workspace.value.removeChangeListener(emitContentChange)
  workspace.value.dispose()
  workspace.value = null
})
</script>

<template>
  <div class="blockly-container">
    <div class="blocklyDiv" ref="blocklyDiv" tabindex="0" :class="{ 'blockly-initializing': !isInitialized }"></div>
  </div>
</template>

<style scoped>
.blockly-container {
  height: 100%;
  width: 100%;
  position: relative;
}

.blocklyDiv {
  height: 100%;
  width: 100%;
  min-height: 300px;
  text-align: left;
  transition: opacity 0.2s ease;
}

.blockly-initializing {
  opacity: 0.1;
  pointer-events: none;
}
</style>