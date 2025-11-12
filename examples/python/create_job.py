#!/usr/bin/env python3

"""
@file 创建编码任务示例
@description 演示如何使用 Python 创建视频编码任务
"""

import requests
import json
import sys

API_BASE = 'http://localhost:3000/api'


def create_job(job_config):
    """创建编码任务"""
    try:
        response = requests.post(
            f'{API_BASE}/jobs',
            headers={'Content-Type': 'application/json'},
            json=job_config,
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'创建任务失败: {e}')
        if hasattr(e.response, 'json'):
            error = e.response.json()
            print(f"错误详情: {error.get('error', '未知错误')}")
        sys.exit(1)


def monitor_job(job_id, interval=1.0):
    """监控任务进度"""
    import time
    
    print(f'🔍 开始监控任务: {job_id}\n')
    
    last_progress = -1
    start_time = time.time()
    
    while True:
        try:
            response = requests.get(f'{API_BASE}/jobs/{job_id}', timeout=10)
            response.raise_for_status()
            job = response.json()
            
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
                print(f"编码指标: {json.dumps(job.get('metrics', {}), indent=2, ensure_ascii=False)}")
                return job
            elif job['status'] == 'failed':
                print(f"\n\n❌ 任务失败: {job.get('error_msg', '未知错误')}")
                sys.exit(1)
            elif job['status'] == 'canceled':
                print('\n\n⚠️  任务已取消!')
                return job
            
            time.sleep(interval)
            
        except requests.exceptions.RequestException as e:
            print(f'\n\n监控失败: {e}')
            sys.exit(1)


def main():
    """主函数"""
    print('🎬 视频编码农场 - Python 创建任务示例\n')
    
    # 示例 1: 基础 CRF 编码
    print('示例 1: 创建 H.264 CRF 编码任务')
    crf_job = create_job({
        'inputPath': '/media/sample.mp4',
        'outputPath': '/media/output-crf.mp4',
        'codec': 'h264',
        'impl': 'ffmpeg',
        'params': {
            'qualityMode': 'crf',
            'crf': 23,
            'scale': 'source'
        }
    })
    print(f'任务 ID: {crf_job["id"]}')
    monitor_job(crf_job['id'])
    
    print('\n' + '='*50 + '\n')
    
    # 示例 2: VMAF 调优编码
    print('示例 2: 创建 H.265 VMAF 调优任务')
    vmaf_job = create_job({
        'inputPath': '/media/sample.mp4',
        'outputPath': '/media/output-vmaf.mp4',
        'codec': 'h265',
        'impl': 'ffmpeg',
        'params': {
            'qualityMode': 'bitrate',
            'bitrateKbps': 2000,
            'scale': '1080p',
            'enableVmaf': True,
            'vmafMin': 85,
            'vmafMax': 95
        }
    })
    print(f'任务 ID: {vmaf_job["id"]}')
    monitor_job(vmaf_job['id'])
    
    print('\n✨ 所有示例完成!')


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\n\n操作已取消')
        sys.exit(0)
    except Exception as e:
        print(f'运行失败: {e}')
        sys.exit(1)
