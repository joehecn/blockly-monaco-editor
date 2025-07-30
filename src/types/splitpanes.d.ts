// 为 splitpanes Vue 3 版本提供简单的类型支持
declare module 'splitpanes' {
  import { DefineComponent } from 'vue'

  interface SplitpanesProps {
    horizontal?: boolean
    pushOtherPanes?: boolean
    dblClickSplitter?: boolean
  }

  interface PaneProps {
    size?: number
    minSize?: number
    maxSize?: number
  }

  export const Splitpanes: DefineComponent<SplitpanesProps>
  export const Pane: DefineComponent<PaneProps>
}
