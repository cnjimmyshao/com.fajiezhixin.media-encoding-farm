#!/usr/bin/env node

/**
 * @file 创建编码任务示例
 * @description 演示如何使用 Node.js 创建视频编码任务
 */

const API_BASE = 'http://localhost:3000/api';

/**
 * 创建编码任务
 */
async function createJob(jobConfig) {
  try {
    const response = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jobConfig),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API 错误: ${error.error}`);
    }

    return await response.json();
  } catch (error) {
    console.error('创建任务失败:', error.message);
    throw error;
  }
}

/**
 * 监控任务进度
 */
async function monitorJob(jobId, interval = 1000) {
  return new Promise((resolve, reject) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/jobs/${jobId}`);
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(`API 错误: ${error.error}`);
        }

        const job = await response.json();
        const progressBar = '█'.repeat(Math.floor(job.progress / 5)) + 
                           '░'.repeat(20 - Math.floor(job.progress / 5));
        
        process.stdout.write(
          `\r[${progressBar}] ${job.progress}% | 状态: ${job.status}`
        );

        if (job.status === 'success') {
          console.log('\n✅ 任务完成!');
          console.log('编码指标:', JSON.stringify(job.metrics, null, 2));
          resolve(job);
        } else if (job.status === 'failed') {
          console.log(`\n❌ 任务失败: ${job.error_msg}`);
          reject(new Error(job.error_msg));
        } else {
          setTimeout(checkStatus, interval);
        }
      } catch (error) {
        console.error('\n监控失败:', error.message);
        reject(error);
      }
    };

    checkStatus();
  });
}

/**
 * 主函数
 */
async function main() {
  console.log('🎬 视频编码农场 - 创建任务示例\n');

  // 示例 1: 基础 CRF 编码
  console.log('示例 1: 创建 H.264 CRF 编码任务');
  const crfJob = await createJob({
    inputPath: '/media/sample.mp4',
    outputPath: '/media/output-crf.mp4',
    codec: 'h264',
    impl: 'ffmpeg',
    params: {
      qualityMode: 'crf',
      crf: 23,
      scale: 'source'
    }
  });
  console.log('任务 ID:', crfJob.id);
  await monitorJob(crfJob.id);

  console.log('\n' + '='.repeat(50) + '\n');

  // 示例 2: VMAF 调优编码
  console.log('示例 2: 创建 H.265 VMAF 调优任务');
  const vmafJob = await createJob({
    inputPath: '/media/sample.mp4',
    outputPath: '/media/output-vmaf.mp4',
    codec: 'h265',
    impl: 'ffmpeg',
    params: {
      qualityMode: 'bitrate',
      bitrateKbps: 2000,
      scale: '1080p',
      enableVmaf: true,
      vmafMin: 85,
      vmafMax: 95
    }
  });
  console.log('任务 ID:', vmafJob.id);
  await monitorJob(vmafJob.id);

  console.log('\n✨ 所有示例完成!');
}

// 运行主函数
main().catch(error => {
  console.error('运行失败:', error);
  process.exit(1);
});
