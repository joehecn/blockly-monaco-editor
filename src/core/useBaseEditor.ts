/**
 * 基础编辑器组件 - 提供通用的分割面板和状态管理功能
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import type { Ref } from 'vue'
import { throttle } from 'lodash'
import type {
  BaseComponentRef,
  SplitterConfig,
  EditorState,
  SelectionInfo,
  AbstractTransformer,
  HighlightMapper
} from './types'

export interface BaseEditorComposableOptions<T = any> {
  modelValue: string
  splitterConfig: SplitterConfig
  transformer: AbstractTransformer<T>
  highlightMapper?: HighlightMapper<T>
}

export function useBaseEditor<T = any>(
  props: { modelValue: string },
  emit: (event: 'update:modelValue', value: string) => void,
  options: BaseEditorComposableOptions<T>
) {
  // 基础响应式数据
  const code = computed({
    get: () => props.modelValue,
    set: (val: string) => emit('update:modelValue', val)
  })

  const editorState = ref<EditorState>({
    content: props.modelValue,
    selection: null,
    errors: [],
    isLoading: false
  })

  // 分割面板管理
  const getSavedSize = () => {
    const savedSize = localStorage.getItem(options.splitterConfig.storageKey)
    if (savedSize) {
      const size = Number(savedSize)
      if (size >= options.splitterConfig.minSize && size <= options.splitterConfig.maxSize) {
        return size
      }
    }
    return options.splitterConfig.defaultSize
  }

  const leftPaneSize = ref(getSavedSize())
  const rightPaneSize = computed(() => 100 - leftPaneSize.value)
  const splitpanesReady = ref(false)

  // 节流保存分割位置
  const saveSplitterPosition = throttle((size: number) => {
    localStorage.setItem(options.splitterConfig.storageKey, size.toString())
  }, 500)

  const handlePaneResize = (event: { size: number }[]) => {
    if (splitpanesReady.value && event.length > 0) {
      const newSize = event[0].size
      if (newSize >= options.splitterConfig.minSize && newSize <= options.splitterConfig.maxSize) {
        leftPaneSize.value = newSize
        saveSplitterPosition(newSize)

        // 调整编辑器尺寸
        nextTick(() => {
          resizeEditors()
        })
      }
    }
  }

  const onSplitpanesReady = () => {
    splitpanesReady.value = true
    nextTick(() => {
      resizeEditors()
    })
  }

  // 编辑器引用管理
  const blocklyComponentRef: Ref<BaseComponentRef | null> = ref(null)
  const monacoEditorRef: Ref<BaseComponentRef | null> = ref(null)

  const resizeEditors = () => {
    blocklyComponentRef.value?.resize()
    monacoEditorRef.value?.resize()
  }

  // 同步管理
  const isSyncing = ref(false)

  const syncContent = async (source: 'blockly' | 'monaco', content: string) => {
    if (isSyncing.value) return

    isSyncing.value = true

    try {
      // 更新状态
      editorState.value.content = content
      code.value = content

      // 使用转换器进行转换
      if (source === 'blockly') {
        // Blockly -> 中间格式 -> Monaco
        const blocklyData = blocklyComponentRef.value?.getValue()
        if (blocklyData) {
          const intermediateData = options.transformer.fromBlockly(blocklyData)
          const monacoContent = options.transformer.toMonaco(intermediateData)
          monacoEditorRef.value?.setValue(monacoContent)
        }
      } else {
        // Monaco -> 中间格式 -> Blockly
        const intermediateData = options.transformer.fromMonaco(content)
        if (intermediateData) {
          const blocklyData = options.transformer.toBlockly(intermediateData)
          blocklyComponentRef.value?.setValue(JSON.stringify(blocklyData))
        }
      }
    } catch (error) {
      console.error('Sync error:', error)
      editorState.value.errors.push(`Sync error: ${error}`)
    } finally {
      await nextTick()
      isSyncing.value = false
    }
  }

  const syncSelection = (source: 'blockly' | 'monaco', selection: SelectionInfo) => {
    if (isSyncing.value) return

    editorState.value.selection = selection

    // 使用高亮映射器进行选择同步
    if (options.highlightMapper) {
      // 实现选择同步逻辑
      console.debug('Selection sync:', { source, selection })
    }
  }

  // 错误处理
  const clearErrors = () => {
    editorState.value.errors = []
  }

  const addError = (error: string) => {
    editorState.value.errors.push(error)
  }

  // 生命周期
  onMounted(() => {
    // 初始化时调整编辑器尺寸
    nextTick(() => {
      resizeEditors()
    })
  })

  return {
    // 基础数据
    code,
    editorState,

    // 分割面板
    leftPaneSize,
    rightPaneSize,
    splitpanesReady,
    handlePaneResize,
    onSplitpanesReady,

    // 编辑器引用
    blocklyComponentRef,
    monacoEditorRef,
    resizeEditors,

    // 同步管理
    isSyncing,
    syncContent,
    syncSelection,

    // 错误处理
    clearErrors,
    addError
  }
}
