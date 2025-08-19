import { fileURLToPath } from 'url';
import { dirname } from 'path';
import tsParser from '@typescript-eslint/parser';
import eslint from '@eslint/js';
import vueEslint from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  // TypeScript文件配置
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        document: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        setInterval: 'readonly',
        window: 'readonly',
        afterEach: 'readonly',
        NodeJS: 'readonly',
        performance: 'readonly',
        Blob: 'readonly',
      },
    },
    rules: {
      ...eslint.configs.recommended.rules,
      // 关闭原生的未使用变量检查
      'no-unused-vars': 'off',
      // 关闭重复声明检查，以允许TypeScript中常量对象和类型别名的常见模式
      'no-redeclare': 'off',
    },
  },
  
  // Vue文件配置
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parser: vueEslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parser: '@typescript-eslint/parser',
      },
      globals: {
        console: 'readonly',
        document: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        setInterval: 'readonly',
        window: 'readonly',
        afterEach: 'readonly',
        NodeJS: 'readonly',
        performance: 'readonly',
        Blob: 'readonly',
      },
    },
    plugins: {
      vue: vueEslint,
    },
    rules: {
      ...eslint.configs.recommended.rules,
      // 关闭原生的未使用变量检查
      'no-unused-vars': 'off',
      // 关闭重复声明检查，以允许TypeScript中常量对象和类型别名的常见模式
      'no-redeclare': 'off',
    },
  },
  
  // Vue推荐配置
  ...vueEslint.configs['flat/recommended'],
  
  // Prettier配置
  prettier,
  
  // 自定义规则
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-multiple-template-root': 'off',
    },
  },
];