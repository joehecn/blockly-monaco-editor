<!-- Blockly Expression Component -->
<script setup lang="ts">
import 'blockly/blocks'

import { onUnmounted, ref, shallowRef, watch, nextTick } from 'vue'
import { debounce } from 'lodash'

import * as Blockly from 'blockly/core'
import * as En from 'blockly/msg/en'

import { expressionGenerator, validateExpression, cleanupExpression } from '../../generators/expression.ts'

interface Props {
  modelValue: string
  parentReady?: boolean // 父组件是否准备好
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'block-select', blockInfo: { blockId: string, expression: string, startPos: number, endPos: number }): void
}>()

const blocklyDiv = ref<HTMLDivElement | null>(null)
const workspace = shallowRef<Blockly.WorkspaceSvg | null>(null)
const isInitialized = ref(false) // 标记是否已初始化

// 存储根块的坐标信息
const rootBlockPosition = { x: 50, y: 50 }

// 建立块与代码位置的映射 (保留用于其他功能)
const blockToPositionMap = ref<Map<string, { startPos: number, endPos: number }>>(new Map())

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
    rootBlockPosition.x = position.x
    rootBlockPosition.y = position.y
  }

  const code = expressionGenerator.workspaceToCode(workspace.value)

  // 简化：使用基础位置映射，无需AST
  buildSimpleBlockPositionMap(code)

  // 清理表达式：移除不必要的括号
  const cleanedCode = cleanupExpression(code)

  if (cleanedCode === props.modelValue) return

  // 验证表达式是否有效
  if (validateExpression(cleanedCode)) {
    emit('update:modelValue', cleanedCode)
  } else {
    console.warn('[SYS] Blockly 表达式无效', cleanedCode)
  }
}, 300)

// 简化的位置映射构建方法（不使用AST）
const buildSimpleBlockPositionMap = (fullExpression: string) => {
  if (!workspace.value) return

  console.debug('🔧 Building simple position mapping for expression:', fullExpression.substring(0, 50) + (fullExpression.length > 50 ? '...' : ''))

  // 清空现有映射
  blockToPositionMap.value.clear()

  // 获取所有块
  const allBlocks = workspace.value.getAllBlocks(false)
  console.debug('📦 Total blocks:', allBlocks.length)

  // 为每个块分配一个位置区间（简化版本）
  let currentPos = 0
  allBlocks.forEach((block, index) => {
    const blockLength = Math.max(5, block.type.length) // 最小长度为5
    blockToPositionMap.value.set(block.id, {
      startPos: currentPos,
      endPos: currentPos + blockLength
    })
    currentPos += blockLength + 1 // 加1作为分隔符

    console.debug(`📍 Block ${index + 1}: ${block.type} (${block.id}) -> [${currentPos - blockLength - 1}, ${currentPos - 1}]`)
  })

  console.debug('🗺️  Final position map:', blockToPositionMap.value.size, 'entries')
}

// 响应 modelValue 变化（外部修改时同步到 Blockly）
watch(
  () => props.modelValue,
  (newVal, oldVal) => {
    console.debug('[SYNC] modelValue changed:', oldVal, '->', newVal)

    if (!workspace.value || !isInitialized.value) {
      console.debug('[SYNC] Workspace not ready, skipping sync')
      return
    }

    if (!newVal) {
      workspace.value.clear()
      return
    }

    try {
      // 暂时跳过 XML 生成，直接清空工作区
      workspace.value.clear()
      console.debug('[SYNC] Cleared workspace, expression sync not implemented yet')
    } catch (error) {
      console.warn('[SYNC] Failed to sync expression to Blockly:', error)
    }
  }
)

// 监视父组件准备状态，当父组件准备好时初始化
watch(
  [() => props.parentReady, blocklyDiv],
  ([parentReady, div]) => {
    if (parentReady && div && !workspace.value) {
      console.debug('[INIT] Parent ready, initializing Blockly...')
      initBlockly()
    }
  },
  { immediate: true }
)

// 初始化 Blockly 的函数
const initBlockly = () => {
  if (workspace.value) return

  nextTick(() => {
    if (!blocklyDiv.value) {
      console.error('❌ Blockly div not found')
      return
    }

    console.debug('🚀 Initializing Blockly workspace...')
    console.debug('📦 Container dimensions:', blocklyDiv.value.offsetWidth, 'x', blocklyDiv.value.offsetHeight)

    // 确保容器有尺寸
    if (blocklyDiv.value.offsetWidth === 0 || blocklyDiv.value.offsetHeight === 0) {
      console.warn('⚠️  Blockly container has zero dimensions, retrying...')
      setTimeout(initBlockly, 100)
      return
    }

    Blockly.setLocale(En as unknown as { [key: string]: string })

    // 使用标准的 Blockly 块进行测试
    workspace.value = Blockly.inject(blocklyDiv.value, {
      media: '/media/',
      renderer: 'thrasos',
      toolbox: {
        kind: 'flyoutToolbox',
        contents: [
          {
            kind: 'block',
            type: 'math_number'
          },
          {
            kind: 'block',
            type: 'math_arithmetic'
          },
          {
            kind: 'block',
            type: 'logic_boolean'
          },
          {
            kind: 'block',
            type: 'text'
          }
        ]
      },
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

    console.debug('✅ Blockly workspace created:', workspace.value)

    workspace.value.addChangeListener(emitContentChange)
    workspace.value.addChangeListener((e: Blockly.Events.Abstract) => {
      console.debug('Blockly event:', e.type, e)

      if (e.type === Blockly.Events.SELECTED) {
        const selectedEvent = e as any
        if (selectedEvent.newElementId) {
          const selectedBlock = workspace.value?.getBlockById(selectedEvent.newElementId)
          if (selectedBlock) {
            const blockId = selectedBlock.id
            const position = blockToPositionMap.value.get(blockId)
            if (position) {
              emit('block-select', {
                blockId,
                expression: props.modelValue,
                startPos: position.startPos,
                endPos: position.endPos
              })
            }
          }
        }
      }
    })

    isInitialized.value = true
    console.debug('🎉 Blockly initialization complete')

    // 如果有初始值，同步到 Blockly
    if (props.modelValue) {
      console.debug('🔄 Syncing initial value to Blockly:', props.modelValue)
    }
  })
}

// 生命周期
onUnmounted(() => {
  if (workspace.value) {
    workspace.value.dispose()
    workspace.value = null
  }
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
}

.blockly-initializing {
  background-color: #f8f9fa;
  border: 2px dashed #dee2e6;
}

.blockly-initializing::before {
  content: '正在初始化 Blockly...';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #6c757d;
  font-size: 14px;
  pointer-events: none;
}
</style>
