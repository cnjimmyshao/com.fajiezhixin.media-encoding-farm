#!/usr/bin/env node

/**
 * @file 监控任务示例
 * @description 演示如何监控特定任务的状态和进度
 */

const API_BASE = 'http://localhost:3000/api';

/**
 * 获取任务详情
 */
async function getJob(jobId) {
  try {
    const response = await fetch(`${API_BASE}/jobs/${jobId}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API 错误: ${error.error}`);
    }

    return await response.json();
  } catch (error) {
    console.error('获取任务失败:', error.message);
    throw error;
  }
}

/**
 * 格式化时间
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 1) return 'N/A';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (!bytes) return 'N/A';
  
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 格式化码率
 */
function formatBitrate(bps) {
  if (!bps) return 'N/A';
  
  const mbps = bps / 1000000;
  return `${mbps.toFixed(2)} Mbps`;
}

/**
 * 显示任务信息
 */
function displayJobInfo(job) {
  console.log('\n📋 任务信息');
  console.log('='.repeat(50));
  console.log(`ID: ${job.id}`);
  console.log(`状态: ${job.status}`);
  console.log(`进度: ${job.progress}%`);
  console.log(`编码器: ${job.codec} (${job.impl})`);
  console.log(`输入: ${job.input_path}`);
  console.log(`输出: ${job.output_path}`);
  console.log(`创建时间: ${new Date(job.created_at).toLocaleString()}`);
  
  if (job.updated_at !== job.created_at) {
    console.log(`更新时间: ${new Date(job.updated_at).toLocaleString()}`);
  }
  
  if (job.error_msg) {
    console.log(`错误信息: ${job.error_msg}`);
  }
  
  console.log('\n⚙️  编码参数');
  console.log('='.repeat(50));
  console.log(JSON.stringify(job.params, null, 2));
  
  if (job.metrics) {
    console.log('\n📊 编码指标');
    console.log('='.repeat(50));
    console.log(`视频时长: ${formatDuration(job.metrics.duration)}`);
    console.log(`输出码率: ${formatBitrate(job.metrics.bitrate)}`);
    console.log(`VMAF 分数: ${job.metrics.vmafScore || 'N/A'}`);
    console.log(`文件大小: ${formatFileSize(job.metrics.fileSize)}`);
    console.log(`编码耗时: ${formatDuration(job.metrics.encodingTime)}`);
    
    if (job.metrics.encodingTime && job.metrics.duration) {
      const speed = job.metrics.duration / job.metrics.encodingTime;
      console.log(`编码速度: ${speed.toFixed(2)}x 实时`);
    }
  }
}

/**
 * 监控任务进度
 */
async function monitorJob(jobId, interval = 1000) {
  console.log(`🔍 开始监控任务: ${jobId}\n`);
  
  return new Promise((resolve, reject) => {
    let lastProgress = -1;
    let startTime = Date.now();
    
    const checkStatus = async () => {
      try {
        const job = await getJob(jobId);
        
        // 只在进度变化时更新显示
        if (job.progress !== lastProgress) {
          lastProgress = job.progress;
          
          const elapsed = (Date.now() - startTime) / 1000;
          const progressBar = '█'.repeat(Math.floor(job.progress / 5)) + 
                             '░'.repeat(20 - Math.floor(job.progress / 5));
          
          process.stdout.write(
            `\r[${progressBar}] ${job.progress}% | 状态: ${job.status} | 已运行: ${formatDuration(elapsed)}`
          );
        }

        if (job.status === 'success') {
          console.log('\n\n✅ 任务完成!');
          displayJobInfo(job);
          resolve(job);
        } else if (job.status === 'failed') {
          console.log('\n\n❌ 任务失败!');
          displayJobInfo(job);
          reject(new Error(job.error_msg));
        } else if (job.status === 'canceled') {
          console.log('\n\n⚠️  任务已取消!');
          displayJobInfo(job);
          resolve(job);
        } else {
          setTimeout(checkStatus, interval);
        }
      } catch (error) {
        console.error('\n\n监控失败:', error.message);
        reject(error);
      }
    };

    checkStatus();
  });
}

/**
 * 列出所有任务
 */
async function listJobs(status) {
  const url = new URL(`${API_BASE}/jobs`);
  if (status) {
    url.searchParams.set('status', status);
  }
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API 错误: ${error.error}`);
    }

    const data = await response.json();
    return data.items;
  } catch (error) {
    console.error('获取任务列表失败:', error.message);
    throw error;
  }
}

/**
 * 显示任务列表
 */
async function displayJobList(status) {
  console.log(`📋 任务列表${status ? ` (${status})` : ''}`);
  console.log('='.repeat(80));
  
  const jobs = await listJobs(status);
  
  if (jobs.length === 0) {
    console.log('暂无任务');
    return;
  }
  
  // 表头
  console.log(
    `${'ID'.padEnd(36)} | ${'状态'.padEnd(10)} | ${'进度'.padEnd(6)} | ${'编码器'.padEnd(10)} | 创建时间`
  );
  console.log('-'.repeat(80));
  
  // 任务列表
  for (const job of jobs) {
    const id = job.id.substring(0, 36);
    const status = job.status.padEnd(10);
    const progress = `${job.progress}%`.padEnd(6);
    const codec = `${job.codec}`.padEnd(10);
    const created = new Date(job.created_at).toLocaleString();
    
    console.log(`${id} | ${status} | ${progress} | ${codec} | ${created}`);
  }
  
  console.log(`\n总计: ${jobs.length} 个任务`);
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🎬 视频编码农场 - 任务监控工具\n');
    console.log('用法:');
    console.log('  monitor-job <job-id>     监控特定任务');
    console.log('  monitor-job --list       列出所有任务');
    console.log('  monitor-job --list running 列出运行中的任务');
    console.log('\n示例:');
    console.log('  monitor-job 550e8400-e29b-41d4-a716-446655440000');
    console.log('  monitor-job --list');
    console.log('  monitor-job --list failed');
    return;
  }
  
  const command = args[0];
  
  if (command === '--list') {
    const status = args[1];
    await displayJobList(status);
  } else {
    // 假设是 job ID
    const jobId = command;
    await monitorJob(jobId);
  }
}

// 运行主函数
main().catch(error => {
  console.error('运行失败:', error);
  process.exit(1);
});
