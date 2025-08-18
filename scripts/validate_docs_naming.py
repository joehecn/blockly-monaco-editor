#!/usr/bin/env python3
"""
文档文件名验证脚本
用于检查docs目录下的文件是否符合命名规范
命名规范: ^(META|ARCH|SPEC|IMPL|QA)-[A-Za-z]+-[A-Za-z]+\.md$
"""
import re
import os
import sys

# 定义文档目录路径
docs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'docs')

# 定义文件名验证模式
pattern = r'^(META|ARCH|SPEC|IMPL|QA)-[A-Za-z]+-[A-Za-z]+\.md$'

# 重定向文件列表（这些文件不需要遵循命名规范）
redirect_files = [
    '00-document-meta.md',
    '01-core-principles.md',
    '02-system-architecture.md',
    '02b-state-machine-specification.md',
    '03-contracts.md',
    '04-testing-architecture.md',
    '05-implementation-plan.md',
    '06-json-example.md',
    '文档导航.md',
    '模块化说明方案.md'
]

def validate_filename(name):
    """验证文件名是否符合规范"""
    return bool(re.match(pattern, name))

def main():
    """主函数，检查docs目录下的所有文件"""
    print("开始验证文档文件名规范...")
    print(f"文档目录: {docs_dir}")
    print(f"验证模式: {pattern}")
    
    # 统计信息
    total_files = 0
    valid_files = 0
    invalid_files = []
    
    # 遍历docs目录
    if not os.path.exists(docs_dir):
        print(f"错误: 文档目录 {docs_dir} 不存在")
        sys.exit(1)
    
    for filename in os.listdir(docs_dir):
        # 跳过目录
        if os.path.isdir(os.path.join(docs_dir, filename)):
            continue
        
        total_files += 1
        
        # 跳过重定向文件
        if filename in redirect_files:
            print(f"跳过重定向文件: {filename}")
            continue
        
        # 验证文件名
        if validate_filename(filename):
            valid_files += 1
            print(f"✓ 有效: {filename}")
        else:
            invalid_files.append(filename)
            print(f"✗ 无效: {filename}")
    
    # 输出结果
    print("\n验证结果:")
    print(f"总文件数: {total_files}")
    print(f"有效文件数: {valid_files}")
    print(f"无效文件数: {len(invalid_files)}")
    
    if invalid_files:
        print("\n无效文件列表:")
        for filename in invalid_files:
            print(f"- {filename}")
        print("\n错误: 发现不符合命名规范的文件")
        sys.exit(1)
    else:
        print("\n成功: 所有文件都符合命名规范")
        sys.exit(0)

if __name__ == "__main__":
    main()