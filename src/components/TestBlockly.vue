<!-- 极简测试组件 -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'

const blocklyDiv = ref<HTMLDivElement | null>(null)

onMounted(() => {
  console.log('🔥 Starting Blockly test...')

  // 动态导入 Blockly
  import('blockly').then((Blockly) => {
    console.log('📦 Blockly loaded:', Blockly)

    if (blocklyDiv.value) {
      console.log('📍 Container ready, injecting Blockly...')

      try {
        // 最简配置
        const workspace = Blockly.inject(blocklyDiv.value, {
          media: 'https://unpkg.com/blockly/media/',
          toolbox: '<xml></xml>'
        })

        console.log('✅ SUCCESS! Workspace:', workspace)

        // 手动添加一个块来验证
        setTimeout(() => {
          const block = workspace.newBlock('math_number')
          block.initSvg()
          block.render()
          block.moveBy(20, 20)
          console.log('📦 Added test block:', block)
        }, 100)

      } catch (error) {
        console.error('❌ Injection failed:', error)
      }
    }
  }).catch(error => {
    console.error('❌ Failed to load Blockly:', error)
  })
})
</script>

<template>
  <div style="padding: 20px;">
    <h2 style="color: #dc3545;">🚨 极简 Blockly 测试</h2>
    <p>检查浏览器控制台查看详细信息</p>
    <div ref="blocklyDiv" style="
        height: 400px; 
        width: 800px; 
        border: 3px solid #dc3545; 
        background: white;
        margin: 20px 0;
      "></div>
  </div>
</template>
