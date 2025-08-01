/**
 * TypeScript AST 转换器 - 为方案三打下基础
 */
import * as ts from 'typescript'
import type { AbstractTransformer } from '../core/types'

export interface TypeScriptData {
  type: 'typescript'
  ast: ts.SourceFile
  code: string
  metadata?: {
    version: string
    timestamp: number
    imports: string[]
    exports: string[]
    functions: string[]
    variables: string[]
  }
}

export class TypeScriptTransformer implements AbstractTransformer<TypeScriptData> {
  private readonly compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    strict: true,
    noEmit: true
  }

  fromBlockly(blocklyData: any): TypeScriptData {
    try {
      // 将 Blockly 结构转换为 TypeScript 代码
      const code = this.blocklyToTypeScript(blocklyData)
      const ast = ts.createSourceFile(
        'generated.ts',
        code,
        ts.ScriptTarget.ES2020,
        true
      )

      return {
        type: 'typescript',
        ast,
        code,
        metadata: {
          version: '1.0',
          timestamp: Date.now(),
          imports: this.extractImports(ast),
          exports: this.extractExports(ast),
          functions: this.extractFunctions(ast),
          variables: this.extractVariables(ast)
        }
      }
    } catch (error) {
      console.error('Failed to convert from Blockly:', error)
      return this.createEmptyData()
    }
  }

  toMonaco(data: TypeScriptData): string {
    try {
      // 格式化 TypeScript 代码
      return this.formatTypeScript(data.code)
    } catch (error) {
      console.error('Failed to convert to Monaco:', error)
      return data.code || ''
    }
  }

  fromMonaco(text: string): TypeScriptData | null {
    try {
      const ast = ts.createSourceFile(
        'editor.ts',
        text,
        ts.ScriptTarget.ES2020,
        true
      )

      return {
        type: 'typescript',
        ast,
        code: text,
        metadata: {
          version: '1.0',
          timestamp: Date.now(),
          imports: this.extractImports(ast),
          exports: this.extractExports(ast),
          functions: this.extractFunctions(ast),
          variables: this.extractVariables(ast)
        }
      }
    } catch (error) {
      console.error('Failed to parse Monaco content:', error)
      return null
    }
  }

  toBlockly(data: TypeScriptData): any {
    // 将 TypeScript AST 转换回 Blockly 结构
    // 这是最复杂的部分，需要遍历 AST 并创建对应的块
    return this.astToBlockly(data.ast)
  }

  validate(data: TypeScriptData): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!data) {
      errors.push('Data is null or undefined')
      return { valid: false, errors }
    }

    if (data.type !== 'typescript') {
      errors.push('Invalid data type, expected "typescript"')
    }

    if (!data.code) {
      errors.push('Code is missing')
    }

    // TypeScript 语法验证
    if (data.ast) {
      const diagnostics = ts.getPreEmitDiagnostics(
        ts.createProgram([data.ast.fileName], this.compilerOptions)
      )

      diagnostics.forEach(diagnostic => {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
        errors.push(`TypeScript error: ${message}`)
      })
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  format(data: TypeScriptData): TypeScriptData {
    try {
      const formattedCode = this.formatTypeScript(data.code)
      const ast = ts.createSourceFile(
        'formatted.ts',
        formattedCode,
        ts.ScriptTarget.ES2020,
        true
      )

      return {
        ...data,
        ast,
        code: formattedCode,
        metadata: {
          version: data.metadata?.version || '1.0',
          timestamp: Date.now(),
          imports: this.extractImports(ast),
          exports: this.extractExports(ast),
          functions: this.extractFunctions(ast),
          variables: this.extractVariables(ast)
        }
      }
    } catch (error) {
      console.error('Failed to format data:', error)
      return data
    }
  }

  private createEmptyData(): TypeScriptData {
    const code = ''
    const ast = ts.createSourceFile('empty.ts', code, ts.ScriptTarget.ES2020, true)

    return {
      type: 'typescript',
      ast,
      code,
      metadata: {
        version: '1.0',
        timestamp: Date.now(),
        imports: [],
        exports: [],
        functions: [],
        variables: []
      }
    }
  }

  private blocklyToTypeScript(blocklyData: any): string {
    // 临时实现：简单的转换逻辑
    // 实际实现需要根据 Blockly 块的类型生成对应的 TypeScript 代码
    if (typeof blocklyData === 'string') {
      return blocklyData
    }

    if (blocklyData && blocklyData.blocks) {
      // 基于块生成代码的逻辑
      return this.generateCodeFromBlocks(blocklyData.blocks)
    }

    return ''
  }

  private generateCodeFromBlocks(blocks: any[]): string {
    // 简化实现：将块转换为基本的 TypeScript 代码
    let code = ''

    blocks.forEach(block => {
      switch (block.type) {
        case 'function_definition':
          code += `function ${block.name}() {\n  // TODO: implement\n}\n\n`
          break
        case 'variable_declaration':
          code += `let ${block.name}: ${block.dataType} = ${block.value};\n`
          break
        default:
          code += `// Unknown block type: ${block.type}\n`
      }
    })

    return code
  }

  private astToBlockly(ast: ts.SourceFile): any {
    // 简化实现：从 AST 提取基本信息
    const blocks: any[] = []

    const visitor = (node: ts.Node) => {
      switch (node.kind) {
        case ts.SyntaxKind.FunctionDeclaration:
          const func = node as ts.FunctionDeclaration
          blocks.push({
            type: 'function_definition',
            name: func.name?.text || 'anonymous',
            parameters: func.parameters.map(p => p.name)
          })
          break
        case ts.SyntaxKind.VariableDeclaration:
          const varDecl = node as ts.VariableDeclaration
          blocks.push({
            type: 'variable_declaration',
            name: varDecl.name,
            value: varDecl.initializer?.getText()
          })
          break
      }
      ts.forEachChild(node, visitor)
    }

    visitor(ast)

    return { blocks }
  }

  private formatTypeScript(code: string): string {
    // 使用 TypeScript 的打印机进行格式化
    const sourceFile = ts.createSourceFile('temp.ts', code, ts.ScriptTarget.ES2020, true)
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
    return printer.printFile(sourceFile)
  }

  private extractImports(ast: ts.SourceFile): string[] {
    const imports: string[] = []

    const visitor = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
        const moduleSpecifier = node.moduleSpecifier.getText().replace(/['"]/g, '')
        imports.push(moduleSpecifier)
      }
      ts.forEachChild(node, visitor)
    }

    visitor(ast)
    return imports
  }

  private extractExports(ast: ts.SourceFile): string[] {
    const exports: string[] = []

    const visitor = (node: ts.Node) => {
      if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
        exports.push(node.getText())
      }
      ts.forEachChild(node, visitor)
    }

    visitor(ast)
    return exports
  }

  private extractFunctions(ast: ts.SourceFile): string[] {
    const functions: string[] = []

    const visitor = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        functions.push(node.name.text)
      }
      ts.forEachChild(node, visitor)
    }

    visitor(ast)
    return functions
  }

  private extractVariables(ast: ts.SourceFile): string[] {
    const variables: string[] = []

    const visitor = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        variables.push(node.name.text)
      }
      ts.forEachChild(node, visitor)
    }

    visitor(ast)
    return variables
  }
}
