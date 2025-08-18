import { DataTransformationManager } from './index';
import { DataType } from './contracts';
import { createStateManager } from '../state-management/index';

// 标记这是一个测试文件
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
      console.log('====== 开始数据转换优化测试 ======\n');
      
      // 创建状态管理器
      const stateManager = createStateManager();
      
      // 创建数据转换管理器
      const transformationManager = new DataTransformationManager();
      transformationManager.setStatusManager(stateManager);
      
      // 测试1: 基本转换功能测试
      console.log('测试1: 基本转换功能测试');
      try {
        const result1 = await transformationManager.transformFromBlocklyToMonaco(
          testBlocklyData,
          DataType.JSON,
          { options: { debug: true } }
        );
        console.log(`转换成功: ${result1.success}`);
        console.log(`转换耗时: ${result1.stats?.durationMs || 0}ms`);
        console.log(`结果大小: ${result1.stats?.resultSizeBytes || 0} bytes`);
        console.log('------------------------\n');
      } catch (error) {
        console.error('转换过程中发生错误:', error);
        console.log('------------------------\n');
      }
      
      // 测试2: 反向转换功能测试
      console.log('测试2: 反向转换功能测试');
      try {
        const result2 = await transformationManager.transformFromMonacoToBlockly(
          testMonacoData,
          DataType.JSON,
          { options: { debug: true } }
        );
        console.log(`转换成功: ${result2.success}`);
        console.log(`转换耗时: ${result2.stats?.durationMs || 0}ms`);
        console.log(`结果大小: ${result2.stats?.resultSizeBytes || 0} bytes`);
        console.log('------------------------\n');
      } catch (error) {
        console.error('转换过程中发生错误:', error);
        console.log('------------------------\n');
      }
      
      // 测试3: 重试机制测试
      console.log('测试3: 重试机制测试');
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
        console.log(`转换成功: ${result3.success}`);
        if (!result3.success) {
          console.log(`错误信息: ${result3.error?.message || '未知错误'}`);
        }
        console.log(`重试次数: ${result3.stats?.retryCount || 0}`);
        console.log('------------------------\n');
      } catch (error) {
        console.error('转换过程中发生错误:', error);
        console.log('------------------------\n');
      }
      
      // 测试4: 性能测试 (100KB数据)
      console.log('测试4: 性能测试 (100KB数据)');
      const largeData = generateLargeData(100);
      try {
        const startTime = Date.now();
        const result4 = await transformationManager.transformFromMonacoToBlockly(
          largeData,
          DataType.JSON,
          { options: { debug: true } }
        );
        const totalTime = Date.now() - startTime;
        console.log(`转换成功: ${result4.success}`);
        console.log(`转换耗时: ${totalTime}ms`);
        console.log(`结果大小: ${result4.stats?.resultSizeBytes || 0} bytes`);
        const resultSize = result4.stats?.resultSizeBytes || 0;
        const throughput = totalTime > 0 ? Math.round(resultSize / totalTime) : 0;
        console.log(`吞吐量: ${throughput} KB/s`);
        console.log('------------------------\n');
      } catch (error) {
        console.error('转换过程中发生错误:', error);
        console.log('------------------------\n');
      }
      
      // 测试5: 状态管理集成测试
      console.log('测试5: 状态管理集成测试');
      console.log(`初始系统状态: ${stateManager.getCurrentState()}`);
      
      // 模拟编辑器编辑
      stateManager.handleBlocklyEdit();
      console.log(`编辑后系统状态: ${stateManager.getCurrentState()}`);
      
      // 执行同步转换
      await transformationManager.transformFromBlocklyToMonaco(
        testBlocklyData,
        DataType.JSON,
        { options: { debug: true } }
      );
      console.log(`同步后系统状态: ${stateManager.getCurrentState()}`);
      
      console.log('------------------------\n');
      console.log('====== 数据转换优化测试完成 ======');
    }

    await runTests();
  });
});