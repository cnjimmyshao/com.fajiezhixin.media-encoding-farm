/**
 * @file 任务调度器
 * @description 循环检查并执行待处理的转码任务
 */
import { setTimeout as delay } from 'node:timers/promises';
import {
  getNextQueuedJob,
  hasRunningJob,
  updateJob
} from './controllers/jobs.mjs';
import { probeDuration, runJob } from './services/ffmpeg-runner.mjs';
import {
  createJobLog,
  logJobInput,
  persistJobLog
} from './services/job-log.mjs';
import { prepareJobInput } from './services/remote-input.mjs';

async function schedulerLoop(config) {
  while (true) {
    try {
      if (await hasRunningJob()) {
        await delay(config.scheduler.loopInterval);
        continue;
      }
      const job = await getNextQueuedJob();
      if (!job) {
        await delay(config.scheduler.loopInterval);
        continue;
      }
      const jobLog = createJobLog(job.output_path);
      logJobInput(jobLog, job, { source: 'scheduler' });
      let prepared;
      try {
        prepared = await prepareJobInput(job, config, jobLog);
      } catch (error) {
        await updateJob(job.id, {
          status: 'failed',
          error_msg: `下载输入文件失败: ${error?.message ?? '未知错误'}`
        });
        await persistJobLog(jobLog, job.output_path);
        continue;
      }
      const { job: preparedJob, cleanup } = prepared;
      try {
        const duration = await probeDuration(
          config.ffmpeg.ffprobe,
          preparedJob.input_path,
          jobLog
        );
        if (duration === null) {
          await updateJob(job.id, {
            status: 'failed',
            error_msg: '无法通过 ffprobe 获取媒体时长'
          });
          await persistJobLog(jobLog, job.output_path);
          continue;
        }
        await runJob(preparedJob, duration, config, jobLog);
      } finally {
        await cleanup();
      }
    } catch (error) {
      console.error('调度器异常', error);
    }
    await delay(config.scheduler.loopInterval);
  }
}

export function startScheduler(config) {
  console.log('任务调度器已启动');
  schedulerLoop(config);
}
