# 错误修复: resize 方法调用错误

## 问题描述
在 `LayeredEditorComponent.vue` 中，调用组件的 resize 方法时出现错误：

1. `blocklyRef.value?.resize is not a function`
2. `monacoRef.value?.resize is not a function`

## 问题原因
两个子组件通过 `defineExpose` 暴露的方法名与调用时使用的方法名不匹配：

- `BlocklyExpressionComponent` 暴露的是 `resizeWorkspace`，不是 `resize`
- `MonacoExpressionEditor` 暴露的是 `resizeEditor`，不是 `resize`

## 解决方案

### 修复 1: Blockly 组件
将调用从：
```javascript
blocklyRef.value?.resize()
```
修改为：
```javascript
blocklyRef.value?.resizeWorkspace()
```

### 修复 2: Monaco 组件
将调用从：
```javascript
monacoRef.value?.resize()
```
修改为：
```javascript
monacoRef.value?.resizeEditor()
```

## 修改位置
- 文件：`src/components/LayeredEditorComponent.vue`
- 行数：第 225-226 行
- 函数：`onSplitpanesReady()`

## 验证
- ✅ 编译检查通过
- ✅ 热重载更新成功
- ✅ 无其他类似错误

## 相关文件
- `src/components/expression/BlocklyExpressionComponent.vue` - 定义了 `resizeWorkspace` 方法
- `src/components/expression/MonacoExpressionEditor.vue` - 定义了 `resizeEditor` 方法
- `src/components/LayeredEditorComponent.vue` - 调用这些方法的位置
