/**
 * @file FFmpeg 执行器
 * @description 调度 ffmpeg 并跟踪转码进度
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { stat } from 'node:fs/promises';
import { audioArgs, buildVideoArgs, videoPresets } from './presets.mjs';
import { updateJob } from '../controllers/jobs.mjs';

const runningChildren = new Map();

/**
 * @description 解析形如 HH:MM:SS.xx 的时间
 * @param {string} timeStr 输入字符串
 * @returns {number} 秒数
 */
function parseFfmpegTime(timeStr) {
  const [h, m, s] = timeStr.split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/**
 * @description 运行 ffprobe 获取媒体时长
 * @param {string} ffprobeBin ffprobe 路径
 * @param {string} inputPath 输入路径
 * @returns {Promise<number|null>} 秒数
 */
export async function probeDuration(ffprobeBin, inputPath) {
  const child = spawn(ffprobeBin, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    inputPath
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let stdout = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  const [code] = await once(child, 'close');
  if (code !== 0) {
    return null;
  }
  const val = parseFloat(stdout.trim());
  return Number.isFinite(val) ? val : null;
}

/**
 * @description 执行单个任务
 * @param {object} job 任务对象
 * @param {number|null} durationSec 时长
 * @param {object} config 配置
 */
export async function runJob(job, durationSec, config) {
  await updateJob(job.id, { status: 'running', progress: 0, error_msg: null });

  const ffmpegArgs = ['-y', '-i', job.input_path];
  const videoArgs = buildVideoArgs(
    job.codec,
    job.impl,
    job.params?.profile,
    job.params?.preset,
    job.params?.crf
  );
  if (videoArgs) {
    ffmpegArgs.push(...videoArgs);
  } else {
    const fallbackKeys = [];
    if (job.params?.presetKey) {
      fallbackKeys.push(job.params.presetKey);
    }
    if (job.params?.preset && job.params?.profile && job.params?.crf) {
      fallbackKeys.push(
        `${job.codec}:${job.impl}:${job.params.profile}:${job.params.preset}:${job.params.crf}`
      );
    }
    if (job.params?.profile && job.params?.crf) {
      fallbackKeys.push(`${job.codec}:${job.impl}:${job.params.profile}:${job.params.crf}`);
    }
    if (job.params?.profile) {
      fallbackKeys.push(`${job.codec}:${job.impl}:${job.params.profile}`);
    }
    fallbackKeys.push(`${job.codec}:${job.impl}:baseline`);
    const preset = fallbackKeys.map((key) => videoPresets[key]).find(Boolean);
    if (preset) {
      ffmpegArgs.push(...preset.args);
    }
  }
  if (job.params?.extraArgs && Array.isArray(job.params.extraArgs)) {
    ffmpegArgs.push(...job.params.extraArgs);
  }
  ffmpegArgs.push(...audioArgs(), job.output_path);

  const startTime = Date.now();
  const child = spawn(config.ffmpeg.bin, ffmpegArgs, {
    stdio: ['ignore', 'ignore', 'pipe']
  });
  runningChildren.set(job.id, child);

  const maxTimeoutMs = durationSec
    ? Math.max(durationSec * config.ffmpeg.timeoutFactor * 1000, 30000)
    : 0;
  let timeoutTimer;
  if (maxTimeoutMs > 0) {
    timeoutTimer = setTimeout(() => {
      child.kill('SIGKILL');
    }, maxTimeoutMs);
  }

  let lastProgress = 0;
  const rl = createInterface({ input: child.stderr });
  rl.on('line', (line) => {
    const timeMatch = /time=([0-9:.]+)/.exec(line);
    if (timeMatch && durationSec) {
      const seconds = parseFfmpegTime(timeMatch[1]);
      const progress = Math.min(99, Math.floor((seconds / durationSec) * 100));
      if (progress >= lastProgress + 1) {
        lastProgress = progress;
        updateJob(job.id, { progress }).catch((err) => {
          console.error('进度更新失败', err);
        });
      }
    }
  });

  const [code, signal] = await once(child, 'close');
  runningChildren.delete(job.id);
  rl.close();

  if (timeoutTimer) {
    clearTimeout(timeoutTimer);
  }

  if (signal === 'SIGTERM') {
    await updateJob(job.id, {
      status: 'canceled',
      error_msg: null,
      progress: lastProgress
    });
    return;
  }

  if (signal === 'SIGKILL') {
    await updateJob(job.id, {
      status: 'failed',
      error_msg: '任务执行超时并被终止',
      progress: lastProgress
    });
    return;
  }

  if (code === 0) {
    try {
      const fileStat = await stat(job.output_path);
      const encodeDurationSec = Number(((Date.now() - startTime) / 1000).toFixed(3));
      const metrics = { sizeBytes: fileStat.size, encodeDurationSec };
      if (typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0) {
        metrics.encodeEfficiency = Number((encodeDurationSec / durationSec).toFixed(3));
      }
      if (job.params?.enableVmaf) {
        try {
          const vmafStats = await computeVmafScore(
            config.ffmpeg.bin,
            job.output_path,
            job.input_path
          );
          metrics.vmafScore = Number(vmafStats.mean.toFixed(3));
          metrics.vmafMax = Number(vmafStats.max.toFixed(3));
          metrics.vmafMin = Number(vmafStats.min.toFixed(3));
        } catch (error) {
          metrics.vmafError = error.message;
        }
      }
      await updateJob(job.id, {
        status: 'success',
        progress: 100,
        metrics_json: metrics
      });
    } catch (error) {
      await updateJob(job.id, {
        status: 'failed',
        error_msg: `输出文件检查失败: ${error.message}`
      });
    }
  } else {
    await updateJob(job.id, {
      status: 'failed',
      error_msg: `ffmpeg 退出码 ${code}`,
      progress: lastProgress
    });
  }
}

/**
 * @description 终止运行中的 ffmpeg 进程
 * @param {string} jobId 任务标识
 * @returns {boolean} 是否找到并发送终止信号
 */
export function cancelRunningJob(jobId) {
  const child = runningChildren.get(jobId);
  if (child) {
    child.kill('SIGTERM');
    return true;
  }
  return false;
}

async function computeVmafScore(ffmpegBin, distortedPath, referencePath) {
  const filterGraph = '[0:v]setpts=PTS-STARTPTS[dist];[1:v]setpts=PTS-STARTPTS[ref];[dist][ref]libvmaf=model=version=vmaf_v0.6.1:log_fmt=json';
  const args = [
    '-i',
    distortedPath,
    '-i',
    referencePath,
    '-lavfi',
    filterGraph,
    '-f',
    'null',
    '-'
  ];
  const child = spawn(ffmpegBin, args, {
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  const [code] = await once(child, 'close');
  if (code !== 0) {
    throw new Error(`VMAF 计算失败，退出码 ${code}`);
  }
  const jsonStart = stderr.lastIndexOf('{"version"');
  if (jsonStart === -1) {
    throw new Error('未能解析 VMAF 结果');
  }
  const jsonSlice = stderr.slice(jsonStart);
  const jsonEnd = jsonSlice.lastIndexOf('}');
  if (jsonEnd === -1) {
    throw new Error('未能解析 VMAF 结果');
  }
  let payload;
  try {
    payload = JSON.parse(jsonSlice.slice(0, jsonEnd + 1));
  } catch (error) {
    throw new Error(`VMAF 结果 JSON 解析失败: ${error.message}`);
  }
  const aggregateScore = Number(payload?.aggregate?.vmaf);
  if (!Number.isFinite(aggregateScore)) {
    throw new Error('VMAF 结果缺少 aggregate.vmaf');
  }
  const frameScores = Array.isArray(payload?.frames)
    ? payload.frames
        .map((frame) => Number(frame?.metrics?.vmaf))
        .filter((value) => Number.isFinite(value))
    : [];
  const maxScore = frameScores.length ? Math.max(...frameScores) : aggregateScore;
  const minScore = frameScores.length ? Math.min(...frameScores) : aggregateScore;
  return {
    mean: aggregateScore,
    max: maxScore,
    min: minScore
  };
}
