/**
 * JSON 转换器 - 实现 Blockly ↔ JSON ↔ Monaco 的转换
 */
import type { AbstractTransformer } from '../core/types'

export interface JsonData {
  type: 'json'
  content: any
  metadata?: {
    version: string
    timestamp: number
  }
}

export class JsonTransformer implements AbstractTransformer<JsonData> {
  fromBlockly(blocklyData: any): JsonData {
    try {
      // 如果 blocklyData 已经是字符串，先解析
      const data = typeof blocklyData === 'string' ? JSON.parse(blocklyData) : blocklyData

      return {
        type: 'json',
        content: data,
        metadata: {
          version: '1.0',
          timestamp: Date.now()
        }
      }
    } catch (error) {
      console.error('Failed to convert from Blockly:', error)
      return {
        type: 'json',
        content: {},
        metadata: {
          version: '1.0',
          timestamp: Date.now()
        }
      }
    }
  }

  toMonaco(data: JsonData): string {
    try {
      return JSON.stringify(data.content, null, 2)
    } catch (error) {
      console.error('Failed to convert to Monaco:', error)
      return '{}'
    }
  }

  fromMonaco(text: string): JsonData | null {
    try {
      const content = JSON.parse(text)
      return {
        type: 'json',
        content,
        metadata: {
          version: '1.0',
          timestamp: Date.now()
        }
      }
    } catch (error) {
      console.error('Failed to parse Monaco content:', error)
      return null
    }
  }

  toBlockly(data: JsonData): any {
    return data.content
  }

  validate(data: JsonData): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!data) {
      errors.push('Data is null or undefined')
      return { valid: false, errors }
    }

    if (data.type !== 'json') {
      errors.push('Invalid data type, expected "json"')
    }

    if (data.content === undefined) {
      errors.push('Content is missing')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  format(data: JsonData): JsonData {
    return {
      ...data,
      metadata: {
        version: data.metadata?.version || '1.0',
        timestamp: Date.now()
      }
    }
  }
}
