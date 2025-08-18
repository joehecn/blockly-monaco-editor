/**
 * 数据转换模块 - 核心实现
 * 
 * 负责在 Blockly 编辑器与 Monaco 编辑器之间进行数据转换，支持多种数据类型
 */
import { DataType } from './contracts';
import type { TransformationError, TransformationResult, TransformationContext, DataTransformer } from './contracts';
import type { StateManager } from '../state-management/contracts';
import { SystemState, ErrorType } from '../state-management/contracts';
import { JsonStateManager } from '../state-management/index';

/**
 * 基础转换器类
 * 实现了通用的转换器功能，供具体数据类型的转换器继承
 */
export abstract class BaseTransformer<T, U> implements DataTransformer<T, U> {
  protected readonly transformerId: string;
  protected readonly version: string;
  protected readonly supportedDataType: DataType;

  /**
   * 构造函数
   * @param transformerId 转换器唯一标识符
   * @param version 版本号
   * @param dataType 支持的数据类型
   */
  constructor(transformerId: string, version: string, dataType: DataType) {
    this.transformerId = transformerId;
    this.version = version;
    this.supportedDataType = dataType;
  }

  /**
   * 从 Blockly 格式转换为 Monaco 格式
   * 抽象方法，由具体实现类提供
   */
  abstract fromBlocklyToMonaco(data: T, context?: TransformationContext): Promise<TransformationResult<U>>;

  /**
   * 从 Monaco 格式转换为 Blockly 格式
   * 抽象方法，由具体实现类提供
   */
  abstract fromMonacoToBlockly(data: U, context?: TransformationContext): Promise<TransformationResult<T>>;

  /**
   * 验证数据是否可以被当前转换器处理
   * 默认实现简单检查数据是否存在
   */
  canHandle(data: unknown): boolean {
    return data !== undefined && data !== null;
  }

  /**
   * 获取当前转换器支持的数据类型
   */
  getSupportedDataType(): DataType {
    return this.supportedDataType;
  }

  /**
   * 获取转换器的唯一标识符
   */
  getTransformerId(): string {
    return this.transformerId;
  }

  /**
   * 获取转换器的版本信息
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * 创建成功的转换结果
   */
  protected createSuccessResult(result: U, durationMs: number, context?: TransformationContext): TransformationResult<U> {
    const resultObj = {
      success: true,
      result,
      stats: {
        durationMs,
        dataSizeBytes: this.calculateDataSize(result)
      }
    };
    
    if (context?.options?.debug) {
      console.debug(`[${this.getTransformerId()}] 转换成功，耗时 ${durationMs}ms，结果大小 ${this.calculateDataSize(result)} bytes`);
    }
    
    return resultObj;
  }

  /**
   * 创建失败的转换结果
   */
  protected createErrorResult(error: Error | string, durationMs: number, transformationError?: TransformationError, context?: TransformationContext): TransformationResult<U> {
    const errorObj: TransformationError = transformationError || (typeof error === 'string' 
      ? { code: 'TRANSFORMATION_ERROR', message: error } 
      : {
          code: 'TRANSFORMATION_ERROR',
          message: error.message,
          originalError: error
        });
    
    const resultObj = {
      success: false,
      error: errorObj,
      stats: {
        durationMs
      }
    };
    
    if (context?.options?.debug) {
      console.debug(`[${this.getTransformerId()}] 转换失败: ${errorObj.message}，耗时 ${durationMs}ms`);
    }
    
    return resultObj;
  }

  /**
   * 计算数据大小（字节）
   */
  protected calculateDataSize(data: any): number {
    try {
      const serializedData = JSON.stringify(data);
      return new Blob([serializedData]).size;
    } catch (error) {
      console.warn('无法计算数据大小:', error);
      return 0;
    }
  }

  /**
   * 格式化JSON数据
   */
  protected formatJson(data: any, context?: TransformationContext): string {
    const indentSize = context?.options?.indentSize || 2;
    try {
      return JSON.stringify(data, null, indentSize);
    } catch (error) {
      return String(data);
    }
  }

  /**
   * 带重试机制的异步操作执行
   * 支持抖动和渐进式重试间隔
   * @param operation 要执行的异步操作
   * @param context 转换上下文
   * @param errorType 错误类型标记
   * @returns 操作结果
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    context?: TransformationContext,
    errorType: string = 'TRANSFORM_ERROR'
  ): Promise<{ result?: T; error?: TransformationError }> {
    const maxRetries = context?.options?.retry?.maxRetries || 0;
    const baseRetryInterval = context?.options?.retry?.retryInterval || 300;
    let lastError: Error | undefined;
    
    // 记录开始时间用于性能分析
    const startTime = Date.now();
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // 应用抖动和渐进式重试间隔
          // 指数退避：baseRetryInterval * (2^(attempt-1))
          // 抖动：在计算的基础上增加随机因素
          const jitter = Math.random() * 0.5 * baseRetryInterval; // 0%到50%的随机抖动
          const backoffInterval = Math.min(
            baseRetryInterval * Math.pow(2, attempt - 1),
            10000 // 最大等待时间10秒
          );
          const waitTime = backoffInterval + jitter;
          
          if (context?.options?.debug) {
            console.debug(`[${this.getTransformerId()}] 重试第 ${attempt}/${maxRetries} 次，等待 ${Math.round(waitTime)}ms`);
          }
          
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        const result = await operation();
        
        // 记录操作完成时间
        const duration = Date.now() - startTime;
        if (context?.options?.debug && attempt > 0) {
          console.debug(`[${this.getTransformerId()}] 重试成功，总耗时 ${duration}ms`);
        }
        
        return { result };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (context?.options?.debug) {
          console.debug(`[${this.getTransformerId()}] 尝试第 ${attempt} 次失败: ${lastError.message}`);
        }
        
        if (attempt === maxRetries) {
          const duration = Date.now() - startTime;
          if (context?.options?.debug) {
            console.debug(`[${this.getTransformerId()}] 所有重试都失败，总耗时 ${duration}ms`);
          }
          break;
        }
      }
    }

    // 所有尝试都失败了
    return {
      error: {
        code: errorType,
        message: lastError?.message || '转换操作失败',
        originalError: lastError
      }
    };
  }

  /**
   * 记录转换操作的统计信息
   */
  protected recordStats(
    startTimestamp: number,
    resultSizeBytes: number,
    error?: TransformationError
  ): any {
    return {
      durationMs: Date.now() - startTimestamp,
      resultSizeBytes: resultSizeBytes,
      errorCount: error ? 1 : 0,
      errorCode: error?.code
    };
  }
}

/**
 * JSON数据转换器实现
 * 负责JSON格式数据在Blockly和Monaco编辑器之间的转换
 */
export class JsonDataTransformer extends BaseTransformer<Record<string, any>, string> {
  /**
   * 构造函数
   */
  constructor() {
    super('json-transformer', '1.0.0', DataType.JSON);
  }

  /**
   * 从Blockly JSON对象转换为Monaco字符串
   */
  async fromBlocklyToMonaco(
    data: Record<string, any>, 
    context?: TransformationContext
  ): Promise<TransformationResult<string>> {
    const startTime = performance.now();
    
    // 验证数据是否为有效的JSON对象
    if (!this.canHandle(data)) {
      return this.createErrorResult('无效的JSON数据', performance.now() - startTime);
    }

    // 执行转换逻辑，带重试机制
    const { result, error } = await this.executeWithRetry(
      async () => this.formatJson(data, context),
      context,
      'JSON_FORMAT_ERROR'
    );
    
    if (error) {
      // 捕获并记录转换错误
      console.error('从Blockly转换到Monaco失败:', error);
      return this.createErrorResult(error.message, performance.now() - startTime, error);
    }
    
    // 返回成功结果
    return this.createSuccessResult(result!, performance.now() - startTime);
  }

  /**
   * 从Monaco字符串转换为Blockly JSON对象
   */
  async fromMonacoToBlockly(
    data: string, 
    context?: TransformationContext
  ): Promise<TransformationResult<Record<string, any>>> {
    const startTime = performance.now();
    
    // 验证数据是否为有效的字符串
    if (!this.canHandle(data) || typeof data !== 'string') {
      // 确保durationMs是number类型
      const durationMs = performance.now() - startTime;
      // JsonDataTransformer的泛型参数是<Record<string, any>, string>，所以createErrorResult返回TransformationResult<string>
      // 但fromMonacoToBlockly方法需要返回TransformationResult<Record<string, any>>，所以需要正确转换类型
      const errorResult = this.createErrorResult('无效的字符串数据', durationMs);
      return errorResult as unknown as TransformationResult<Record<string, any>>;
    }

    // 执行转换逻辑，带重试机制
    const { result, error } = await this.executeWithRetry(
      async () => {
        // 尝试解析JSON字符串
        try {
          return JSON.parse(data);
        } catch (parseError) {
          // 语法校验失败
          if (context?.options?.validate !== false) {
            const parsingError: TransformationError = {
              code: 'JSON_PARSE_ERROR',
              message: 'JSON解析失败: ' + (parseError instanceof Error ? parseError.message : String(parseError)),
              location: this.extractErrorLocation(parseError as Error),
              originalError: parseError as Error
            };
            
            throw parsingError;
          }
          
          // 如果关闭了验证，则返回原始数据作为字符串
          return data;
        }
      },
      context,
      'JSON_PARSE_ERROR'
    );
    
    if (error) {
      // 捕获并记录转换错误
      console.error('从Monaco转换到Blockly失败:', error);
      const durationMs = performance.now() - startTime;
      const errorResult = this.createErrorResult(
        error.message,
        durationMs
      );
      return errorResult as unknown as TransformationResult<Record<string, any>>;
    }
    
    // 返回成功结果
    return {
      success: true,
      result: result!,
      stats: {
        durationMs: performance.now() - startTime,
        dataSizeBytes: this.calculateDataSize(data),
        resultSizeBytes: this.calculateDataSize(result!)
      }
    };
  }

  /**
   * 验证数据是否可以被当前转换器处理
   */
  override canHandle(data: unknown): boolean {
    if (data === undefined || data === null) {
      return false;
    }
    
    // 如果是字符串，尝试验证是否为有效的JSON
    if (typeof data === 'string') {
      try {
        JSON.parse(data);
        return true;
      } catch {
        // 不是有效的JSON字符串
        return false;
      }
    }
    
    // 如果是对象，检查是否为有效的JSON对象
    return typeof data === 'object';
  }

  /**
   * 从错误对象中提取错误位置信息
   */
  private extractErrorLocation(error: Error): { line: number; column: number } | undefined {
    // 尝试从错误消息中提取行号和列号信息
    // 不同环境的错误消息格式可能不同
    const match = error.message.match(/at position (\d+)/i) || error.message.match(/line (\d+), column (\d+)/i);
    
    if (match) {
      if (match.length === 2) {
        // 只提取了位置信息，估算行号和列号
        const position = parseInt(match[1], 10);
        return {
          line: Math.floor(position / 80) + 1,
          column: (position % 80) + 1
        };
      } else if (match.length === 3) {
        // 提取了行号和列号
        return {
          line: parseInt(match[1], 10),
          column: parseInt(match[2], 10)
        };
      }
    }
    
    return undefined;
  }
}

/**
 * 数据转换器注册表
 * 用于管理和获取不同类型的转换器
 */
export class TransformerRegistry {
  private static instance: TransformerRegistry;
  private transformers: Map<DataType, DataTransformer<any, any>> = new Map();

  /**
   * 私有构造函数（单例模式）
   */
  private constructor() {
    // 初始化默认转换器
    this.registerDefaultTransformers();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): TransformerRegistry {
    if (!TransformerRegistry.instance) {
      TransformerRegistry.instance = new TransformerRegistry();
    }
    return TransformerRegistry.instance;
  }

  /**
   * 注册默认转换器
   */
  private registerDefaultTransformers(): void {
    // 注册JSON数据转换器
    this.registerTransformer(new JsonDataTransformer());
    
    // 可以在这里注册其他数据类型的转换器
  }

  /**
   * 注册新的转换器
   */
  public registerTransformer(transformer: DataTransformer<any, any>): void {
    const dataType = transformer.getSupportedDataType();
    this.transformers.set(dataType, transformer);
    
    console.log(`已注册转换器: ${transformer.getTransformerId()} (版本: ${transformer.getVersion()}) 用于数据类型: ${dataType}`);
  }

  /**
   * 获取指定数据类型的转换器
   */
  public getTransformer<T, U>(dataType: DataType): DataTransformer<T, U> | undefined {
    return this.transformers.get(dataType) as DataTransformer<T, U> | undefined;
  }

  /**
   * 获取所有已注册的转换器
   */
  public getAllTransformers(): Array<DataTransformer<any, any>> {
    return Array.from(this.transformers.values());
  }

  /**
   * 获取支持的数据类型列表
   */
  public getSupportedDataTypes(): DataType[] {
    return Array.from(this.transformers.keys());
  }

  /**
   * 检查是否支持指定的数据类型
   */
  public supportsDataType(dataType: DataType): boolean {
    return this.transformers.has(dataType);
  }
}

/**
 * 数据转换管理器
 * 提供统一的数据转换入口，处理不同数据类型的转换逻辑
 */
export class DataTransformationManager {
  private readonly registry: TransformerRegistry;
  private stateManager: StateManager | null = null;

  /**
   * 构造函数
   */
  constructor(registry?: TransformerRegistry) {
    this.registry = registry || TransformerRegistry.getInstance();
  }

  /**
   * 设置状态管理器
   * @param manager 状态管理器实例
   */
  setStatusManager(manager: StateManager): void {
    this.stateManager = manager;
  }

  /**
   * 获取状态管理器
   */
  getStatusManager(): StateManager | null {
    return this.stateManager;
  }

  /**
   * 检查是否可以安全地执行转换
   * @returns 是否可以执行转换
   */
  private canSafelyTransform(): boolean {
    if (!this.stateManager) {
      return true; // 如果没有状态管理器，则默认为可以执行转换
    }
    
    const currentState = this.stateManager.getCurrentState();
    // 只有在ALL_SYNCED或相应的DIRTY状态下才能执行转换
    return currentState === SystemState.ALL_SYNCED ||
           currentState === SystemState.BLOCKLY_DIRTY ||
           currentState === SystemState.MONACO_DIRTY;
  }

  /**
   * 触发状态转换
   * @param targetState 目标状态
   * @returns 是否转换成功
   */
  private triggerStateTransition(targetState: SystemState): boolean {
    if (!this.stateManager) {
      return true; // 如果没有状态管理器，则默认为转换成功
    }
    
    return this.stateManager.tryTransition(targetState);
  }

  /**
   * 从Blockly格式转换为Monaco格式
   */
  async transformFromBlocklyToMonaco<T, U>(
    data: T,
    dataType: DataType,
    context?: TransformationContext
  ): Promise<TransformationResult<U>> {
    // 检查是否可以安全地执行转换
    if (!this.canSafelyTransform()) {
      return {
        success: false,
        error: {
          code: 'TRANSFORM_NOT_ALLOWED',
          message: '当前系统状态不允许执行转换操作'
        },
        stats: {
          durationMs: 0
        }
      } as TransformationResult<U>;
    }

    // 获取适合的数据类型转换器
    const transformer = this.registry.getTransformer<T, U>(dataType);
    
    if (!transformer) {
      return {
        success: false,
        error: {
          code: 'TRANSFORMER_NOT_FOUND',
          message: `未找到数据类型 ${dataType} 的转换器`
        },
        stats: {
          durationMs: 0
        }
      } as TransformationResult<U>;
    }

    // 检查数据是否可处理
    if (!transformer.canHandle(data)) {
      return {
        success: false,
        error: {
          code: 'DATA_NOT_HANDLEABLE',
          message: `转换器无法处理提供的数据`
        },
        stats: {
          durationMs: 0
        }
      } as TransformationResult<U>;
    }

    // 尝试进入同步处理状态
    const enteredProcessingState = this.triggerStateTransition(SystemState.SYNC_PROCESSING);
    if (!enteredProcessingState) {
      return {
        success: false,
        error: {
          code: 'STATE_TRANSITION_FAILED',
          message: '无法进入同步处理状态'
        },
        stats: {
          durationMs: 0
        }
      } as TransformationResult<U>;
    }

    try {
      // 执行转换
      const result = await transformer.fromBlocklyToMonaco(data, context);
      
      // 根据转换结果更新系统状态
      if (result.success) {
        // 转换成功，尝试进入ALL_SYNCED状态
        this.triggerStateTransition(SystemState.ALL_SYNCED);
      } else {
        // 转换失败，回到之前的DIRTY状态
        this.handleTransformationError(SystemState.BLOCKLY_DIRTY, result.error?.message || '转换失败', result.error?.code as ErrorType | undefined);
      }
      
      return result;
    } catch (error) {
      // 捕获执行过程中的任何异常
      console.error('转换过程发生异常:', error);
      
      // 异常情况下，回到之前的DIRTY状态
      this.handleTransformationError(SystemState.BLOCKLY_DIRTY, error instanceof Error ? error.message : '转换过程发生异常');
      
      // 返回异常信息
      return {
        success: false,
        error: {
          code: 'TRANSFORMATION_EXCEPTION',
          message: error instanceof Error ? error.message : '转换过程发生异常',
          originalError: error instanceof Error ? error : undefined
        },
        stats: {
          durationMs: 0
        }
      } as TransformationResult<U>;
    }
  }

  /**
   * 处理转换错误
   * @param originalDirtyState 原始DIRTY状态
   * @param errorMessage 错误消息
   * @param errorCode 错误代码
   */
  private handleTransformationError(
    originalDirtyState: typeof SystemState.BLOCKLY_DIRTY | typeof SystemState.MONACO_DIRTY,
    errorMessage: string,
    errorCode?: ErrorType
  ): void {
    if (!this.stateManager) {
      return;
    }
    
    // 尝试直接调用状态管理器的handleSyncFailed方法
    // 注意：这依赖于状态管理器的具体实现
    if (this.stateManager instanceof JsonStateManager) {
      this.stateManager.handleSyncFailed(errorMessage, errorCode);
    } else {
      // 如果不是JsonStateManager实例，则使用通用的状态转换方法
      this.triggerStateTransition(originalDirtyState);
    }
  }

  /**
   * 从Monaco格式转换为Blockly格式
   */
  async transformFromMonacoToBlockly<T, U>(
    data: U,
    dataType: DataType,
    context?: TransformationContext
  ): Promise<TransformationResult<T>> {
    // 检查是否可以安全地执行转换
    if (!this.canSafelyTransform()) {
      return {
        success: false,
        error: {
          code: 'TRANSFORM_NOT_ALLOWED',
          message: '当前系统状态不允许执行转换操作'
        },
        stats: {
          durationMs: 0
        }
      } as TransformationResult<T>;
    }

    // 获取适合的数据类型转换器
    const transformer = this.registry.getTransformer<T, U>(dataType);
    
    if (!transformer) {
      return {
        success: false,
        error: {
          code: 'TRANSFORMER_NOT_FOUND',
          message: `未找到数据类型 ${dataType} 的转换器`
        },
        stats: {
          durationMs: 0
        }
      } as TransformationResult<T>;
    }

    // 检查数据是否可处理
    if (!transformer.canHandle(data)) {
      return {
        success: false,
        error: {
          code: 'DATA_NOT_HANDLEABLE',
          message: `转换器无法处理提供的数据`
        },
        stats: {
          durationMs: 0
        }
      } as TransformationResult<T>;
    }

    // 尝试进入同步处理状态
    const enteredProcessingState = this.triggerStateTransition(SystemState.SYNC_PROCESSING);
    if (!enteredProcessingState) {
      return {
        success: false,
        error: {
          code: 'STATE_TRANSITION_FAILED',
          message: '无法进入同步处理状态'
        },
        stats: {
          durationMs: 0
        }
      } as TransformationResult<T>;
    }

    // 执行转换
    const result = await transformer.fromMonacoToBlockly(data, context);
    
    // 根据转换结果更新系统状态
    if (result.success) {
      this.triggerStateTransition(SystemState.ALL_SYNCED);
    } else {
      // 转换失败，回到之前的DIRTY状态
      this.triggerStateTransition(SystemState.MONACO_DIRTY);
    }
    
    return result;
  }

  /**
   * 注册新的转换器
   */
  registerTransformer(transformer: DataTransformer<any, any>): void {
    this.registry.registerTransformer(transformer);
  }

  /**
   * 获取支持的数据类型列表
   */
  getSupportedDataTypes(): DataType[] {
    return this.registry.getSupportedDataTypes();
  }

  /**
   * 检查是否支持指定的数据类型
   */
  supportsDataType(dataType: DataType): boolean {
    return this.registry.supportsDataType(dataType);
  }
}

/**
 * 创建数据转换管理器实例的工厂函数
 */
export function createDataTransformationManager(): DataTransformationManager {
  return new DataTransformationManager();
}

/**
 * 创建JSON数据转换器实例的工厂函数
 */
export function createJsonDataTransformer(): DataTransformer<Record<string, any>, string> {
  return new JsonDataTransformer();
}

/**
 * 全局数据转换管理器实例
 */
export const globalTransformationManager = createDataTransformationManager();