# 故障排除指南

本指南帮助您快速诊断和解决 Blockly Monaco 编辑器的常见问题。

## 🚨 常见问题分类

### 1. 启动和配置问题
### 2. 转换和同步问题
### 3. 性能相关问题
### 4. UI 和交互问题
### 5. 构建和部署问题

---

## 🏁 启动和配置问题

### Q1: 开发服务器无法启动

**症状**: 运行 `npm run dev` 时失败或卡住

**可能原因和解决方案**:

```bash
# 1. 检查 Node.js 版本
node --version
# 需要 >= 16.0.0

# 2. 清除缓存并重新安装
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# 3. 检查端口占用
lsof -i :5173
# 如果端口被占用，杀死进程或更改端口

# 4. 使用详细日志模式
npm run dev -- --debug
```

**调试脚本**:
```javascript
// debug-scripts/check-environment.js
console.log('环境检查:')
console.log('Node.js 版本:', process.version)
console.log('NPM 版本:', process.env.npm_version)
console.log('操作系统:', process.platform)
console.log('当前目录:', process.cwd())

// 检查关键依赖
const dependencies = ['vue', 'vite', 'blockly', 'monaco-editor', 'mathjs']
dependencies.forEach(dep => {
  try {
    const pkg = require(`${dep}/package.json`)
    console.log(`${dep}: ${pkg.version}`)
  } catch (error) {
    console.error(`❌ ${dep}: 未安装或版本有问题`)
  }
})
```

### Q2: TypeScript 类型错误

**症状**: VS Code 或构建时出现类型错误

**解决方案**:

```typescript
// 检查 tsconfig.json 配置
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"]
  }
}

// 确保类型定义文件存在
// src/types/splitpanes.d.ts
declare module 'splitpanes' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export { component as Splitpanes }
  export { component as Pane }
}

// src/types/blockly.d.ts
declare module 'blockly' {
  export const Blockly: any
}
```

### Q3: 模块导入失败

**症状**: `Cannot resolve module` 错误

**解决方案**:

```typescript
// 1. 检查路径别名配置 (vite.config.ts)
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/utils': resolve(__dirname, 'src/utils')
    }
  }
})

// 2. 检查 tsconfig.json 路径映射
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}

// 3. 确保正确的文件扩展名
import { MathJSLayeredTransformer } from '@/transformers/MathJSLayeredTransformer'
// 而不是
// import { MathJSLayeredTransformer } from '@/transformers/MathJSLayeredTransformer.ts'
```

---

## 🔄 转换和同步问题

### Q4: Blockly 和 Monaco 不同步

**症状**: 在一个编辑器中的更改不反映到另一个编辑器

**诊断步骤**:

```typescript
// debug-scripts/debug-sync-issues.js
import { LayeredDataFlowManager } from '../src/core/LayeredDataFlowManager.js'
import { MathJSLayeredTransformer } from '../src/transformers/MathJSLayeredTransformer.js'

async function debugSyncIssues() {
  const transformer = new MathJSLayeredTransformer()
  const dataFlow = new LayeredDataFlowManager(transformer)
  
  // 监听所有状态变化
  dataFlow.onStateChange((state) => {
    console.log('🔄 状态变化:', {
      timestamp: new Date().toISOString(),
      source: state.lastUpdateSource,
      isInSync: state.isInSync,
      hasErrors: state.syncErrors.length > 0,
      errors: state.syncErrors
    })
  })
  
  // 测试基本同步
  console.log('🧪 测试基本同步...')
  
  try {
    // 测试代码到 Blockly
    await dataFlow.updateFromMonaco('equalText(name, "John")')
    console.log('✅ 代码 → Blockly 成功')
    
    // 测试 Blockly 到代码
    const testBlockly = {
      type: 'logic_compare',
      fields: { OP: 'EQ' },
      inputs: {
        A: { type: 'text', value: 'age' },
        B: { type: 'text', value: '18' }
      }
    }
    await dataFlow.updateFromBlockly(testBlockly)
    console.log('✅ Blockly → 代码 成功')
    
  } catch (error) {
    console.error('❌ 同步测试失败:', error)
  }
}

debugSyncIssues()
```

**常见解决方案**:

```typescript
// 1. 检查事件监听器是否正确设置
export class FixedEditorComponent extends Vue {
  mounted() {
    // 确保事件监听器正确绑定
    this.blocklyWorkspace.addChangeListener(this.handleBlocklyChange)
    this.monacoEditor.onDidChangeModelContent(this.handleMonacoChange)
  }
  
  beforeUnmount() {
    // 确保清理事件监听器
    this.blocklyWorkspace.removeChangeListener(this.handleBlocklyChange)
    this.monacoEditor.dispose()
  }
  
  handleBlocklyChange(event) {
    // 防止循环更新
    if (this.isUpdatingFromMonaco) return
    
    this.isUpdatingFromBlockly = true
    this.syncToMonaco()
    this.isUpdatingFromBlockly = false
  }
  
  handleMonacoChange(event) {
    // 防止循环更新
    if (this.isUpdatingFromBlockly) return
    
    this.isUpdatingFromMonaco = true
    this.syncToBlockly()
    this.isUpdatingFromMonaco = false
  }
}
```

### Q5: 表达式解析失败

**症状**: 复杂表达式无法正确转换

**诊断工具**:

```typescript
// utils/expressionValidator.ts
export class ExpressionValidator {
  
  /**
   * 验证表达式语法
   */
  validateSyntax(expression: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    // 检查括号匹配
    if (!this.checkBrackets(expression)) {
      errors.push('括号不匹配')
    }
    
    // 检查引号匹配
    if (!this.checkQuotes(expression)) {
      errors.push('引号不匹配')
    }
    
    // 检查函数语法
    const functionErrors = this.checkFunctions(expression)
    errors.push(...functionErrors)
    
    return {
      valid: errors.length === 0,
      errors
    }
  }
  
  /**
   * 检查括号匹配
   */
  private checkBrackets(expression: string): boolean {
    const stack: string[] = []
    const pairs = { '(': ')', '[': ']', '{': '}' }
    
    for (const char of expression) {
      if (char in pairs) {
        stack.push(char)
      } else if (Object.values(pairs).includes(char)) {
        const last = stack.pop()
        if (!last || pairs[last] !== char) {
          return false
        }
      }
    }
    
    return stack.length === 0
  }
  
  /**
   * 检查函数语法
   */
  private checkFunctions(expression: string): string[] {
    const errors: string[] = []
    const functionPattern = /(\w+)\s*\(/g
    let match
    
    while ((match = functionPattern.exec(expression)) !== null) {
      const funcName = match[1]
      
      // 检查是否是已知函数
      if (!this.isKnownFunction(funcName)) {
        errors.push(`未知函数: ${funcName}`)
      }
    }
    
    return errors
  }
  
  private isKnownFunction(name: string): boolean {
    const knownFunctions = [
      'equalText', 'contains', 'startsWith', 'endsWith',
      'sum', 'avg', 'min', 'max', 'count',
      'and', 'or', 'not'
    ]
    return knownFunctions.includes(name)
  }
}

// 使用示例
const validator = new ExpressionValidator()
const result = validator.validateSyntax('equalText(name, "John") and age > 18')
if (!result.valid) {
  console.error('表达式验证失败:', result.errors)
}
```

### Q6: AST 转换错误

**症状**: MathJS 解析失败或生成的 AST 不正确

**调试方案**:

```typescript
// debug-scripts/debug-ast-issues.js
import { parse, format } from 'mathjs'

function debugASTIssues() {
  const testExpressions = [
    'equalText(name, "John")',
    'age > 18 and status = "active"',
    'contains(tags, "vip") or score > 80'
  ]
  
  testExpressions.forEach(expr => {
    console.log(`\n🔍 调试表达式: ${expr}`)
    
    try {
      // 1. 尝试解析
      const ast = parse(expr)
      console.log('✅ 解析成功')
      console.log('AST 类型:', ast.type)
      
      // 2. 尝试格式化
      const formatted = format(ast)
      console.log('✅ 格式化成功:', formatted)
      
      // 3. 检查往返一致性
      const reparsed = parse(formatted)
      const reformatted = format(reparsed)
      
      if (formatted === reformatted) {
        console.log('✅ 往返一致性检查通过')
      } else {
        console.warn('⚠️ 往返一致性检查失败')
        console.log('原始:', formatted)
        console.log('往返:', reformatted)
      }
      
    } catch (error) {
      console.error('❌ 解析失败:', error.message)
      
      // 提供修复建议
      const suggestions = this.getSuggestions(expr, error)
      if (suggestions.length > 0) {
        console.log('💡 修复建议:')
        suggestions.forEach(suggestion => console.log(`  - ${suggestion}`))
      }
    }
  })
}

function getSuggestions(expression, error) {
  const suggestions = []
  
  if (error.message.includes('Unexpected')) {
    suggestions.push('检查语法是否正确，特别是操作符和括号')
  }
  
  if (error.message.includes('Undefined')) {
    suggestions.push('检查函数名是否拼写正确')
    suggestions.push('确认所有变量都已定义')
  }
  
  if (expression.includes('=') && !expression.includes('==')) {
    suggestions.push('使用 == 进行比较，而不是 =')
  }
  
  return suggestions
}

debugASTIssues()
```

---

## ⚡ 性能相关问题

### Q7: 编辑器响应缓慢

**症状**: 拖拽块或输入代码时有明显延迟

**性能分析**:

```typescript
// utils/performanceProfiler.ts
export class PerformanceProfiler {
  private profiles: Map<string, any[]> = new Map()
  
  /**
   * 开始性能分析
   */
  startProfile(name: string): void {
    if ('profile' in console) {
      (console as any).profile(name)
    }
    this.profiles.set(name, [])
  }
  
  /**
   * 记录时间点
   */
  mark(profileName: string, label: string): void {
    const profile = this.profiles.get(profileName)
    if (profile) {
      profile.push({
        label,
        timestamp: performance.now(),
        memory: this.getMemoryUsage()
      })
    }
  }
  
  /**
   * 结束性能分析
   */
  endProfile(name: string): any {
    if ('profileEnd' in console) {
      (console as any).profileEnd(name)
    }
    
    const profile = this.profiles.get(name)
    if (profile) {
      const analysis = this.analyzeProfile(profile)
      console.table(analysis)
      return analysis
    }
  }
  
  private analyzeProfile(profile: any[]): any[] {
    const analysis = []
    
    for (let i = 1; i < profile.length; i++) {
      const current = profile[i]
      const previous = profile[i - 1]
      
      analysis.push({
        step: `${previous.label} → ${current.label}`,
        duration: `${(current.timestamp - previous.timestamp).toFixed(2)}ms`,
        memoryDelta: `${((current.memory - previous.memory) / 1024 / 1024).toFixed(2)}MB`
      })
    }
    
    return analysis
  }
  
  private getMemoryUsage(): number {
    return ('memory' in performance) ? 
      (performance as any).memory.usedJSHeapSize : 0
  }
}

// 使用示例
const profiler = new PerformanceProfiler()

profiler.startProfile('blockly-update')
profiler.mark('blockly-update', 'start')
// ... Blockly 更新逻辑
profiler.mark('blockly-update', 'parsing')
// ... 解析逻辑
profiler.mark('blockly-update', 'transformation')
// ... 转换逻辑
profiler.mark('blockly-update', 'end')
profiler.endProfile('blockly-update')
```

**优化策略**:

```typescript
// 1. 实现防抖
import { debounce } from 'lodash-es'

const debouncedUpdate = debounce(async (newValue) => {
  await this.updateTransformation(newValue)
}, 300)

// 2. 使用 Web Workers 进行重计算
// workers/transformWorker.ts
self.onmessage = async function(e) {
  const { type, data } = e.data
  
  try {
    let result
    
    switch (type) {
      case 'parse':
        result = await parseExpression(data)
        break
      case 'transform':
        result = await transformAST(data)
        break
    }
    
    self.postMessage({ success: true, result })
    
  } catch (error) {
    self.postMessage({ success: false, error: error.message })
  }
}

// 3. 虚拟化大型列表
// 使用 vue-virtual-scroller 或自定义实现
```

### Q8: 内存泄漏

**症状**: 长时间使用后浏览器变慢，内存使用持续增长

**检测和修复**:

```typescript
// utils/memoryLeakDetector.ts
export class MemoryLeakDetector {
  private observations: number[] = []
  private checkInterval: number | null = null
  
  /**
   * 开始内存监控
   */
  startMonitoring(intervalMs: number = 10000): void {
    this.checkInterval = setInterval(() => {
      this.recordMemoryUsage()
    }, intervalMs)
  }
  
  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }
  
  /**
   * 记录内存使用
   */
  private recordMemoryUsage(): void {
    if (!('memory' in performance)) return
    
    const memory = (performance as any).memory
    const usedMB = memory.usedJSHeapSize / 1024 / 1024
    
    this.observations.push(usedMB)
    
    // 保持最近 20 次观察
    if (this.observations.length > 20) {
      this.observations.shift()
    }
    
    // 检查是否有内存泄漏
    this.detectLeak()
  }
  
  /**
   * 检测内存泄漏
   */
  private detectLeak(): void {
    if (this.observations.length < 10) return
    
    const recent = this.observations.slice(-10)
    const trend = this.calculateTrend(recent)
    
    if (trend > 2) { // 每次检查增长超过 2MB
      console.warn('🚨 检测到可能的内存泄漏:', {
        currentUsage: `${recent[recent.length - 1].toFixed(2)}MB`,
        trend: `+${trend.toFixed(2)}MB/检查`,
        suggestions: this.getLeakSuggestions()
      })
    }
  }
  
  private getLeakSuggestions(): string[] {
    return [
      '检查是否有未清理的事件监听器',
      '确保组件销毁时清理定时器',
      '检查缓存是否有大小限制',
      '确保 Blockly 工作区正确销毁',
      '检查 Monaco 编辑器是否正确 dispose'
    ]
  }
}

// 常见内存泄漏修复
export class LeakFreeMixin {
  private timers: number[] = []
  private listeners: Array<() => void> = []
  
  /**
   * 安全的定时器
   */
  safeSetInterval(callback: () => void, ms: number): number {
    const timer = setInterval(callback, ms)
    this.timers.push(timer)
    return timer
  }
  
  /**
   * 安全的事件监听器
   */
  safeAddEventListener(
    target: EventTarget, 
    event: string, 
    handler: EventListener
  ): void {
    target.addEventListener(event, handler)
    this.listeners.push(() => target.removeEventListener(event, handler))
  }
  
  /**
   * 清理所有资源
   */
  cleanup(): void {
    // 清理定时器
    this.timers.forEach(timer => clearInterval(timer))
    this.timers = []
    
    // 清理事件监听器
    this.listeners.forEach(cleanup => cleanup())
    this.listeners = []
  }
}
```

---

## 🎨 UI 和交互问题

### Q9: Blockly 工作区显示异常

**症状**: 块不显示、工具箱空白、拖拽无效

**诊断步骤**:

```typescript
// debug-scripts/debug-blockly-issues.js
function debugBlocklyIssues() {
  console.log('🔍 Blockly 工作区诊断...')
  
  // 1. 检查 DOM 容器
  const container = document.getElementById('blockly-container')
  if (!container) {
    console.error('❌ 找不到 Blockly 容器元素')
    return
  }
  
  console.log('✅ 容器元素存在:', {
    width: container.offsetWidth,
    height: container.offsetHeight,
    display: getComputedStyle(container).display
  })
  
  // 2. 检查工作区是否已初始化
  if (!window.blocklyWorkspace) {
    console.error('❌ Blockly 工作区未初始化')
    return
  }
  
  console.log('✅ 工作区已初始化')
  
  // 3. 检查工具箱配置
  const toolbox = window.blocklyWorkspace.getToolbox()
  if (!toolbox) {
    console.error('❌ 工具箱未配置')
  } else {
    console.log('✅ 工具箱已配置:', {
      categoryCount: toolbox.contents_.length
    })
  }
  
  // 4. 检查块定义
  const blockTypes = Object.keys(Blockly.Blocks)
  console.log('✅ 已注册的块类型:', blockTypes)
  
  // 5. 检查样式
  const blocklyDiv = container.querySelector('.blocklyDiv')
  if (blocklyDiv) {
    const styles = getComputedStyle(blocklyDiv)
    console.log('Blockly 样式:', {
      position: styles.position,
      zIndex: styles.zIndex,
      overflow: styles.overflow
    })
  }
}

// 自动诊断函数
function autoFixBlocklyIssues() {
  // 强制重新调整大小
  if (window.blocklyWorkspace) {
    Blockly.svgResize(window.blocklyWorkspace)
  }
  
  // 刷新工具箱
  if (window.blocklyWorkspace && window.blocklyWorkspace.getToolbox()) {
    window.blocklyWorkspace.getToolbox().refreshSelection()
  }
}

debugBlocklyIssues()
```

**常见修复方案**:

```vue
<!-- 确保容器有正确的尺寸和样式 -->
<template>
  <div 
    ref="blocklyContainer"
    class="blockly-container"
    :style="containerStyle"
  ></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as Blockly from 'blockly'

const blocklyContainer = ref<HTMLElement>()
let workspace: Blockly.WorkspaceSvg | null = null

const containerStyle = computed(() => ({
  width: '100%',
  height: '400px',
  minHeight: '300px'
}))

onMounted(async () => {
  await nextTick()
  initializeBlockly()
})

onUnmounted(() => {
  cleanupBlockly()
})

function initializeBlockly() {
  if (!blocklyContainer.value) {
    console.error('Blockly 容器未找到')
    return
  }
  
  try {
    workspace = Blockly.inject(blocklyContainer.value, {
      toolbox: toolboxConfig,
      trashcan: true,
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1.0,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2
      },
      grid: {
        spacing: 20,
        length: 3,
        colour: '#ccc',
        snap: true
      }
    })
    
    // 强制调整大小
    setTimeout(() => {
      Blockly.svgResize(workspace!)
    }, 100)
    
  } catch (error) {
    console.error('Blockly 初始化失败:', error)
  }
}

function cleanupBlockly() {
  if (workspace) {
    workspace.dispose()
    workspace = null
  }
}
</script>

<style scoped>
.blockly-container {
  position: relative;
  border: 1px solid #ddd;
}

/* 确保 Blockly 样式不被覆盖 */
.blockly-container :deep(.blocklyDiv) {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
}
</style>
```

### Q10: Monaco 编辑器样式问题

**症状**: 编辑器不显示、主题错误、语法高亮失效

**解决方案**:

```typescript
// utils/monacoFixer.ts
export class MonacoFixer {
  
  /**
   * 修复 Monaco 编辑器常见问题
   */
  static async fixCommonIssues(
    container: HTMLElement, 
    editor?: monaco.editor.IStandaloneCodeEditor
  ): Promise<void> {
    
    // 1. 检查容器尺寸
    this.fixContainerSize(container)
    
    // 2. 强制布局更新
    if (editor) {
      editor.layout()
    }
    
    // 3. 修复主题问题
    await this.fixTheme()
    
    // 4. 修复语法高亮
    this.fixSyntaxHighlighting()
  }
  
  /**
   * 修复容器尺寸问题
   */
  private static fixContainerSize(container: HTMLElement): void {
    const rect = container.getBoundingClientRect()
    
    if (rect.width === 0 || rect.height === 0) {
      console.warn('Monaco 容器尺寸为 0，尝试修复...')
      
      // 设置最小尺寸
      container.style.width = container.style.width || '100%'
      container.style.height = container.style.height || '300px'
      container.style.minHeight = '200px'
    }
  }
  
  /**
   * 修复主题问题
   */
  private static async fixTheme(): Promise<void> {
    try {
      // 确保主题已注册
      monaco.editor.defineTheme('custom-theme', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: '#0066cc', fontStyle: 'bold' },
          { token: 'string', foreground: '#009900' },
          { token: 'number', foreground: '#cc6600' }
        ],
        colors: {
          'editor.background': '#ffffff',
          'editor.foreground': '#000000'
        }
      })
      
      monaco.editor.setTheme('custom-theme')
      
    } catch (error) {
      console.warn('主题设置失败，使用默认主题:', error)
      monaco.editor.setTheme('vs')
    }
  }
  
  /**
   * 修复语法高亮
   */
  private static fixSyntaxHighlighting(): void {
    // 注册自定义语言
    monaco.languages.register({ id: 'expression' })
    
    // 设置语法高亮规则
    monaco.languages.setMonarchTokensProvider('expression', {
      tokenizer: {
        root: [
          [/\b(and|or|not|in)\b/, 'keyword'],
          [/\b(equalText|contains|startsWith|endsWith)\b/, 'function'],
          [/\b\d+(\.\d+)?\b/, 'number'],
          [/"([^"\\]|\\.)*"/, 'string'],
          [/'([^'\\]|\\.)*'/, 'string'],
          [/[a-zA-Z_][a-zA-Z0-9_]*/, 'variable'],
          [/[><=!]=?/, 'operator'],
          [/[()[\]{}]/, 'bracket']
        ]
      }
    })
  }
}

// 使用示例
onMounted(async () => {
  const container = monacoContainer.value
  if (!container) return
  
  try {
    const editor = monaco.editor.create(container, {
      value: props.modelValue,
      language: 'expression',
      theme: 'custom-theme',
      automaticLayout: true
    })
    
    // 应用修复
    await MonacoFixer.fixCommonIssues(container, editor)
    
  } catch (error) {
    console.error('Monaco 初始化失败:', error)
  }
})
```

---

## 🏗️ 构建和部署问题

### Q11: 构建失败

**症状**: `npm run build` 失败或产生错误

**常见问题和解决方案**:

```bash
# 1. 内存不足
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build

# 2. TypeScript 错误
npm run type-check
# 修复类型错误后再构建

# 3. 依赖版本冲突
npm ls
# 检查冲突的依赖版本

# 4. 清理构建缓存
rm -rf dist .vite node_modules/.cache
npm run build

# 5. 详细构建日志
npm run build -- --debug
```

**构建配置优化**:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    // 增加内存限制
    rollupOptions: {
      maxParallelFileOps: 2,
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router'],
          blockly: ['blockly'],
          monaco: ['monaco-editor']
        }
      }
    },
    
    // 禁用 source map 减少构建时间
    sourcemap: false,
    
    // 设置更大的 chunk 警告阈值
    chunkSizeWarningLimit: 1000
  },
  
  // 优化依赖预构建
  optimizeDeps: {
    force: true // 强制重新预构建
  }
})
```

### Q12: 部署后无法访问

**症状**: 本地构建成功，部署后页面空白或 404

**检查清单**:

```bash
# 1. 检查构建产物
ls -la dist/
# 确保有 index.html 和相关资源文件

# 2. 检查路由配置
# vite.config.ts
export default defineConfig({
  base: '/your-app-path/' // 如果部署在子路径
})

# 3. 检查服务器配置
# nginx.conf 示例
server {
  listen 80;
  server_name your-domain.com;
  root /path/to/dist;
  index index.html;
  
  location / {
    try_files $uri $uri/ /index.html;
  }
  
  # 静态资源缓存
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}

# 4. 检查 HTTPS 和 CORS
# 确保 Monaco 编辑器的 web workers 能正常加载
```

---

## 🛠️ 调试工具和脚本

### 综合诊断脚本

```javascript
// debug-scripts/comprehensive-diagnosis.js
import { MathJSLayeredTransformer } from '../src/transformers/MathJSLayeredTransformer.js'
import { LayeredDataFlowManager } from '../src/core/LayeredDataFlowManager.js'

async function runComprehensiveDiagnosis() {
  console.log('🔍 开始综合诊断...\n')
  
  const tests = [
    { name: '环境检查', test: checkEnvironment },
    { name: '依赖检查', test: checkDependencies },
    { name: '转换器测试', test: testTransformers },
    { name: '数据流测试', test: testDataFlow },
    { name: '性能测试', test: testPerformance },
    { name: 'AST 解析测试', test: testASTParser }
  ]
  
  const results = []
  
  for (const { name, test } of tests) {
    console.log(`📋 执行测试: ${name}`)
    
    try {
      const result = await test()
      results.push({ name, status: 'pass', result })
      console.log(`✅ ${name}: 通过\n`)
      
    } catch (error) {
      results.push({ name, status: 'fail', error: error.message })
      console.error(`❌ ${name}: 失败 - ${error.message}\n`)
    }
  }
  
  // 生成报告
  generateDiagnosisReport(results)
}

function checkEnvironment() {
  const nodeVersion = process.version
  const platform = process.platform
  
  if (!nodeVersion.startsWith('v16') && !nodeVersion.startsWith('v18') && !nodeVersion.startsWith('v20')) {
    throw new Error(`Node.js 版本过低: ${nodeVersion}，建议使用 16+`)
  }
  
  return { nodeVersion, platform }
}

function checkDependencies() {
  const required = ['vue', 'vite', 'blockly', 'monaco-editor', 'mathjs']
  const missing = []
  
  for (const dep of required) {
    try {
      require.resolve(dep)
    } catch {
      missing.push(dep)
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`缺少依赖: ${missing.join(', ')}`)
  }
  
  return { dependencies: required }
}

async function testTransformers() {
  const transformer = new MathJSLayeredTransformer()
  const testCode = 'equalText(name, "John")'
  
  const intermediate = await transformer.codeToIntermediate(testCode)
  const backToCode = await transformer.intermediateToCode(intermediate)
  
  if (testCode !== backToCode) {
    throw new Error('转换器往返测试失败')
  }
  
  return { original: testCode, roundTrip: backToCode }
}

async function testDataFlow() {
  const transformer = new MathJSLayeredTransformer()
  const dataFlow = new LayeredDataFlowManager(transformer)
  
  await dataFlow.updateFromMonaco('age > 18')
  const state = dataFlow.getCurrentState()
  
  if (!state.isInSync) {
    throw new Error('数据流同步失败')
  }
  
  return { state: 'synchronized' }
}

async function testPerformance() {
  const transformer = new MathJSLayeredTransformer()
  const start = performance.now()
  
  await transformer.codeToIntermediate('equalText(name, "test")')
  
  const duration = performance.now() - start
  
  if (duration > 1000) {
    throw new Error(`性能测试失败: 转换耗时 ${duration}ms`)
  }
  
  return { duration: `${duration.toFixed(2)}ms` }
}

async function testASTParser() {
  const { parse } = await import('mathjs')
  
  const testExpressions = [
    'x + y',
    'sin(x)',
    'x > 5 and y < 10'
  ]
  
  for (const expr of testExpressions) {
    try {
      parse(expr)
    } catch (error) {
      throw new Error(`AST 解析失败: ${expr} - ${error.message}`)
    }
  }
  
  return { tested: testExpressions.length }
}

function generateDiagnosisReport(results) {
  console.log('\n📊 诊断报告')
  console.log('='.repeat(50))
  
  const passed = results.filter(r => r.status === 'pass').length
  const total = results.length
  
  console.log(`总体结果: ${passed}/${total} 测试通过`)
  
  if (passed === total) {
    console.log('🎉 所有测试通过！系统运行正常。')
  } else {
    console.log('\n⚠️ 发现问题:')
    results
      .filter(r => r.status === 'fail')
      .forEach(r => console.log(`  - ${r.name}: ${r.error}`))
  }
  
  console.log('\n💡 建议:')
  if (passed < total) {
    console.log('  1. 根据上述错误信息修复问题')
    console.log('  2. 重新运行诊断确认修复')
    console.log('  3. 查阅相关文档获取详细解决方案')
  } else {
    console.log('  1. 系统运行正常，可以开始开发')
    console.log('  2. 定期运行诊断确保系统健康')
  }
}

// 运行诊断
runComprehensiveDiagnosis().catch(console.error)
```

### 实时错误监控

```typescript
// utils/errorMonitor.ts
export class ErrorMonitor {
  private errors: Array<{
    timestamp: Date
    type: string
    message: string
    stack?: string
    context?: any
  }> = []
  
  constructor() {
    this.setupGlobalErrorHandling()
  }
  
  /**
   * 设置全局错误处理
   */
  private setupGlobalErrorHandling(): void {
    // 捕获未处理的 Promise 错误
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError('unhandled-promise', event.reason?.message || 'Unknown promise rejection', {
        reason: event.reason
      })
    })
    
    // 捕获 JavaScript 错误
    window.addEventListener('error', (event) => {
      this.recordError('javascript', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      })
    })
    
    // 捕获 Vue 错误（如果使用 Vue）
    if (window.Vue) {
      const originalErrorHandler = window.Vue.config.errorHandler
      window.Vue.config.errorHandler = (err, vm, info) => {
        this.recordError('vue', err.message, {
          componentInfo: info,
          stack: err.stack
        })
        
        if (originalErrorHandler) {
          originalErrorHandler(err, vm, info)
        }
      }
    }
  }
  
  /**
   * 记录错误
   */
  recordError(type: string, message: string, context?: any): void {
    this.errors.push({
      timestamp: new Date(),
      type,
      message,
      stack: context?.stack,
      context
    })
    
    // 保持最近 100 个错误
    if (this.errors.length > 100) {
      this.errors.shift()
    }
    
    // 控制台输出
    console.error(`🚨 [${type}] ${message}`, context)
  }
  
  /**
   * 获取错误统计
   */
  getErrorStats(): any {
    const typeCount = this.errors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return {
      total: this.errors.length,
      byType: typeCount,
      recent: this.errors.slice(-5)
    }
  }
  
  /**
   * 导出错误日志
   */
  exportErrorLog(): string {
    return JSON.stringify(this.errors, null, 2)
  }
}

// 创建全局错误监控器
export const errorMonitor = new ErrorMonitor()
```

## 🎯 获取帮助

### 社区资源
- **GitHub Issues**: 报告 bug 和功能请求
- **讨论区**: 技术讨论和经验分享
- **文档**: 查阅最新的 API 文档和指南

### 快速支持
1. **收集信息**: 使用诊断脚本收集系统信息
2. **重现问题**: 提供最小化的重现步骤
3. **检查日志**: 查看浏览器控制台和网络请求
4. **尝试修复**: 参考本指南的解决方案

### 提交 Bug 报告模板

```markdown
## Bug 描述
[简要描述问题]

## 重现步骤
1. 
2. 
3. 

## 期望行为
[描述期望的正确行为]

## 实际行为
[描述实际发生的行为]

## 环境信息
- OS: [操作系统]
- Browser: [浏览器版本]
- Node.js: [版本]
- Package Version: [版本]

## 诊断信息
[粘贴诊断脚本输出]

## 错误日志
[粘贴相关错误信息]

## 附加信息
[其他可能相关的信息]
```

---

记住：大多数问题都有解决方案，关键是系统性地诊断和定位问题根源。使用提供的工具和脚本，您可以快速识别和解决大部分常见问题。
