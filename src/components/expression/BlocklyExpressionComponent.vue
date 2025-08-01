<!-- Simple Blockly Expression Component - 基于 JSON 组件的工作模式 -->
<template>
  <div ref="blocklyDiv" class="blockly-div"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import * as Blockly from 'blockly/core'
import 'blockly/blocks'
import * as En from 'blockly/msg/en'

// 导入表达式相关的块、工具箱和生成器
import { expressionBlocks } from '../../blocks/expression.ts'
import { expressionToolbox } from '../../toolbox/expression.ts'
import { expressionGenerator } from '../../generators/expression.ts'

interface Props {
  modelValue?: string
  parentReady?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'block-select', data: {
    blockId: string
    expression: string
    startPos: number
    endPos: number
  }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const blocklyDiv = ref<HTMLElement>()
const workspace = ref<Blockly.WorkspaceSvg>()
const isInitialized = ref(false)

// 暴露给父组件的方法
const resizeWorkspace = () => {
  if (workspace.value && isInitialized.value) {
    setTimeout(() => {
      if (workspace.value) {
        Blockly.svgResize(workspace.value)
      }
    }, 50)
  }
}

// 简化的初始化函数（参考 JSON 组件的成功模式）
const initBlockly = () => {
  if (workspace.value) return

  nextTick(() => {
    if (!blocklyDiv.value) return

    console.debug('[Expression] Initializing Blockly workspace...')

    Blockly.setLocale(En as unknown as { [key: string]: string })
    Blockly.common.defineBlocks(expressionBlocks)

    workspace.value = Blockly.inject(blocklyDiv.value, {
      media: '/media',
      renderer: 'thrasos',
      toolbox: expressionToolbox,
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

    console.debug('[Expression] Blockly workspace created successfully')

    workspace.value.addChangeListener((e: Blockly.Events.Abstract) => {
      console.debug('[Expression] Blockly event:', e.type)

      if (e.type === Blockly.Events.SELECTED) {
        const selectedEvent = e as any
        if (selectedEvent.newElementId) {
          const selectedBlock = workspace.value?.getBlockById(selectedEvent.newElementId)
          if (selectedBlock) {
            console.debug('[Expression] Block selected:', selectedBlock.type)
            emit('block-select', {
              blockId: selectedBlock.id,
              expression: props.modelValue || '',
              startPos: 0,
              endPos: 0
            })
          }
        }
      }

      // 发出内容变化事件
      if (workspace.value) {
        // 使用 MathJS 表达式生成器
        try {
          const code = expressionGenerator.workspaceToCode(workspace.value)
          emit('update:modelValue', code)
        } catch (error) {
          console.warn('[Expression] Code generation failed:', error)
        }
      }
    })

    isInitialized.value = true
    console.debug('[Expression] Blockly initialization complete')
  })
}

// 监视父组件准备状态
watch(
  [() => props.parentReady, blocklyDiv],
  ([parentReady, div]) => {
    if ((parentReady || props.parentReady === undefined) && div && !workspace.value) {
      console.debug('[Expression] Ready to initialize - parentReady:', parentReady)
      initBlockly()
    }
  },
  { immediate: true }
)

onMounted(() => {
  console.debug('[Expression] Component mounted')
  if (!workspace.value) {
    initBlockly()
  }
})

// 暴露方法给父组件
defineExpose({
  resizeWorkspace
})
</script>

<style scoped>
.blockly-div {
  height: 100%;
  width: 100%;
}
</style>
