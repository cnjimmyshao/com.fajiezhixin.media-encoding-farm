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
  logCommandError,
  persistJobLog
} from './services/job-log.mjs';
import { prepareJobInput } from './services/remote-input.mjs';
import logger from './services/logger.mjs';

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
      logger.info(`开始处理任务 #${job.id}`);
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
        logCommandError(jobLog, {
          command: 'prepareJobInput',
          message: `下载输入文件失败: ${error?.message ?? '未知错误'}`,
          error: error?.stack ?? String(error),
          context: 'prepareJobInput'
        });
        await persistJobLog(jobLog, job.output_path);
        continue;
      }
      try {
        const duration = await probeDuration(
          config.ffmpeg.ffprobe,
          prepared.job.input_path
        );
        if (duration === null) {
          await updateJob(job.id, {
            status: 'failed',
            error_msg: '无法通过 ffprobe 获取媒体时长'
          });
          logCommandError(jobLog, {
            command: 'ffprobe',
            message: '无法通过 ffprobe 获取媒体时长',
            context: 'probeDuration'
          });
          await persistJobLog(jobLog, job.output_path);
          continue;
        }
        logger.info(`任务 #${job.id} - 时长: ${duration.toFixed(2)}s, 开始编码`);
        await runJob(prepared.job, duration, config);
        logger.info(`任务 #${job.id} 编码完成`);
      } catch (error) {
        logger.error(`任务 #${job.id} 执行失败:`, error);
        await updateJob(job.id, {
          status: 'failed',
          error_msg: `FFmpeg 任务执行失败: ${error?.message ?? '未知错误'}`
        });
        logCommandError(jobLog, {
          command: 'ffmpeg',
          message: `FFmpeg 任务执行失败: ${error?.message ?? '未知错误'}`,
          error: error?.stack ?? String(error),
          context: 'runJob'
        });
      } finally {
        if (prepared?.cleanup) {
          await prepared.cleanup();
        }
      }
    } catch (error) {
      logger.error('调度器异常', error);
    }
    await delay(config.scheduler.loopInterval);
  }
}

export function startScheduler(config) {
  logger.info('任务调度器已启动');
  schedulerLoop(config);
}
