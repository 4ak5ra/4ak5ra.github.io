#!/usr/bin/env python3
"""
批量重命名posts/pwn目录下的Markdown文件，并将文件内的title元数据更新为文件名中的标题。
文件名格式转换：
1. 从"YYYY-M-D-标题.md"转换为"标题-YYYY-M-D.md"
2. 如果已经是"标题-日期"格式，则跳过重命名，但仍更新内部title。
"""

import os
import re
import sys
from pathlib import Path

def parse_filename(filename):
    """
    解析文件名，返回标题和日期部分。
    支持两种格式：
    1. 日期-标题：如 "2025-2-11-计算机网络入门.md"
    2. 标题-日期：如 "pwn入门三部曲之ret2text-2025-1-2.md"
    
    返回: (title, date_str, is_date_first)
    """
    # 移除扩展名
    basename = filename[:-3]  # 假设都是.md
    # 尝试匹配日期开头：YYYY-M-D-
    date_pattern = r'^(\d{4}-\d{1,2}-\d{1,2})-(.+)$'
    match = re.match(date_pattern, basename)
    if match:
        # 格式为 日期-标题
        date_str = match.group(1)
        title = match.group(2)
        return title, date_str, True
    else:
        # 尝试匹配标题-日期格式
        # 日期部分在最后，且日期格式为 YYYY-M-D
        # 注意：标题中可能包含短横线，所以不能简单用最后一个短横线分割
        # 使用正则匹配最后一个短横线后的日期
        alt_pattern = r'^(.+)-(\d{4}-\d{1,2}-\d{1,2})$'
        match = re.match(alt_pattern, basename)
        if match:
            title = match.group(1)
            date_str = match.group(2)
            return title, date_str, False
        else:
            # 无法识别格式
            return None, None, False

def update_front_matter(content, new_title):
    """
    更新Markdown文件中的front matter的title字段。
    front matter格式：
    ---
    title: 旧标题
    tags: [...]
    ...
    ---
    """
    # 使用正则匹配front matter中的title行
    # 注意：front matter可能包含多行，我们只替换title行
    lines = content.split('\n')
    in_front_matter = False
    front_matter_end = -1
    for i, line in enumerate(lines):
        if line.strip() == '---':
            if in_front_matter:
                front_matter_end = i
                break
            else:
                in_front_matter = True
                continue
        if in_front_matter and line.startswith('title:'):
            # 找到title行，进行替换
            # 保持缩进和格式
            indent = len(line) - len(line.lstrip())
            lines[i] = ' ' * indent + f'title: {new_title}'
            break
    
    # 如果front matter中没有title，则添加（这种情况不应该发生，但以防万一）
    if in_front_matter and front_matter_end != -1:
        # 检查是否已经替换了title
        title_found = any(line.strip().startswith('title:') for line in lines[:front_matter_end])
        if not title_found:
            # 在front matter结束前插入title行
            lines.insert(front_matter_end - 1, f'title: {new_title}')
    
    return '\n'.join(lines)

def main():
    pwn_dir = Path('posts/pwn')
    if not pwn_dir.exists():
        print(f"目录不存在: {pwn_dir}")
        sys.exit(1)
    
    # 收集所有.md文件
    md_files = list(pwn_dir.glob('*.md'))
    print(f"找到 {len(md_files)} 个Markdown文件")
    
    # 用于记录重命名映射
    rename_map = {}
    
    for file in md_files:
        filename = file.name
        print(f"\n处理文件: {filename}")
        
        title, date_str, is_date_first = parse_filename(filename)
        if title is None:
            print(f"  警告：无法解析文件名格式，跳过")
            continue
        
        print(f"  标题: {title}")
        print(f"  日期: {date_str}")
        
        # 读取文件内容
        content = file.read_text(encoding='utf-8')
        
        # 更新front matter中的title
        new_content = update_front_matter(content, title)
        
        # 判断是否需要重命名
        if is_date_first:
            # 需要重命名：日期-标题 -> 标题-日期
            new_filename = f"{title}-{date_str}.md"
            new_filepath = file.parent / new_filename
            print(f"  重命名: {filename} -> {new_filename}")
            rename_map[file] = new_filepath
        else:
            # 不需要重命名，但可能内部title需要更新
            new_filepath = file
            print(f"  文件名格式已正确，无需重命名")
        
        # 写回更新后的内容（即使不需要重命名，title可能也需要更新）
        # 先写到一个临时文件，避免直接覆盖原文件
        temp_file = file.with_suffix('.tmp')
        temp_file.write_text(new_content, encoding='utf-8')
        rename_map[temp_file] = new_filepath
    
    # 确认更改
    if not rename_map:
        print("\n没有需要更改的文件")
        sys.exit(0)
    
    print(f"\n将要进行以下更改：")
    for old, new in rename_map.items():
        print(f"  {old.name} -> {new.name}")
    
    response = input("\n确认执行更改？(y/N): ")
    if response.lower() != 'y':
        print("取消操作")
        sys.exit(0)
    
    # 执行重命名和文件移动
    # 注意：由于可能有临时文件，我们需要小心处理
    # 先处理内容更新，然后重命名文件
    for old, new in rename_map.items():
        # 如果old是临时文件，则替换原文件
        if old.suffix == '.tmp':
            # 删除原文件（如果有的话）
            if new.exists():
                new.unlink()
            old.rename(new)
            print(f"  更新: {old} -> {new}")
        else:
            # 直接重命名
            if new.exists():
                print(f"  警告：目标文件已存在，跳过重命名 {old.name}")
                continue
            old.rename(new)
            print(f"  重命名: {old.name} -> {new.name}")
    
    print("\n操作完成！")

if __name__ == '__main__':
    main()