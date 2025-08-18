/**
 * 数据转换模块契约验证测试
 * 确保JsonDataTransformer类完全符合DataTransformer接口定义
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { JsonDataTransformer, createJsonDataTransformer, createDataTransformationManager, globalTransformationManager } from '.';
import { DataType } from './contracts';
import type { DataTransformer, TransformationContext } from './contracts';

describe('DataTransformer Contract Validation', () => {
  let transformer: DataTransformer<any, any>;
  let manager: ReturnType<typeof createDataTransformationManager>;

  beforeEach(() => {
    transformer = createJsonDataTransformer();
    manager = createDataTransformationManager();
  });

  describe('接口实现完整性验证', () => {
    it('should implement all required methods from DataTransformer interface', () => {
      // 验证所有必需的方法都已实现
      expect(typeof transformer.fromBlocklyToMonaco).toBe('function');
      expect(typeof transformer.fromMonacoToBlockly).toBe('function');
      expect(typeof transformer.canHandle).toBe('function');
      expect(typeof transformer.getSupportedDataType).toBe('function');
      expect(typeof transformer.getTransformerId).toBe('function');
      expect(typeof transformer.getVersion).toBe('function');
    });

    it('should return valid TransformationResult from fromBlocklyToMonaco', async () => {
      const testData = { key: 'value', number: 123 };
      const result = await transformer.fromBlocklyToMonaco(testData);
      
      // 验证返回对象包含所有必需的字段
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('stats');
      
      // 验证字段类型正确
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.stats).toBe('object');
      expect(typeof result.stats?.durationMs).toBe('number');
    });

    it('should return valid TransformationResult from fromMonacoToBlockly', async () => {
      const testData = '{"key":"value","number":123}';
      const result = await transformer.fromMonacoToBlockly(testData);
      
      // 验证返回对象包含所有必需的字段
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('stats');
      
      // 验证字段类型正确
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.stats).toBe('object');
      expect(typeof result.stats?.durationMs).toBe('number');
    });

    it('should return boolean from canHandle method', () => {
      const result1 = transformer.canHandle({});
      const result2 = transformer.canHandle('not an object');
      
      expect(typeof result1).toBe('boolean');
      expect(typeof result2).toBe('boolean');
    });

    it('should return valid DataType from getSupportedDataType', () => {
      const supportedDataTypes = ['JSON', 'EXPRESSION', 'TYPESCRIPT'];
      const dataType = transformer.getSupportedDataType();
      
      expect(supportedDataTypes).toContain(dataType);
    });

    it('should return string from getTransformerId and getVersion', () => {
      expect(typeof transformer.getTransformerId()).toBe('string');
      expect(typeof transformer.getVersion()).toBe('string');
      
      // 验证ID和版本不为空
      expect(transformer.getTransformerId().length).toBeGreaterThan(0);
      expect(transformer.getVersion().length).toBeGreaterThan(0);
    });
  });

  describe('接口边界情况验证', () => {
    it('should handle undefined parameters gracefully', async () => {
      // 验证关键方法在接收到undefined参数时不会崩溃
      expect(() => {
        transformer.canHandle(undefined);
      }).not.toThrow();
      
      // 验证异步方法在接收到undefined参数时不会崩溃
      await expect(transformer.fromBlocklyToMonaco(undefined as any)).resolves.toHaveProperty('success');
      await expect(transformer.fromMonacoToBlockly(undefined as any)).resolves.toHaveProperty('success');
    });

    it('should handle null parameters gracefully', async () => {
      // 验证关键方法在接收到null参数时不会崩溃
      expect(() => {
        transformer.canHandle(null);
      }).not.toThrow();
      
      // 验证异步方法在接收到null参数时不会崩溃
      await expect(transformer.fromBlocklyToMonaco(null as any)).resolves.toHaveProperty('success');
      await expect(transformer.fromMonacoToBlockly(null as any)).resolves.toHaveProperty('success');
    });

    it('should handle invalid JSON strings gracefully', async () => {
      const invalidJson = 'invalid json string';
      const result = await transformer.fromMonacoToBlockly(invalidJson);
      
      // 验证结果失败但不会崩溃
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('TRANSFORMATION_ERROR');
    });

    it('should handle complex nested objects', async () => {
      const complexObject = {
        simple: 'value',
        numbers: [1, 2, 3],
        nested: {
          deep: {
            value: true,
            array: [{ item: 1 }, { item: 2 }]
          }
        }
      };
      
      const monacoResult = await transformer.fromBlocklyToMonaco(complexObject);
      const blocklyResult = await transformer.fromMonacoToBlockly(monacoResult.result);
      
      // 验证复杂对象能够被正确转换并保持数据完整性
      expect(monacoResult.success).toBe(true);
      expect(blocklyResult.success).toBe(true);
      expect(blocklyResult.result).toEqual(complexObject);
    });
  });

  describe('类型安全验证', () => {
    it('should create DataTransformer instance through factory function', () => {
      const factoryTransformer = createJsonDataTransformer();
      
      // 验证工厂函数返回的是DataTransformer类型的实例
      expect(factoryTransformer).toBeInstanceOf(JsonDataTransformer);
      expect(typeof factoryTransformer.fromBlocklyToMonaco).toBe('function');
      expect(typeof factoryTransformer.fromMonacoToBlockly).toBe('function');
    });

    it('should handle TransformationContext correctly', async () => {
      const testData = { key: 'value' };
      const context: TransformationContext = {
        dataType: DataType.JSON,
        options: {
          validate: true,
          format: true,
          indentSize: 2,
          maxLineLength: 100
        }
      };
      
      const result = await transformer.fromBlocklyToMonaco(testData, context);
      
      // 验证上下文被正确处理
      expect(result.success).toBe(true);
      expect(result.stats?.durationMs).toBeGreaterThan(0);
    });

    it('should maintain consistent error structure', async () => {
      const invalidData = 'invalid data';
      const result = await transformer.fromMonacoToBlockly(invalidData);
      
      // 验证错误对象结构一致性
      expect(result.error).toBeDefined();
      expect(result.error).toHaveProperty('code');
      expect(result.error).toHaveProperty('message');
      expect(typeof result.error?.code).toBe('string');
      expect(typeof result.error?.message).toBe('string');
    });

    it('should handle large data sets efficiently', async () => {
      // 创建一个较大的测试数据集
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` }));
      const largeObject = { items: largeArray, metadata: { count: 1000, timestamp: Date.now() } };
      
      const startTime = performance.now();
      const result = await transformer.fromBlocklyToMonaco(largeObject);
      const duration = performance.now() - startTime;
      
      // 验证大数据集能够被处理且处理时间在合理范围内
      expect(result.success).toBe(true);
      expect(result.stats?.durationMs).toBeGreaterThan(0);
      expect(result.stats?.durationMs).toBeLessThan(duration * 2); // 确保统计的时间与实际时间接近
    });

    it('should handle empty object and array data', async () => {
      // 测试空对象
      const emptyObject = {};
      const objectResult = await transformer.fromBlocklyToMonaco(emptyObject);
      expect(objectResult.success).toBe(true);
      
      // 测试空数组
      const emptyArray: Record<string, any>[] = [];
      const arrayResult = await transformer.fromBlocklyToMonaco(emptyArray);
      expect(arrayResult.success).toBe(true);
      
      // 测试空字符串
      const emptyString = '';
      const stringResult = await transformer.fromMonacoToBlockly(emptyString);
      expect(stringResult.success).toBe(false); // 空字符串不是有效的JSON
    });
  });

  describe('TransformationManager契约验证', () => {
    it('should create valid TransformationManager instance', () => {
      // 验证管理器实例创建成功并包含必要方法
      expect(typeof manager.transformFromBlocklyToMonaco).toBe('function');
      expect(typeof manager.transformFromMonacoToBlockly).toBe('function');
      expect(typeof manager.getSupportedDataTypes).toBe('function');
      expect(typeof manager.supportsDataType).toBe('function');
    });

    it('should handle transformation through manager correctly', async () => {
      const testData = { key: 'value' };
      const result = await manager.transformFromBlocklyToMonaco(
        testData,
        DataType.JSON
      );
      
      // 验证管理器能够正确处理转换请求
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });

    it('should return supported data types correctly', () => {
      const supportedTypes = manager.getSupportedDataTypes();
      
      // 验证返回的支持数据类型数组有效
      expect(Array.isArray(supportedTypes)).toBe(true);
      expect(supportedTypes).toContain(DataType.JSON);
    });

    it('should verify global transformation manager instance', () => {
      // 验证全局管理器实例存在且功能正常
      expect(typeof globalTransformationManager.transformFromBlocklyToMonaco).toBe('function');
      expect(typeof globalTransformationManager.transformFromMonacoToBlockly).toBe('function');
    });
  });
});