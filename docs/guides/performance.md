# 性能优化指南

本指南提供了优化 Blockly Monaco 编辑器性能的最佳实践和具体策略。

## 🎯 性能目标

### 关键指标
- **初始加载时间**: < 2秒
- **块拖拽响应**: < 16ms (60 FPS)
- **代码同步延迟**: < 100ms
- **内存使用**: < 50MB (中等复杂度表达式)
- **CPU 使用率**: < 10% (空闲状态)

### 性能监控

#### 性能监控器

```typescript
// utils/performanceMonitor.ts
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()
  private memoryBaseline: number = 0
  
  constructor() {
    this.memoryBaseline = this.getCurrentMemoryUsage()
  }
  
  /**
   * 开始性能测量
   */
  startMeasure(name: string): () => number {
    const startTime = performance.now()
    const startMemory = this.getCurrentMemoryUsage()
    
    return () => {
      const duration = performance.now() - startTime
      const memoryDelta = this.getCurrentMemoryUsage() - startMemory
      
      this.recordMetric(name, duration)
      this.logMetric(name, duration, memoryDelta)
      
      return duration
    }
  }
  
  /**
   * 记录指标
   */
  private recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    
    const values = this.metrics.get(name)!
    values.push(value)
    
    // 保持最近 100 次记录
    if (values.length > 100) {
      values.shift()
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats(name: string): { avg: number; min: number; max: number; count: number } {
    const values = this.metrics.get(name) || []
    
    if (values.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 }
    }
    
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length
    const min = Math.min(...values)
    const max = Math.max(...values)
    
    return { avg, min, max, count: values.length }
  }
  
  /**
   * 获取当前内存使用
   */
  private getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }
  
  /**
   * 记录日志
   */
  private logMetric(name: string, duration: number, memoryDelta: number): void {
    const level = duration > 100 ? 'warn' : 'debug'
    console[level](`⏱️ ${name}: ${duration.toFixed(2)}ms, 内存: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`)
  }
  
  /**
   * 生成性能报告
   */
  generateReport(): string {
    const report = ['📊 性能报告', '=' .repeat(50)]
    
    for (const [name, values] of this.metrics) {
      const stats = this.getStats(name)
      report.push(
        `${name}:`,
        `  平均: ${stats.avg.toFixed(2)}ms`,
        `  最小: ${stats.min.toFixed(2)}ms`,
        `  最大: ${stats.max.toFixed(2)}ms`,
        `  次数: ${stats.count}`,
        ''
      )
    }
    
    return report.join('\n')
  }
}

// 全局性能监控器
export const performanceMonitor = new PerformanceMonitor()
```

## 🚀 转换器优化

### 1. 缓存策略

#### AST 缓存

```typescript
// transformers/OptimizedMathJSTransformer.ts
import { MathJSLayeredTransformer } from './MathJSLayeredTransformer'
import { IntermediateStructure } from '../core/layeredTypes'

export class OptimizedMathJSTransformer extends MathJSLayeredTransformer {
  private astCache = new Map<string, IntermediateStructure>()
  private blocklyCache = new Map<string, any>()
  private codeCache = new Map<string, string>()
  
  // 缓存大小限制
  private readonly MAX_CACHE_SIZE = 1000
  
  /**
   * 带缓存的代码到中间结构转换
   */
  async codeToIntermediate(code: string): Promise<IntermediateStructure> {
    // 检查缓存
    if (this.astCache.has(code)) {
      console.debug('🎯 AST 缓存命中:', code.substring(0, 50))
      return this.astCache.get(code)!
    }
    
    // 执行转换
    const endMeasure = performanceMonitor.startMeasure('codeToIntermediate')
    const result = await super.codeToIntermediate(code)
    endMeasure()
    
    // 存储到缓存
    this.setCache(this.astCache, code, result)
    
    return result
  }
  
  /**
   * 带缓存的中间结构到代码转换
   */
  async intermediateToCode(intermediate: IntermediateStructure): Promise<string> {
    const key = this.getIntermediateKey(intermediate)
    
    if (this.codeCache.has(key)) {
      console.debug('🎯 代码缓存命中')
      return this.codeCache.get(key)!
    }
    
    const endMeasure = performanceMonitor.startMeasure('intermediateToCode')
    const result = await super.intermediateToCode(intermediate)
    endMeasure()
    
    this.setCache(this.codeCache, key, result)
    
    return result
  }
  
  /**
   * 带缓存的 Blockly 转换
   */
  async blocklyToIntermediate(blocklyStructure: any): Promise<IntermediateStructure> {
    const key = JSON.stringify(blocklyStructure)
    
    if (this.astCache.has(key)) {
      console.debug('🎯 Blockly 缓存命中')
      return this.astCache.get(key)!
    }
    
    const endMeasure = performanceMonitor.startMeasure('blocklyToIntermediate')
    const result = await super.blocklyToIntermediate(blocklyStructure)
    endMeasure()
    
    this.setCache(this.astCache, key, result)
    
    return result
  }
  
  /**
   * 设置缓存（带大小限制）
   */
  private setCache<K, V>(cache: Map<K, V>, key: K, value: V): void {
    // 如果超过大小限制，删除最旧的条目
    if (cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value
      cache.delete(firstKey)
    }
    
    cache.set(key, value)
  }
  
  /**
   * 生成中间结构的唯一键
   */
  private getIntermediateKey(intermediate: IntermediateStructure): string {
    return JSON.stringify(intermediate, (key, value) => {
      // 排除不影响结果的字段
      if (key === 'location' || key === 'source') {
        return undefined
      }
      return value
    })
  }
  
  /**
   * 清空缓存
   */
  clearCache(): void {
    this.astCache.clear()
    this.blocklyCache.clear()
    this.codeCache.clear()
    console.log('🧹 缓存已清空')
  }
  
  /**
   * 获取缓存统计
   */
  getCacheStats(): { ast: number; blockly: number; code: number } {
    return {
      ast: this.astCache.size,
      blockly: this.blocklyCache.size,
      code: this.codeCache.size
    }
  }
}
```

### 2. 批量处理

#### 批量转换器

```typescript
// transformers/BatchTransformer.ts
export class BatchTransformer {
  private transformer: OptimizedMathJSTransformer
  private batchQueue: Array<{
    type: 'code' | 'blockly'
    data: any
    resolve: (result: any) => void
    reject: (error: Error) => void
  }> = []
  
  private batchTimer: number | null = null
  private readonly BATCH_DELAY = 50 // 50ms 批处理延迟
  private readonly BATCH_SIZE = 10   // 最大批处理大小
  
  constructor(transformer: OptimizedMathJSTransformer) {
    this.transformer = transformer
  }
  
  /**
   * 批量处理代码转换
   */
  async batchCodeToIntermediate(codes: string[]): Promise<IntermediateStructure[]> {
    const endMeasure = performanceMonitor.startMeasure('batchCodeToIntermediate')
    
    try {
      // 并行处理所有代码
      const results = await Promise.all(
        codes.map(code => this.transformer.codeToIntermediate(code))
      )
      
      endMeasure()
      return results
      
    } catch (error) {
      endMeasure()
      throw error
    }
  }
  
  /**
   * 队列式批量处理
   */
  async queueTransformation(type: 'code' | 'blockly', data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ type, data, resolve, reject })
      
      // 如果队列达到批处理大小，立即处理
      if (this.batchQueue.length >= this.BATCH_SIZE) {
        this.processBatch()
      } else {
        // 否则设置定时器
        this.scheduleBatch()
      }
    })
  }
  
  /**
   * 调度批处理
   */
  private scheduleBatch(): void {
    if (this.batchTimer !== null) return
    
    this.batchTimer = window.setTimeout(() => {
      this.processBatch()
    }, this.BATCH_DELAY)
  }
  
  /**
   * 处理批次
   */
  private async processBatch(): Promise<void> {
    if (this.batchTimer !== null) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    
    if (this.batchQueue.length === 0) return
    
    const batch = this.batchQueue.splice(0, this.BATCH_SIZE)
    const endMeasure = performanceMonitor.startMeasure(`batch-${batch.length}`)
    
    try {
      // 按类型分组
      const codeItems = batch.filter(item => item.type === 'code')
      const blocklyItems = batch.filter(item => item.type === 'blockly')
      
      // 并行处理
      await Promise.all([
        this.processBatchItems(codeItems, 'code'),
        this.processBatchItems(blocklyItems, 'blockly')
      ])
      
      endMeasure()
      
    } catch (error) {
      endMeasure()
      // 处理批次错误
      batch.forEach(item => item.reject(error as Error))
    }
    
    // 如果还有队列项，继续处理
    if (this.batchQueue.length > 0) {
      this.scheduleBatch()
    }
  }
  
  /**
   * 处理批次项目
   */
  private async processBatchItems(
    items: Array<{ data: any; resolve: (result: any) => void; reject: (error: Error) => void }>,
    type: 'code' | 'blockly'
  ): Promise<void> {
    for (const item of items) {
      try {
        let result: any
        
        if (type === 'code') {
          result = await this.transformer.codeToIntermediate(item.data)
        } else {
          result = await this.transformer.blocklyToIntermediate(item.data)
        }
        
        item.resolve(result)
        
      } catch (error) {
        item.reject(error as Error)
      }
    }
  }
}
```

## 🎨 UI 优化

### 1. 虚拟滚动

#### 大型工具箱优化

```typescript
// components/VirtualizedToolbox.vue
<template>
  <div class="virtual-toolbox" ref="container" @scroll="onScroll">
    <div class="scroll-area" :style="{ height: totalHeight + 'px' }">
      <div 
        class="visible-area" 
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <div
          v-for="item in visibleItems"
          :key="item.id"
          class="toolbox-item"
          :style="{ height: itemHeight + 'px' }"
        >
          <component :is="item.component" :data="item.data" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface ToolboxItem {
  id: string
  component: any
  data: any
}

const props = defineProps<{
  items: ToolboxItem[]
  itemHeight: number
}>()

const container = ref<HTMLElement>()
const scrollTop = ref(0)
const containerHeight = ref(0)

// 计算可见项目
const visibleItems = computed(() => {
  const startIndex = Math.floor(scrollTop.value / props.itemHeight)
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight.value / props.itemHeight) + 1,
    props.items.length
  )
  
  return props.items.slice(startIndex, endIndex).map((item, index) => ({
    ...item,
    index: startIndex + index
  }))
})

// 计算总高度
const totalHeight = computed(() => props.items.length * props.itemHeight)

// 计算偏移量
const offsetY = computed(() => {
  const startIndex = Math.floor(scrollTop.value / props.itemHeight)
  return startIndex * props.itemHeight
})

// 滚动处理
const onScroll = (event: Event) => {
  scrollTop.value = (event.target as HTMLElement).scrollTop
}

// 更新容器高度
const updateContainerHeight = () => {
  if (container.value) {
    containerHeight.value = container.value.clientHeight
  }
}

onMounted(() => {
  updateContainerHeight()
  window.addEventListener('resize', updateContainerHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerHeight)
})
</script>

<style scoped>
.virtual-toolbox {
  height: 100%;
  overflow-y: auto;
}

.scroll-area {
  position: relative;
}

.visible-area {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.toolbox-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #eee;
}
</style>
```

### 2. 防抖和节流

#### 输入防抖

```typescript
// utils/debounce.ts
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): T {
  let timeout: number | null = null
  
  return ((...args: any[]) => {
    const callNow = immediate && !timeout
    
    if (timeout !== null) {
      clearTimeout(timeout)
    }
    
    timeout = window.setTimeout(() => {
      timeout = null
      if (!immediate) func(...args)
    }, wait)
    
    if (callNow) func(...args)
  }) as T
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T {
  let inThrottle: boolean = false
  
  return ((...args: any[]) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }) as T
}
```

#### 优化的编辑器组件

```typescript
// components/OptimizedEditorComponent.vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { debounce, throttle } from '../utils/debounce'
import { performanceMonitor } from '../utils/performanceMonitor'

const props = defineProps<{
  modelValue: string
  transformer: any
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// 防抖的代码更新
const debouncedCodeUpdate = debounce(async (newCode: string) => {
  const endMeasure = performanceMonitor.startMeasure('debouncedCodeUpdate')
  
  try {
    // 执行转换
    const intermediate = await props.transformer.codeToIntermediate(newCode)
    const blocklyStructure = await props.transformer.intermediateToBlockly(intermediate)
    
    // 更新 Blockly 工作区
    updateBlocklyWorkspace(blocklyStructure)
    
    endMeasure()
    
  } catch (error) {
    console.error('代码更新失败:', error)
    endMeasure()
  }
}, 300)

// 节流的 Blockly 更新
const throttledBlocklyUpdate = throttle(async (blocklyStructure: any) => {
  const endMeasure = performanceMonitor.startMeasure('throttledBlocklyUpdate')
  
  try {
    const intermediate = await props.transformer.blocklyToIntermediate(blocklyStructure)
    const code = await props.transformer.intermediateToCode(intermediate)
    
    emit('update:modelValue', code)
    
    endMeasure()
    
  } catch (error) {
    console.error('Blockly 更新失败:', error)
    endMeasure()
  }
}, 100)

// 监听代码变化
watch(() => props.modelValue, (newCode) => {
  debouncedCodeUpdate(newCode)
})
</script>
```

## 💾 内存优化

### 1. 对象池

#### AST 节点对象池

```typescript
// utils/objectPool.ts
export class ObjectPool<T> {
  private pool: T[] = []
  private createFn: () => T
  private resetFn: (obj: T) => void
  private maxSize: number
  
  constructor(
    createFn: () => T,
    resetFn: (obj: T) => void,
    maxSize: number = 100
  ) {
    this.createFn = createFn
    this.resetFn = resetFn
    this.maxSize = maxSize
  }
  
  /**
   * 获取对象
   */
  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!
    }
    return this.createFn()
  }
  
  /**
   * 归还对象
   */
  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj)
      this.pool.push(obj)
    }
  }
  
  /**
   * 清空池
   */
  clear(): void {
    this.pool.length = 0
  }
  
  /**
   * 获取池大小
   */
  size(): number {
    return this.pool.length
  }
}

// AST 节点池
export const astNodePool = new ObjectPool(
  () => ({ type: '', value: null, args: [] }),
  (node) => {
    node.type = ''
    node.value = null
    node.args = []
  },
  50
)
```

### 2. 内存泄漏检测

#### 内存监控器

```typescript
// utils/memoryMonitor.ts
export class MemoryMonitor {
  private checkInterval: number | null = null
  private memoryHistory: number[] = []
  private readonly MAX_HISTORY = 50
  
  /**
   * 开始监控
   */
  startMonitoring(intervalMs: number = 5000): void {
    this.checkInterval = window.setInterval(() => {
      this.checkMemoryUsage()
    }, intervalMs)
  }
  
  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }
  
  /**
   * 检查内存使用
   */
  private checkMemoryUsage(): void {
    if (!('memory' in performance)) return
    
    const memory = (performance as any).memory
    const usedMB = memory.usedJSHeapSize / 1024 / 1024
    
    this.memoryHistory.push(usedMB)
    
    if (this.memoryHistory.length > this.MAX_HISTORY) {
      this.memoryHistory.shift()
    }
    
    // 检查内存增长趋势
    this.detectMemoryLeak()
  }
  
  /**
   * 检测内存泄漏
   */
  private detectMemoryLeak(): void {
    if (this.memoryHistory.length < 10) return
    
    const recent = this.memoryHistory.slice(-10)
    const trend = this.calculateTrend(recent)
    
    // 如果内存持续增长且增长率 > 1MB/检查
    if (trend > 1) {
      console.warn('⚠️ 检测到可能的内存泄漏:', {
        currentUsage: `${recent[recent.length - 1].toFixed(2)}MB`,
        trend: `+${trend.toFixed(2)}MB/检查`,
        recommendation: '建议检查缓存和事件监听器'
      })
    }
  }
  
  /**
   * 计算趋势（简单线性回归）
   */
  private calculateTrend(values: number[]): number {
    const n = values.length
    const sumX = n * (n - 1) / 2
    const sumY = values.reduce((sum, val) => sum + val, 0)
    const sumXY = values.reduce((sum, val, index) => sum + index * val, 0)
    const sumXX = n * (n - 1) * (2 * n - 1) / 6
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  }
  
  /**
   * 获取内存报告
   */
  getMemoryReport(): any {
    if (!('memory' in performance)) {
      return { error: '浏览器不支持内存监控' }
    }
    
    const memory = (performance as any).memory
    const currentMB = memory.usedJSHeapSize / 1024 / 1024
    const maxMB = memory.jsHeapSizeLimit / 1024 / 1024
    
    return {
      current: `${currentMB.toFixed(2)}MB`,
      limit: `${maxMB.toFixed(2)}MB`,
      usage: `${((currentMB / maxMB) * 100).toFixed(1)}%`,
      history: this.memoryHistory.slice(-10),
      trend: this.memoryHistory.length >= 10 ? 
        this.calculateTrend(this.memoryHistory.slice(-10)) : 0
    }
  }
}

export const memoryMonitor = new MemoryMonitor()
```

## 🔧 构建优化

### 1. 代码分割

#### Vite 配置优化

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { splitVendorChunkPlugin } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    splitVendorChunkPlugin()
  ],
  
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 将 Blockly 单独打包
          'blockly': ['blockly'],
          
          // 将 Monaco 单独打包
          'monaco': ['monaco-editor'],
          
          // 将 MathJS 单独打包
          'mathjs': ['mathjs'],
          
          // 将 Vue 生态单独打包
          'vue-vendor': ['vue', '@vue/runtime-core', '@vue/shared'],
          
          // 将工具库单独打包
          'utils': ['lodash-es', 'date-fns']
        }
      }
    },
    
    // 启用压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    
    // 设置 chunk 大小警告阈值
    chunkSizeWarningLimit: 1000
  },
  
  // 优化依赖预构建
  optimizeDeps: {
    include: [
      'vue',
      'blockly',
      'monaco-editor',
      'mathjs'
    ],
    exclude: [
      // 排除大型库的某些部分
      'blockly/python',
      'blockly/dart'
    ]
  }
})
```

### 2. 懒加载

#### 组件懒加载

```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/editor',
    component: () => import('../views/EditorView.vue')
  },
  {
    path: '/advanced',
    component: () => import('../views/AdvancedEditor.vue')
  }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
```

#### 动态导入转换器

```typescript
// composables/useTransformer.ts
import { ref, computed } from 'vue'

export function useTransformer(type: 'json' | 'mathjs' | 'typescript') {
  const transformer = ref<any>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  const loadTransformer = async () => {
    loading.value = true
    error.value = null
    
    try {
      switch (type) {
        case 'json':
          const { JsonTransformer } = await import('../transformers/JsonTransformer')
          transformer.value = new JsonTransformer()
          break
          
        case 'mathjs':
          const { MathJSLayeredTransformer } = await import('../transformers/MathJSLayeredTransformer')
          transformer.value = new MathJSLayeredTransformer()
          break
          
        case 'typescript':
          const { TypeScriptTransformer } = await import('../transformers/TypeScriptTransformer')
          transformer.value = new TypeScriptTransformer()
          break
      }
    } catch (err) {
      error.value = `加载转换器失败: ${err.message}`
    } finally {
      loading.value = false
    }
  }
  
  const isReady = computed(() => transformer.value !== null && !loading.value)
  
  return {
    transformer,
    loading,
    error,
    isReady,
    loadTransformer
  }
}
```

## 📊 性能最佳实践

### 1. 减少重复计算

```typescript
// 使用计算属性缓存复杂计算
const complexCalculation = computed(() => {
  return expensiveFunction(props.data)
})

// 使用 shallowRef 减少响应式开销
const largeDataSet = shallowRef([])
```

### 2. 事件处理优化

```typescript
// 使用事件委托
<div @click="handleClick">
  <!-- 大量子元素 -->
</div>

// 及时清理事件监听器
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('keydown', handleKeydown)
})
```

### 3. 渲染优化

```vue
<!-- 使用 v-memo 缓存渲染结果 -->
<div v-memo="[item.id, item.name]" v-for="item in items" :key="item.id">
  {{ item.name }}
</div>

<!-- 使用 v-once 只渲染一次 -->
<div v-once>{{ expensiveCalculation() }}</div>
```

## 🧪 性能测试

### 基准测试

```typescript
// tests/performance.test.ts
import { describe, it, expect } from 'vitest'
import { OptimizedMathJSTransformer } from '@/transformers/OptimizedMathJSTransformer'
import { performanceMonitor } from '@/utils/performanceMonitor'

describe('性能测试', () => {
  const transformer = new OptimizedMathJSTransformer()
  
  it('应在 100ms 内完成简单表达式转换', async () => {
    const expression = 'equalText(name, "John")'
    
    const endMeasure = performanceMonitor.startMeasure('simple-conversion')
    const result = await transformer.codeToIntermediate(expression)
    const duration = endMeasure()
    
    expect(duration).toBeLessThan(100)
    expect(result).toBeDefined()
  })
  
  it('应在 500ms 内完成复杂表达式转换', async () => {
    const expression = `
      (equalText(name, "John") and age > 18) or 
      (contains(tags, "vip") and status = "active") or
      (score > 80 and level in ["gold", "platinum"])
    `
    
    const endMeasure = performanceMonitor.startMeasure('complex-conversion')
    const result = await transformer.codeToIntermediate(expression)
    const duration = endMeasure()
    
    expect(duration).toBeLessThan(500)
    expect(result).toBeDefined()
  })
  
  it('缓存应能显著提升重复转换性能', async () => {
    const expression = 'equalText(name, "Alice")'
    
    // 第一次转换
    const firstRun = performanceMonitor.startMeasure('first-run')
    await transformer.codeToIntermediate(expression)
    const firstDuration = firstRun()
    
    // 第二次转换（应该从缓存获取）
    const secondRun = performanceMonitor.startMeasure('second-run')
    await transformer.codeToIntermediate(expression)
    const secondDuration = secondRun()
    
    // 第二次应该快得多
    expect(secondDuration).toBeLessThan(firstDuration * 0.1)
  })
})
```

## 📈 监控和分析

### 性能仪表板

```vue
<!-- components/PerformanceDashboard.vue -->
<template>
  <div class="performance-dashboard">
    <h3>性能监控</h3>
    
    <div class="metrics-grid">
      <div class="metric-card">
        <h4>内存使用</h4>
        <div class="metric-value">{{ memoryInfo.current }}</div>
        <div class="metric-trend" :class="memoryTrendClass">
          {{ memoryInfo.trend > 0 ? '↗' : '↘' }} {{ Math.abs(memoryInfo.trend).toFixed(2) }}MB
        </div>
      </div>
      
      <div class="metric-card">
        <h4>转换性能</h4>
        <div class="metric-value">{{ transformStats.avg.toFixed(2) }}ms</div>
        <div class="metric-details">
          最小: {{ transformStats.min.toFixed(2) }}ms |
          最大: {{ transformStats.max.toFixed(2) }}ms
        </div>
      </div>
      
      <div class="metric-card">
        <h4>缓存命中率</h4>
        <div class="metric-value">{{ cacheHitRate.toFixed(1) }}%</div>
        <div class="metric-details">
          {{ cacheStats.hits }} / {{ cacheStats.total }} 次
        </div>
      </div>
    </div>
    
    <div class="actions">
      <button @click="clearCaches">清空缓存</button>
      <button @click="runGC" v-if="canRunGC">强制垃圾回收</button>
      <button @click="exportReport">导出报告</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { performanceMonitor, memoryMonitor } from '@/utils/performanceMonitor'

const memoryInfo = ref(memoryMonitor.getMemoryReport())
const transformStats = ref(performanceMonitor.getStats('codeToIntermediate'))
const cacheStats = ref({ hits: 0, total: 0 })

const updateInterval = ref<number | null>(null)

// 计算缓存命中率
const cacheHitRate = computed(() => {
  if (cacheStats.value.total === 0) return 0
  return (cacheStats.value.hits / cacheStats.value.total) * 100
})

// 内存趋势样式类
const memoryTrendClass = computed(() => {
  const trend = memoryInfo.value.trend
  if (trend > 1) return 'trend-warning'
  if (trend > 0.5) return 'trend-caution'
  return 'trend-good'
})

// 检查是否可以运行垃圾回收
const canRunGC = computed(() => 'gc' in window)

// 更新统计信息
const updateStats = () => {
  memoryInfo.value = memoryMonitor.getMemoryReport()
  transformStats.value = performanceMonitor.getStats('codeToIntermediate')
}

// 清空缓存
const clearCaches = () => {
  // 假设有全局缓存清理方法
  console.log('缓存已清空')
}

// 强制垃圾回收
const runGC = () => {
  if ('gc' in window) {
    (window as any).gc()
  }
}

// 导出性能报告
const exportReport = () => {
  const report = performanceMonitor.generateReport()
  const blob = new Blob([report], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `performance-report-${new Date().toISOString()}.txt`
  a.click()
  
  URL.revokeObjectURL(url)
}

onMounted(() => {
  updateInterval.value = window.setInterval(updateStats, 2000)
  memoryMonitor.startMonitoring()
})

onUnmounted(() => {
  if (updateInterval.value !== null) {
    clearInterval(updateInterval.value)
  }
  memoryMonitor.stopMonitoring()
})
</script>

<style scoped>
.performance-dashboard {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin: 20px 0;
}

.metric-card {
  background: white;
  padding: 16px;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.metric-value {
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
}

.metric-trend {
  font-size: 12px;
  margin-top: 4px;
}

.trend-good { color: #27ae60; }
.trend-caution { color: #f39c12; }
.trend-warning { color: #e74c3c; }

.actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.actions button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.actions button:hover {
  background: #f5f5f5;
}
</style>
```

## 总结

通过实施这些性能优化策略：

1. **转换器优化**: 缓存、批处理、对象池
2. **UI 优化**: 虚拟滚动、防抖节流、懒加载
3. **内存管理**: 泄漏检测、缓存控制、垃圾回收
4. **构建优化**: 代码分割、压缩、预构建
5. **监控分析**: 性能监控、指标收集、报告生成

您的 Blockly Monaco 编辑器将能够处理更复杂的表达式，支持更多用户，并提供更流畅的用户体验。

记住：性能优化是一个持续的过程，需要根据实际使用情况不断调整和改进。
