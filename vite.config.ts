import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import monacoEditorEsmPlugin from 'vite-plugin-monaco-editor-esm'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@contracts': path.resolve(__dirname, 'src/contracts')
    }
  },
  plugins: [
    vue(),
    monacoEditorEsmPlugin({
      languageWorkers: ['json', 'editorWorkerService'], // 按需配置
    }),
  ],
  optimizeDeps: {
    include: ['blockly', 'blockly/core', 'blockly/blocks']
  },
  server: {
    fs: {
      allow: ['..']
    }
  }
})
