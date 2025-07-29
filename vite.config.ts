import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import monacoEditorEsmPlugin from 'vite-plugin-monaco-editor-esm'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    monacoEditorEsmPlugin({
      languageWorkers: ['json', 'editorWorkerService'], // 按需配置
    }),
  ],
})
