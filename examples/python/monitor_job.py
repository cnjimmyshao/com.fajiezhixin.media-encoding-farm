#!/usr/bin/env python3

"""
@file 监控任务示例
@description 演示如何监控特定任务的状态和进度
"""

import requests
import json
import sys
import time
from datetime import datetime

API_BASE = 'http://localhost:3000/api'


def get_job(job_id):
    """获取任务详情"""
    try:
        response = requests.get(f'{API_BASE}/jobs/{job_id}', timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'获取任务失败: {e}')
        if hasattr(e.response, 'json'):
            error = e.response.json()
            print(f"错误详情: {error.get('error', '未知错误')}")
        sys.exit(1)


def format_duration(seconds):
    """格式化时长"""
    if not seconds or seconds < 1:
        return 'N/A'
    
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f'{hours}h {minutes}m {secs}s'
    elif minutes > 0:
        return f'{minutes}m {secs}s'
    else:
        return f'{secs}s'


def format_file_size(bytes):
    """格式化文件大小"""
    if not bytes:
        return 'N/A'
    
    sizes = ['B', 'KB', 'MB', 'GB']
    i = 0
    while bytes >= 1024 and i < len(sizes) - 1:
        bytes /= 1024
        i += 1
    return f'{bytes:.2f} {sizes[i]}'


def format_bitrate(bps):
    """格式化码率"""
    if not bps:
        return 'N/A'
    
    mbps = bps / 1000000
    return f'{mbps:.2f} Mbps'


def display_job_info(job):
    """显示任务详细信息"""
    print('\n📋 任务信息')
    print('='*50)
    print(f"ID: {job['id']}")
    print(f"状态: {job['status']}")
    print(f"进度: {job['progress']}%")
    print(f"编码器: {job['codec']} ({job['impl']})")
    print(f"输入: {job['input_path']}")
    print(f"输出: {job['output_path']}")
    print(f"创建时间: {datetime.fromisoformat(job['created_at']).strftime('%Y-%m-%d %H:%M:%S')}")
    
    if job['updated_at'] != job['created_at']:
        print(f"更新时间: {datetime.fromisoformat(job['updated_at']).strftime('%Y-%m-%d %H:%M:%S')}")
    
    if job.get('error_msg'):
        print(f"错误信息: {job['error_msg']}")
    
    print('\n⚙️  编码参数')
    print('='*50)
    print(json.dumps(job['params'], indent=2, ensure_ascii=False))
    
    if job.get('metrics'):
        print('\n📊 编码指标')
        print('='*50)
        print(f"视频时长: {format_duration(job['metrics'].get('duration'))}")
        print(f"输出码率: {format_bitrate(job['metrics'].get('bitrate'))}")
        print(f"VMAF 分数: {job['metrics'].get('vmafScore', 'N/A')}")
        print(f"文件大小: {format_file_size(job['metrics'].get('fileSize'))}")
        print(f"编码耗时: {format_duration(job['metrics'].get('encodingTime'))}")
        
        encoding_time = job['metrics'].get('encodingTime')
        duration = job['metrics'].get('duration')
        if encoding_time and duration:
            speed = duration / encoding_time
            print(f"编码速度: {speed:.2f}x 实时")


def monitor_job(job_id, interval=1.0):
    """监控任务进度"""
    print(f'🔍 开始监控任务: {job_id}\n')
    
    last_progress = -1
    start_time = time.time()
    
    while True:
        try:
            job = get_job(job_id)
            
            # 只在进度变化时更新显示
            if job['progress'] != last_progress:
                last_progress = job['progress']
                
                elapsed = time.time() - start_time
                progress_bar = '█' * (job['progress'] // 5) + \
                              '░' * (20 - job['progress'] // 5)
                
                print(f'\r[{progress_bar}] {job["progress"]}% | '
                      f'状态: {job["status"]} | 已运行: {elapsed:.1f}s', end='')
            
            if job['status'] == 'success':
                print('\n\n✅ 任务完成!')
                display_job_info(job)
                return job
            elif job['status'] == 'failed':
                print(f"\n\n❌ 任务失败: {job.get('error_msg', '未知错误')}")
                display_job_info(job)
                sys.exit(1)
            elif job['status'] == 'canceled':
                print('\n\n⚠️  任务已取消!')
                display_job_info(job)
                return job
            
            time.sleep(interval)
            
        except KeyboardInterrupt:
            print('\n\n监控已取消')
            sys.exit(0)
        except Exception as e:
            print(f'\n\n监控失败: {e}')
            sys.exit(1)


def list_jobs(status=None):
    """获取任务列表"""
    url = f'{API_BASE}/jobs'
    params = {}
    if status:
        params['status'] = status
    
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data['items']
    except requests.exceptions.RequestException as e:
        print(f'获取任务列表失败: {e}')
        sys.exit(1)


def display_job_list(status=None):
    """显示任务列表"""
    status_str = f' ({status})' if status else ''
    print(f'📋 任务列表{status_str}')
    print('='*80)
    
    jobs = list_jobs(status)
    
    if not jobs:
        print('暂无任务')
        return
    
    # 表头
    print(f"{'ID':<36} | {'状态':<10} | {'进度':<6} | {'编码器':<10} | 创建时间")
    print('-'*80)
    
    # 任务列表
    for job in jobs:
        job_id = job['id'][:36]
        job_status = job['status'][:10]
        progress = f"{job['progress']}%"
        codec = f"{job['codec']}"
        created = datetime.fromisoformat(job['created_at']).strftime('%Y-%m-%d %H:%M')
        
        print(f"{job_id} | {job_status:<10} | {progress:<6} | {codec:<10} | {created}")
    
    print(f"\n总计: {len(jobs)} 个任务")


def main():
    """主函数"""
    if len(sys.argv) < 2:
        print('🎬 视频编码农场 - Python 任务监控工具\n')
        print('用法:')
        print('  python monitor_job.py <job-id>     监控特定任务')
        print('  python monitor_job.py --list       列出所有任务')
        print('  python monitor_job.py --list running 列出运行中的任务')
        print('\n示例:')
        print('  python monitor_job.py 550e8400-e29b-41d4-a716-446655440000')
        print('  python monitor_job.py --list')
        print('  python monitor_job.py --list failed')
        return
    
    command = sys.argv[1]
    
    if command == '--list':
        status = sys.argv[2] if len(sys.argv) > 2 else None
        display_job_list(status)
    else:
        # 假设是 job ID
        job_id = command
        monitor_job(job_id)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\n\n操作已取消')
        sys.exit(0)
    except Exception as e:
        print(f'运行失败: {e}')
        sys.exit(1)
