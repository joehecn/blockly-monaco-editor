/**
 * 数据转换模块契约实现
 * 定义了在 Blockly 编辑器与 Monaco 编辑器之间进行数据转换的核心接口和类型
 */

/**
 * 支持的数据类型常量
 */
export const DataType = {
  JSON: 'JSON',
  EXPRESSION: 'EXPRESSION',
  TYPESCRIPT: 'TYPESCRIPT'
} as const;

export type DataType = typeof DataType[keyof typeof DataType];

/**
 * 转换错误接口
 * 封装了数据转换过程中的错误信息
 */
export interface TransformationError {
  /** 错误代码 */
  code: string;
  
  /** 错误消息 */
  message: string;
  
  /** 错误发生的位置信息 */
  location?: {
    line: number;
    column: number;
  };
  
  /** 原始错误对象 */
  originalError?: Error;
}

/**
 * 转换统计信息
 * 记录转换过程中的一些统计数据
 */
export interface TransformationStats {
  /** 转换耗时（毫秒） */
  durationMs: number;
  
  /** 转换的数据量大小（字节） */
  dataSizeBytes?: number;
  
  /** 转换后的结果大小（字节） */
  resultSizeBytes?: number;
  
  /** 转换步骤数量 */
  steps?: number;
  
  /** 重试次数 */
  retryCount?: number;
  
  /** 错误数量 */
  errorCount?: number;
  
  /** 错误代码 */
  errorCode?: string;
}

/**
 * 转换结果接口
 * 封装了数据转换操作的结果信息
 */
export interface TransformationResult<T> {
  /** 转换是否成功 */
  success: boolean;
  
  /** 转换结果数据（如果成功） */
  result?: T;
  
  /** 转换错误信息（如果失败） */
  error?: TransformationError;
  
  /** 转换统计信息 */
  stats?: TransformationStats;
}

/**
 * 转换上下文接口
 * 提供转换过程中可能需要的上下文信息
 */
export interface TransformationContext {
  /** 当前数据类型 */
  dataType?: DataType;
  
  /** 转换配置选项 */
  options?: {
    /** 是否进行语法校验 */
    validate?: boolean;
    
    /** 是否进行格式化 */
    format?: boolean;
    
    /** 缩进设置 */
    indentSize?: number;
    
    /** 最大行长度限制 */
    maxLineLength?: number;
    
    /** 是否启用代码折叠 */
    enableFolding?: boolean;
    
    /** 重试配置 */
    retry?: {
      /** 最大重试次数 */
      maxRetries?: number;
      
      /** 重试间隔（毫秒） */
      retryInterval?: number;
    };
    
    /** 是否启用调试日志 */
    debug?: boolean;
  };
}

/**
 * 数据转换器接口
 * 定义了数据转换器的核心能力
 */
export interface DataTransformer<T, U> {
  /**
   * 从 Blockly 格式转换为 Monaco 格式
   * @param data Blockly 格式的数据
   * @param context 转换上下文
   * @returns 转换结果
   */
  fromBlocklyToMonaco(data: T, context?: TransformationContext): Promise<TransformationResult<U>>;
  
  /**
   * 从 Monaco 格式转换为 Blockly 格式
   * @param data Monaco 格式的数据
   * @param context 转换上下文
   * @returns 转换结果
   */
  fromMonacoToBlockly(data: U, context?: TransformationContext): Promise<TransformationResult<T>>;
  
  /**
   * 验证数据是否可以被当前转换器处理
   * @param data 待验证的数据
   * @returns 是否可以处理
   */
  canHandle(data: unknown): boolean;
  
  /**
   * 获取当前转换器支持的数据类型
   * @returns 支持的数据类型
   */
  getSupportedDataType(): DataType;
  
  /**
   * 获取转换器的唯一标识符
   * @returns 转换器ID
   */
  getTransformerId(): string;
  
  /**
   * 获取转换器的版本信息
   * @returns 版本号
   */
  getVersion(): string;
}