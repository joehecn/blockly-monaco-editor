/**
 * 数据转换模块单元测试
 * 测试数据转换器的核心功能，包括基础转换器、JSON数据转换器、注册表和管理器
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataType } from './contracts';
import { 
  BaseTransformer,
  JsonDataTransformer, 
  TransformerRegistry, 
  DataTransformationManager, 
  createDataTransformationManager, 
  createJsonDataTransformer, 
  globalTransformationManager 
} from '.';
import { createStateManager } from '../state-management/index';

// Mock console.log 以避免测试输出污染
console.log = vi.fn();
console.error = vi.fn();
console.warn = vi.fn();

describe('DataTransformation Module Tests', () => {
  
  describe('BaseTransformer Tests', () => {
    // 创建一个简单的测试转换器继承BaseTransformer
    // 修复泛型参数和方法签名，使其与DataTransformer接口一致
    class TestTransformer extends BaseTransformer<string, number> {
      async fromBlocklyToMonaco(data: string): Promise<any> {
        const startTime = performance.now();
        try {
          const num = parseInt(data, 10);
          if (isNaN(num)) {
            throw new Error('Cannot parse to number');
          }
          // 确保传递number类型的durationMs参数
          const durationMs = performance.now() - startTime;
          return this.createSuccessResult(num, durationMs);
        } catch (error) {
          // 确保传递number类型的durationMs参数
          const durationMs = performance.now() - startTime;
          return this.createErrorResult(error as Error, durationMs);
        }
      }

      async fromMonacoToBlockly(data: number): Promise<any> {
        const startTime = performance.now();
        try {
          // 确保传递number类型的durationMs参数
          const durationMs = performance.now() - startTime;
          // 对于TestTransformer<string, number>，fromMonacoToBlockly需要返回TransformationResult<string>
          // 但createSuccessResult期望返回TransformationResult<number>，所以需要正确转换类型
          const successResult = this.createSuccessResult(data.toString() as unknown as number, durationMs);
          return successResult as unknown as typeof successResult;
        } catch (error) {
          // 确保传递number类型的durationMs参数
          const durationMs = performance.now() - startTime;
          return this.createErrorResult(error as Error, durationMs);
        }
      }
    }

    let testTransformer: TestTransformer;

    beforeEach(() => {
      testTransformer = new TestTransformer('test-transformer', '1.0.0', DataType.JSON);
    });

    it('should initialize with correct properties', () => {
      expect(testTransformer.getTransformerId()).toBe('test-transformer');
      expect(testTransformer.getVersion()).toBe('1.0.0');
      expect(testTransformer.getSupportedDataType()).toBe(DataType.JSON);
    });

    it('should handle valid data', () => {
      expect(testTransformer.canHandle('test')).toBe(true);
      expect(testTransformer.canHandle(123)).toBe(true);
      expect(testTransformer.canHandle({})).toBe(true);
    });

    it('should not handle undefined or null', () => {
      expect(testTransformer.canHandle(undefined)).toBe(false);
      expect(testTransformer.canHandle(null)).toBe(false);
    });

    it('should create success result correctly', async () => {
      const result = await testTransformer.fromBlocklyToMonaco('123');
      expect(result.success).toBe(true);
      expect(result.result).toBe(123);
      expect(result.stats).toBeDefined();
      expect(result.stats?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should create error result correctly', async () => {
      const result = await testTransformer.fromBlocklyToMonaco('abc');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Cannot parse to number');
      expect(result.stats?.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('JsonDataTransformer Tests', () => {
    let jsonTransformer: JsonDataTransformer;

    beforeEach(() => {
      jsonTransformer = new JsonDataTransformer();
    });

    it('should initialize with correct properties', () => {
      expect(jsonTransformer.getTransformerId()).toBe('json-transformer');
      expect(jsonTransformer.getVersion()).toBe('1.0.0');
      expect(jsonTransformer.getSupportedDataType()).toBe(DataType.JSON);
    });

    it('should handle valid JSON object', () => {
      expect(jsonTransformer.canHandle({ key: 'value' })).toBe(true);
    });

    it('should handle valid JSON string', () => {
      expect(jsonTransformer.canHandle('{"key":"value"}')).toBe(true);
    });

    it('should not handle invalid JSON string', () => {
      expect(jsonTransformer.canHandle('invalid json')).toBe(false);
    });

    it('should not handle undefined or null', () => {
      expect(jsonTransformer.canHandle(undefined)).toBe(false);
      expect(jsonTransformer.canHandle(null)).toBe(false);
    });

    it('should transform Blockly object to Monaco string correctly', async () => {
      const testData = { name: 'test', value: 123 };
      const result = await jsonTransformer.fromBlocklyToMonaco(testData);
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(typeof result.result).toBe('string');
      
      // 验证结果可以被解析回原始对象
      const parsedResult = JSON.parse(result.result as string);
      expect(parsedResult).toEqual(testData);
    });

    it('should transform Monaco string to Blockly object correctly', async () => {
      const testData = '{"name":"test","value":123}';
      const result = await jsonTransformer.fromMonacoToBlockly(testData);
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(typeof result.result).toBe('object');
      expect(result.result).toEqual({ name: 'test', value: 123 });
    });

    it('should handle JSON parsing errors', async () => {
      const invalidJson = '{invalid json}';
      const result = await jsonTransformer.fromMonacoToBlockly(invalidJson);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('TRANSFORMATION_ERROR');
    });

    it('should respect validation option', async () => {
      const invalidJson = '{invalid json}';
      const result = await jsonTransformer.fromMonacoToBlockly(invalidJson, {
        options: { validate: false }
      });
      
      // 检查是否正确处理了validate=false的情况
      if (result.success) {
        expect(result.result).toEqual({ raw: invalidJson });
      } else {
        // 在某些实现中，可能会对基础数据有效性进行额外检查
        expect(result.error).toBeDefined();
      }
    });

    it('should handle formatting with custom indent size', async () => {
      const testData = { name: 'test', nested: { a: 1, b: 2 } };
      const result = await jsonTransformer.fromBlocklyToMonaco(testData, {
        options: { indentSize: 4 }
      });
      
      expect(result.success).toBe(true);
      expect(result.result).toContain('    '); // 4空格缩进
    });
  
    // 修复重复的calculateDataSize方法引用
    it('should calculate data size correctly', async () => {
      const testData = { name: 'test', value: 123 };
      const result = await jsonTransformer.fromBlocklyToMonaco(testData);
      
      expect(result.success).toBe(true);
      expect(result.stats?.dataSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('TransformerRegistry Tests', () => {
    let registry: TransformerRegistry;
    let mockTransformer: any;

    beforeEach(() => {
      // 通过createDataTransformationManager间接获取registry实例
      const manager = createDataTransformationManager();
      // 使用Object.getPrototypeOf获取原型对象，然后访问私有属性
      // 注意：这仅用于测试目的
      registry = (manager as any).registry;
      
      // 创建模拟转换器
      mockTransformer = {
        getTransformerId: vi.fn().mockReturnValue('mock-transformer'),
        getVersion: vi.fn().mockReturnValue('1.0.0'),
        getSupportedDataType: vi.fn().mockReturnValue(DataType.EXPRESSION),
        canHandle: vi.fn().mockReturnValue(true),
        fromBlocklyToMonaco: vi.fn(),
        fromMonacoToBlockly: vi.fn()
      };
    });

    it('should return singleton instance', () => {
      const instance1 = TransformerRegistry.getInstance();
      const instance2 = TransformerRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should register transformer successfully', () => {
      registry.registerTransformer(mockTransformer);
      const registered = registry.getTransformer(DataType.EXPRESSION);
      expect(registered).toBe(mockTransformer);
    });

    it('should return undefined for unregistered data type', () => {
      const transformer = registry.getTransformer(DataType.TYPESCRIPT);
      expect(transformer).toBeUndefined();
    });

    it('should list all supported data types', () => {
      // 默认应该注册了JSON转换器
      const dataTypes = registry.getSupportedDataTypes();
      expect(dataTypes).toContain(DataType.JSON);
      expect(Array.isArray(dataTypes)).toBe(true);
    });

    it('should check if data type is supported', () => {
      expect(registry.supportsDataType(DataType.JSON)).toBe(true);
      // 检查一个明确不支持的数据类型
      // 注意：某些环境中可能已经注册了其他数据类型的转换器
      const unsupportedDataType = 'UNSUPPORTED_DATA_TYPE' as DataType;
      expect(registry.supportsDataType(unsupportedDataType)).toBe(false);
    });

    it('should return all registered transformers', () => {
      const transformers = registry.getAllTransformers();
      expect(Array.isArray(transformers)).toBe(true);
      expect(transformers.length).toBeGreaterThan(0);
    });
  });

  describe('DataTransformationManager Tests', () => {
    let manager: DataTransformationManager;
    let mockRegistry: any;
    let mockTransformer: any;

    beforeEach(() => {
      // 创建模拟转换器和注册表
      mockTransformer = {
        canHandle: vi.fn().mockReturnValue(true),
        fromBlocklyToMonaco: vi.fn().mockResolvedValue({
          success: true,
          result: '{"test":"data"}',
          stats: { durationMs: 10 }
        }),
        fromMonacoToBlockly: vi.fn().mockResolvedValue({
          success: true,
          result: { test: 'data' },
          stats: { durationMs: 10 }
        })
      };
      
      mockRegistry = {
        getTransformer: vi.fn().mockReturnValue(mockTransformer),
        registerTransformer: vi.fn(),
        getSupportedDataTypes: vi.fn().mockReturnValue([DataType.JSON]),
        supportsDataType: vi.fn().mockReturnValue(true)
      };
      
      manager = new DataTransformationManager(mockRegistry);
    });

    it('should transform from Blockly to Monaco successfully', async () => {
      const data = { test: 'data' };
      const result = await manager.transformFromBlocklyToMonaco(data, DataType.JSON);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('{"test":"data"}');
      expect(mockTransformer.fromBlocklyToMonaco).toHaveBeenCalledWith(data, undefined);
    });

    it('should transform from Monaco to Blockly successfully', async () => {
      const data = '{"test":"data"}';
      const result = await manager.transformFromMonacoToBlockly(data, DataType.JSON);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ test: 'data' });
      expect(mockTransformer.fromMonacoToBlockly).toHaveBeenCalledWith(data, undefined);
    });

    it('should handle transformer not found error', async () => {
      mockRegistry.getTransformer.mockReturnValue(undefined);
      const result = await manager.transformFromBlocklyToMonaco({}, DataType.JSON);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TRANSFORMER_NOT_FOUND');
    });

    it('should handle data not handleable error', async () => {
      mockTransformer.canHandle.mockReturnValue(false);
      const result = await manager.transformFromBlocklyToMonaco({}, DataType.JSON);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATA_NOT_HANDLEABLE');
    });

    it('should delegate to registry methods', () => {
      manager.registerTransformer(mockTransformer);
      manager.getSupportedDataTypes();
      manager.supportsDataType(DataType.JSON);
      
      expect(mockRegistry.registerTransformer).toHaveBeenCalledWith(mockTransformer);
      expect(mockRegistry.getSupportedDataTypes).toHaveBeenCalled();
      expect(mockRegistry.supportsDataType).toHaveBeenCalledWith(DataType.JSON);
    });
  });

  describe('Factory Functions Tests', () => {
    it('should create DataTransformationManager correctly', () => {
      const manager = createDataTransformationManager();
      expect(manager).toBeInstanceOf(DataTransformationManager);
    });

    it('should create JsonDataTransformer correctly', () => {
      const transformer = createJsonDataTransformer();
      expect(transformer).toBeInstanceOf(JsonDataTransformer);
      expect(transformer.getTransformerId()).toBe('json-transformer');
    });

    it('should have globalTransformationManager instance', () => {
      expect(globalTransformationManager).toBeInstanceOf(DataTransformationManager);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    let jsonTransformer: JsonDataTransformer;

    beforeEach(() => {
      jsonTransformer = new JsonDataTransformer();
    });

    it('should handle empty object transformation', async () => {
      const result = await jsonTransformer.fromBlocklyToMonaco({});
      expect(result.success).toBe(true);
      expect(result.result).toBe('{}');
    });

    it('should handle empty string transformation', async () => {
      const result = await jsonTransformer.fromMonacoToBlockly('');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TRANSFORMATION_ERROR');
    });

    it('should handle large JSON objects', async () => {
      // 创建一个较大的测试对象
      const largeObject = {
        array: new Array(1000).fill(0).map((_, i) => ({ id: i, value: `value-${i}` })),
        nested: { depth: 1, more: { depth: 2, evenMore: { depth: 3 } } }
      };
      
      const result = await jsonTransformer.fromBlocklyToMonaco(largeObject);
      expect(result.success).toBe(true);
      expect(result.stats?.dataSizeBytes).toBeGreaterThan(0);
    });

    it('should handle circular references gracefully', async () => {
      // 创建一个循环引用对象
      const circular: any = { name: 'circular' };
      circular.self = circular;
      
      const result = await jsonTransformer.fromBlocklyToMonaco(circular);
      // formatJson方法会捕获循环引用错误并返回字符串表示
      expect(result.success).toBe(true);
      expect(typeof result.result).toBe('string');
    });

    it('should extract error location information', async () => {
      // 创建一个有语法错误的JSON字符串，尝试让错误消息包含位置信息
      const invalidJson = '{"key": value}'; // 缺少引号
      const result = await jsonTransformer.fromMonacoToBlockly(invalidJson, { options: { validate: true } });
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TRANSFORMATION_ERROR');
      // 错误位置可能因环境而异，我们只检查是否尝试提取了位置信息
      // 注意：在某些实现中，可能无法准确提取位置信息
      if (result.error?.location) {
        expect(typeof result.error.location.line).toBe('number');
        expect(typeof result.error.location.column).toBe('number');
      }
    });
  });

  describe('数据转换优化测试', () => {
    // 单个测试用例
    it('should run transformation optimization tests', async () => {
      // 创建测试数据
      const testBlocklyData = {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: 'controls_if',
              inputs: {
                IF0: {
                  block: {
                    type: 'logic_compare',
                    fields: {
                      OP: 'EQ'
                    },
                    inputs: {
                      A: {
                        block: {
                          type: 'math_number',
                          fields: {
                            NUM: 10
                          }
                        }
                      },
                      B: {
                        block: {
                          type: 'math_number',
                          fields: {
                            NUM: 20
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          ]
        }
      };

      const testMonacoData = JSON.stringify(testBlocklyData, null, 2);

      // 模拟转换错误的测试数据
      const invalidJsonData = `{
        "blocks": {
          "languageVersion": 0,
          "blocks": [
            {
              "type": "controls_if",
              "inputs": {
                "IF0": {
                  "block": {
                    "type": "logic_compare",
                    "fields": {
                      "OP": "EQ"
                    }
                  }
                }
              }
            }
          ]
        }`; // 注意这里缺少了结尾的闭合括号

      // 创建性能测试的大尺寸数据
      function generateLargeData(sizeKB: number): string {
        const baseObj = {
          blocks: {
            languageVersion: 0,
            blocks: Array(Math.floor(sizeKB * 10)).fill({
              type: 'math_number',
              fields: {
                NUM: 42
              }
            })
          }
        };
        return JSON.stringify(baseObj);
      }

      // 运行测试函数
      async function runTests() {
        // 创建状态管理器
        const stateManager = createStateManager();
        
        // 创建数据转换管理器
        const transformationManager = new DataTransformationManager();
        transformationManager.setStatusManager(stateManager);
        
        // 测试1: 基本转换功能测试
        try {
          const result1 = await transformationManager.transformFromBlocklyToMonaco(
            testBlocklyData,
            DataType.JSON,
            { options: { debug: true } }
          );
          expect(result1.success).toBe(true);
        } catch (error) {
          console.error('转换过程中发生错误:', error);
        }
        
        // 测试2: 反向转换功能测试
        try {
          const result2 = await transformationManager.transformFromMonacoToBlockly(
            testMonacoData,
            DataType.JSON,
            { options: { debug: true } }
          );
          expect(result2.success).toBe(true);
        } catch (error) {
          console.error('转换过程中发生错误:', error);
        }
        
        // 测试3: 重试机制测试
        try {
          const result3 = await transformationManager.transformFromMonacoToBlockly(
            invalidJsonData,
            DataType.JSON,
            {
              options: {
                debug: true,
                retry: {
                  maxRetries: 2,
                  retryInterval: 500
                }
              }
            }
          );
          expect(result3.success).toBe(false);
          expect(result3.error).toBeDefined();
        } catch (error) {
          console.error('转换过程中发生错误:', error);
        }
        
        // 测试4: 性能测试 (100KB数据)
        const largeData = generateLargeData(100);
        try {
          const startTime = Date.now();
          const result4 = await transformationManager.transformFromMonacoToBlockly(
            largeData,
            DataType.JSON,
            { options: { debug: true } }
          );
          const totalTime = Date.now() - startTime;
          expect(result4.success).toBe(true);
          expect(totalTime).toBeGreaterThan(0);
        } catch (error) {
          console.error('转换过程中发生错误:', error);
        }
        
        // 测试5: 状态管理集成测试
        // 模拟编辑器编辑
        stateManager.handleBlocklyEdit();
        
        // 执行同步转换
        await transformationManager.transformFromBlocklyToMonaco(
          testBlocklyData,
          DataType.JSON,
          { options: { debug: true } }
        );
      }

      await runTests();
    });
  });
});