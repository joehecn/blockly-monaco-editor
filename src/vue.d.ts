// Vue模块类型声明文件
// 解决TypeScript无法找到.vue文件的问题
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}