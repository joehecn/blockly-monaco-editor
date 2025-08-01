# 开发环境设置指南

本指南将帮助您设置完整的开发环境，包括工具配置、调试设置和开发工作流。

## 🛠️ 开发工具设置

### 1. VS Code 配置

#### 必需扩展
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "Vue.volar",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
```

#### 工作区设置 (.vscode/settings.json)
```json
{
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "typescript.suggest.autoImports": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.vue": "vue"
  },
  "volar.takeOverMode.enabled": true
}
```

#### 调试配置 (.vscode/launch.json)
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "调试 Vue 应用",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/src",
      "sourceMapPathOverrides": {
        "webpack:///src/*": "${webRoot}/*"
      }
    },
    {
      "name": "调试 Node.js 脚本",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/debug-scripts/${fileBasename}",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### 2. Git 配置

#### .gitignore
```
# 依赖
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# 生产构建
dist/
dist-ssr/

# 环境变量
.env
.env.local
.env.*.local

# 编辑器
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json

# 操作系统
.DS_Store
Thumbs.db

# 临时文件
*.tmp
*.temp
.cache/

# 测试覆盖率
coverage/

# TypeScript
*.tsbuildinfo

# Vite
vite.config.js.timestamp-*
vite.config.ts.timestamp-*
```

#### Git Hooks (使用 husky)
```bash
# 安装 husky
npm install --save-dev husky

# 初始化 husky
npx husky install

# 添加 pre-commit hook
npx husky add .husky/pre-commit "npm run lint && npm run type-check"

# 添加 commit-msg hook
npx husky add .husky/commit-msg "npx commitlint --edit $1"
```

### 3. Package.json 开发脚本

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview",
    "type-check": "vue-tsc --noEmit",
    "lint": "eslint . --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts --fix --ignore-path .gitignore",
    "format": "prettier --write src/",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "debug:ast": "node debug-scripts/debug-ast.js",
    "debug:transformers": "node debug-scripts/debug-transformers.js",
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "clean": "rm -rf node_modules dist .cache",
    "reinstall": "npm run clean && npm install"
  }
}
```

## 🔧 开发工具

### 1. ESLint 配置

#### .eslintrc.cjs
```javascript
module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2022: true
  },
  extends: [
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier/skip-formatting'
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    // Vue 特定规则
    'vue/multi-word-component-names': 'off',
    'vue/no-unused-vars': 'error',
    
    // TypeScript 规则
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    
    // 通用规则
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'prefer-const': 'error',
    'no-var': 'error'
  }
}
```

### 2. Prettier 配置

#### .prettierrc
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "vueIndentScriptAndStyle": true
}
```

### 3. TypeScript 配置优化

#### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    
    /* 模块解析 */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    
    /* 严格检查 */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    
    /* 路径映射 */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/core/*": ["src/core/*"],
      "@/transformers/*": ["src/transformers/*"],
      "@/utils/*": ["src/utils/*"]
    }
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.d.ts",
    "src/**/*.tsx",
    "src/**/*.vue"
  ],
  "references": [
    { "path": "./tsconfig.node.json" }
  ]
}
```

## 🐛 调试设置

### 1. 创建调试脚本目录

```bash
mkdir debug-scripts
```

### 2. AST 调试脚本

#### debug-scripts/debug-ast.js
```javascript
import { MathJSLayeredTransformer } from '../src/transformers/MathJSLayeredTransformer.js'

async function debugAST() {
  const transformer = new MathJSLayeredTransformer()
  
  const testExpressions = [
    'equalText(name, "John")',
    'age > 18 and status = "active"',
    'sum(values) / count > average',
    'contains(tags, "priority") or urgent = true'
  ]
  
  console.log('🔍 AST 调试分析\n')
  
  for (const expr of testExpressions) {
    console.log(`📝 表达式: ${expr}`)
    
    try {
      // 解析为中间结构
      const intermediate = await transformer.codeToIntermediate(expr)
      console.log('🌳 AST 结构:', JSON.stringify(intermediate, null, 2))
      
      // 转换回字符串
      const roundTrip = await transformer.intermediateToCode(intermediate)
      console.log(`🔄 往返转换: ${roundTrip}`)
      console.log(`✅ 一致性: ${expr === roundTrip ? '通过' : '失败'}\n`)
      
    } catch (error) {
      console.error(`❌ 错误: ${error.message}\n`)
    }
  }
}

debugAST()
```

### 3. 转换器调试脚本

#### debug-scripts/debug-transformers.js
```javascript
import { MathJSLayeredTransformer } from '../src/transformers/MathJSLayeredTransformer.js'
import { LayeredDataFlowManager } from '../src/core/LayeredDataFlowManager.js'

async function debugTransformers() {
  console.log('🔄 转换器调试测试\n')
  
  const transformer = new MathJSLayeredTransformer()
  const dataFlow = new LayeredDataFlowManager(transformer)
  
  // 测试数据流
  const testData = {
    blockly: {
      type: 'logic_compare',
      fields: { OP: 'EQ' },
      inputs: {
        A: { type: 'text', value: 'name' },
        B: { type: 'text', value: '"John"' }
      }
    },
    code: 'equalText(name, "John")'
  }
  
  // 监听状态变化
  dataFlow.onStateChange((state) => {
    console.log('📊 状态更新:', {
      source: state.lastUpdateSource,
      isInSync: state.isInSync,
      errors: state.syncErrors.length
    })
  })
  
  try {
    // 测试 Blockly 到代码
    console.log('🧩 测试 Blockly → 代码')
    await dataFlow.updateFromBlockly(testData.blockly)
    
    // 测试代码到 Blockly
    console.log('📝 测试 代码 → Blockly')
    await dataFlow.updateFromMonaco(testData.code)
    
    // 检查同步状态
    const syncStatus = dataFlow.checkSyncStatus()
    console.log('🔍 同步检查:', syncStatus)
    
  } catch (error) {
    console.error('❌ 调试错误:', error)
  }
}

debugTransformers()
```

### 4. 浏览器调试工具

#### Vue DevTools 配置
```typescript
// main.ts
if (import.meta.env.DEV) {
  // 启用 Vue DevTools
  const app = createApp(App)
  app.config.devtools = true
  
  // 全局错误处理
  app.config.errorHandler = (err, vm, info) => {
    console.error('Vue 错误:', err)
    console.error('组件信息:', info)
  }
}
```

#### 性能监控
```typescript
// utils/performance.ts
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map()
  
  mark(name: string): void {
    this.marks.set(name, performance.now())
  }
  
  measure(name: string, startMark: string): number {
    const start = this.marks.get(startMark)
    if (!start) throw new Error(`找不到标记: ${startMark}`)
    
    const duration = performance.now() - start
    console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`)
    return duration
  }
  
  memoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      console.log('💾 内存使用:', {
        used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
      })
    }
  }
}

// 使用示例
const perf = new PerformanceMonitor()
perf.mark('transform-start')
// ... 执行转换
perf.measure('AST 转换', 'transform-start')
perf.memoryUsage()
```

## 🧪 测试环境

### 1. Vitest 配置

#### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
```

### 2. 测试设置文件

#### tests/setup.ts
```typescript
import { vi } from 'vitest'

// Mock Blockly
vi.mock('blockly', () => ({
  Blockly: {
    Workspace: vi.fn(),
    inject: vi.fn(),
    Xml: {
      domToWorkspace: vi.fn(),
      workspaceToDom: vi.fn()
    }
  }
}))

// Mock Monaco Editor
vi.mock('monaco-editor', () => ({
  editor: {
    create: vi.fn(),
    defineTheme: vi.fn()
  },
  languages: {
    registerCompletionItemProvider: vi.fn()
  }
}))
```

### 3. 示例测试文件

#### tests/transformers.test.ts
```typescript
import { describe, it, expect } from 'vitest'
import { MathJSLayeredTransformer } from '@/transformers/MathJSLayeredTransformer'

describe('MathJSLayeredTransformer', () => {
  const transformer = new MathJSLayeredTransformer()
  
  it('应该正确解析简单表达式', async () => {
    const code = 'equalText(name, "John")'
    const intermediate = await transformer.codeToIntermediate(code)
    
    expect(intermediate).toHaveProperty('type', 'FunctionNode')
    expect(intermediate.fn).toBe('equalText')
  })
  
  it('应该支持往返转换', async () => {
    const original = 'age > 18 and status = "active"'
    const intermediate = await transformer.codeToIntermediate(original)
    const roundTrip = await transformer.intermediateToCode(intermediate)
    
    expect(roundTrip).toBe(original)
  })
})
```

## 🚀 开发工作流

### 1. 每日开发流程

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装/更新依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 运行类型检查（在另一个终端）
npm run type-check --watch

# 5. 运行测试（在另一个终端）
npm run test --watch
```

### 2. 提交代码流程

```bash
# 1. 检查代码质量
npm run lint
npm run type-check

# 2. 运行测试
npm run test

# 3. 格式化代码
npm run format

# 4. 提交代码
git add .
git commit -m "feat: 添加新功能"

# 5. 推送代码
git push origin feature-branch
```

### 3. 调试工作流

```bash
# 调试 AST 解析
npm run debug:ast

# 调试转换器
npm run debug:transformers

# 启动调试模式的开发服务器
npm run dev -- --debug

# 查看构建分析
npm run build -- --analyze
```

## 📚 更多资源

- [项目架构指南](../architecture/overview.md)
- [自定义转换器开发](../guides/custom-transformers.md)
- [性能优化最佳实践](../guides/performance.md)
- [故障排除指南](../guides/troubleshooting.md)

## 🆘 常见问题

**Q: 开发服务器启动失败？**
A: 检查 Node.js 版本（需要 >= 16），清除缓存后重新安装依赖

**Q: TypeScript 类型错误？**
A: 确保 Vue Language Features (Volar) 扩展已启用，重启 VS Code

**Q: 热重载不工作？**
A: 检查文件路径是否正确，确保在 src 目录下进行修改

**Q: 调试断点不命中？**
A: 确保 source maps 已启用，检查浏览器开发者工具的源代码映射设置
