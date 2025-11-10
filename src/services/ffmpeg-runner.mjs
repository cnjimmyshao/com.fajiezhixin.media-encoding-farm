/**
 * @file FFmpeg 执行器
 * @description 调度 ffmpeg 并跟踪转码进度
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { createWriteStream } from 'node:fs';
import { stat, writeFile, mkdir, unlink } from 'node:fs/promises';
import { dirname, basename, extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { audioArgs, buildVideoArgs, videoPresets, getResolutionPreset } from './presets.mjs';
import { updateJob } from '../controllers/jobs.mjs';

const runningChildren = new Map();
const MAX_VMAF_TUNING_ATTEMPTS = 5;
const MIN_BITRATE_KBPS = 200;
const MAX_BITRATE_KBPS = 80000;
const BITRATE_INCREASE_FACTOR = 1.25;
const BITRATE_DECREASE_FACTOR = 0.85;
const HTTP_INPUT_PATTERN = /^https?:\/\//i;

function deriveRemoteInputName(job, urlString) {
  try {
    const url = new URL(urlString);
    const decoded = decodeURIComponent(url.pathname || '');
    const base = basename(decoded);
    if (base && base !== '/' && base !== '.' && base !== '..') {
      const trimmed = base.trim();
      if (!trimmed) {
        throw new Error('empty name');
      }
      if (extname(trimmed)) {
        return trimmed;
      }
      return `${trimmed}.mp4`;
    }
  } catch (error) {
    // ignore malformed URL and fall back to job based name
  }
  const fallbackBase = job?.id ? `${job.id}.mp4` : 'remote-input.mp4';
  return fallbackBase;
}

async function safeUnlink(targetPath) {
  if (!targetPath) return;
  try {
    await unlink(targetPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

function normalizeJobLog(jobLog = null, outputPath = null) {
  if (!jobLog) {
    return {
      outputPath: outputPath ?? null,
      commands: [],
      errors: [],
      vmafResults: [],
      inputs: []
    };
  }
  if (Array.isArray(jobLog)) {
    return {
      outputPath: outputPath ?? null,
      commands: jobLog,
      errors: [],
      vmafResults: [],
      inputs: []
    };
  }
  if (!Array.isArray(jobLog.commands)) {
    jobLog.commands = [];
  }
  if (!Array.isArray(jobLog.errors)) {
    jobLog.errors = [];
  }
  if (!Array.isArray(jobLog.vmafResults)) {
    jobLog.vmafResults = [];
  }
  if (!Array.isArray(jobLog.inputs)) {
    jobLog.inputs = [];
  }
  if (outputPath && !jobLog.outputPath) {
    jobLog.outputPath = outputPath;
  }
  return jobLog;
}

export function createJobLog(outputPath = null) {
  return normalizeJobLog(null, outputPath);
}

function logVmafResult(jobLog, payload) {
  if (!jobLog) return;
  const target = normalizeJobLog(jobLog);
  target.vmafResults.push({
    timestamp: new Date().toISOString(),
    ...payload
  });
}

function buildVmafContext(timeSlice = null, label = 'segment') {
  if (!timeSlice) {
    return { type: label };
  }
  return {
    type: label,
    index: timeSlice.index ?? null,
    start: timeSlice.start ?? null,
    end: timeSlice.end ?? null,
    duration: timeSlice.duration ?? null
  };
}

function formatCommand(bin, args = []) {
  const escapeArg = (arg) => {
    if (arg === undefined || arg === null) return '';
    if (/^[A-Za-z0-9-_./:@%+=,]+$/.test(arg)) {
      return arg;
    }
    return `'${String(arg).replace(/'/g, `'\\''`)}'`;
  };
  return [bin, ...args].map(escapeArg).join(' ').trim();
}

function pushCommand(jobLog, bin, args) {
  const entry = formatCommand(bin, args);
  if (!jobLog) return entry;
  if (Array.isArray(jobLog)) {
    jobLog.push(entry);
    return entry;
  }
  const target = normalizeJobLog(jobLog);
  target.commands.push(entry);
  return entry;
}

function logCommandError(jobLog, payload) {
  if (!jobLog) return;
  const target = normalizeJobLog(jobLog);
  target.errors.push({
    timestamp: new Date().toISOString(),
    ...payload
  });
}

function cloneJobParams(params = {}) {
  if (!params || typeof params !== 'object') {
    return {};
  }
  try {
    return JSON.parse(JSON.stringify(params));
  } catch (error) {
    const cloned = {};
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      cloned[key] = value;
    }
    return cloned;
  }
}

function sanitizeJobInputPayload(job) {
  if (!job || typeof job !== 'object') {
    return null;
  }
  const params = cloneJobParams(job.params);
  const payload = {
    jobId: job.id ?? null,
    inputPath: job.input_path ?? job.inputPath ?? null,
    outputPath: job.output_path ?? job.outputPath ?? null,
    codec: job.codec ?? null,
    impl: job.impl ?? null,
    params
  };
  return payload;
}

export function logJobInput(jobLog, job, options = {}) {
  if (!jobLog) return;
  const payload = sanitizeJobInputPayload(job);
  if (!payload) {
    return;
  }
  const target = normalizeJobLog(jobLog);
  target.inputs.push({
    timestamp: new Date().toISOString(),
    source: options.source ?? 'request',
    payload
  });
}

export async function prepareJobInput(job, config, jobLog = null) {
  if (!job || !job.input_path || !HTTP_INPUT_PATTERN.test(job.input_path)) {
    return { job, cleanup: async () => {} };
  }
  const workspace = config?.paths?.workspace ?? '/tmp/vef';
  const downloadsDir = join(workspace, 'downloads');
  await mkdir(downloadsDir, { recursive: true });
  const remoteName = deriveRemoteInputName(job, job.input_path);
  const localPath = join(downloadsDir, `${job.id ?? 'job'}-${remoteName}`);
  const commandEntry = pushCommand(jobLog, 'download', [job.input_path, localPath]);

  try {
    const response = await fetch(job.input_path);
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }
    await pipeline(response.body, createWriteStream(localPath));
  } catch (error) {
    logCommandError(jobLog, {
      command: commandEntry,
      message: error?.message ?? '下载输入文件失败',
      context: 'download_input'
    });
    await safeUnlink(localPath);
    throw error;
  }

  const preparedJob = {
    ...job,
    input_path: localPath,
    original_input_path: job.original_input_path ?? job.input_path
  };

  return {
    job: preparedJob,
    cleanup: async () => {
      await safeUnlink(localPath);
    }
  };
}

export async function persistJobLog(jobLog, fallbackOutputPath = null) {
  if (!jobLog) return;
  const normalized = normalizeJobLog(jobLog, fallbackOutputPath);
  const outputPath = normalized.outputPath ?? fallbackOutputPath;
  if (!outputPath) {
    return;
  }
  try {
    await mkdir(dirname(outputPath), { recursive: true });
  } catch (error) {
    if (error?.code !== 'EEXIST') {
      throw error;
    }
  }
  const commands = Array.isArray(normalized.commands) ? normalized.commands : [];
  const errors = Array.isArray(normalized.errors) ? normalized.errors : [];
  const vmafResults = Array.isArray(normalized.vmafResults) ? normalized.vmafResults : [];
  const inputs = Array.isArray(normalized.inputs) ? normalized.inputs : [];

  if (commands.length) {
    const commandLogPath = `${outputPath}.commands.log`;
    await writeFile(commandLogPath, commands.join('\n'), 'utf8');
  }

  if (!commands.length && !vmafResults.length && !errors.length && !inputs.length) {
    return;
  }

  const lines = [];
  lines.push('# Job Execution Log');
  lines.push(`generated_at: ${new Date().toISOString()}`);
  lines.push('');

  if (inputs.length) {
    lines.push('## User Inputs');
    for (const entry of inputs) {
      const parts = [];
      if (entry.source) parts.push(`source=${entry.source}`);
      if (entry.payload?.jobId) parts.push(`job_id=${entry.payload.jobId}`);
      const detail = parts.length ? ` ${parts.join(', ')}` : '';
      lines.push(`- [${entry.timestamp}]${detail}`);
      const serialized = JSON.stringify(entry.payload ?? {}, null, 2);
      const serializedLines = serialized.split('\n');
      for (const line of serializedLines) {
        lines.push(`  ${line}`);
      }
    }
    lines.push('');
  }

  if (commands.length) {
    lines.push('## Commands');
    for (const command of commands) {
      lines.push(command);
    }
    lines.push('');
  }

  if (errors.length) {
    lines.push('## Errors');
    for (const entry of errors) {
      const parts = [];
      if (entry.command) parts.push(`command=${entry.command}`);
      if (entry.message) parts.push(`message=${entry.message}`);
      if (entry.stderr) {
        const sanitizedStderr = String(entry.stderr).replace(/\s+/g, ' ').trim();
        if (sanitizedStderr) {
          parts.push(`stderr=${sanitizedStderr}`);
        }
      }
      if (entry.exitCode !== undefined && entry.exitCode !== null) {
        parts.push(`exit_code=${entry.exitCode}`);
      }
      if (entry.signal) parts.push(`signal=${entry.signal}`);
      if (entry.context) parts.push(`context=${entry.context}`);
      const detail = parts.length ? ` ${parts.join(', ')}` : '';
      lines.push(`- [${entry.timestamp}]${detail}`);
    }
    lines.push('');
  }

  if (vmafResults.length) {
    lines.push('## VMAF Results');
    for (const entry of vmafResults) {
      const parts = [];
      if (entry.targetPath) parts.push(`target=${entry.targetPath}`);
      if (entry.referencePath) parts.push(`reference=${entry.referencePath}`);
      if (entry.reportPath) parts.push(`report=${entry.reportPath}`);
      if (entry.context) {
        const contextItems = Object.entries(entry.context)
          .filter(([, value]) => value !== null && value !== undefined)
          .map(([key, value]) => `${key}=${value}`);
        if (contextItems.length) {
          parts.push(`context{${contextItems.join(', ')}}`);
        }
      }
      if (entry.error) {
        parts.push(`error=${entry.error}`);
      } else {
        if (Number.isFinite(entry.mean)) parts.push(`mean=${entry.mean}`);
        if (Number.isFinite(entry.min)) parts.push(`min=${entry.min}`);
        if (Number.isFinite(entry.max)) parts.push(`max=${entry.max}`);
      }
      const detail = parts.length ? ` ${parts.join(', ')}` : '';
      lines.push(`- [${entry.timestamp}]${detail}`);
    }
    lines.push('');
  }

  const summaryPath = `${outputPath}.log`;
  await writeFile(summaryPath, lines.join('\n'), 'utf8');
}

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
export async function probeDuration(ffprobeBin, inputPath, jobLog = null) {
  const args = [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    inputPath
  ];
  pushCommand(jobLog, ffprobeBin, args);
  const child = spawn(ffprobeBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

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
export async function runJob(job, durationSec, config, jobLog = null) {
  await updateJob(job.id, { status: 'running', progress: 0, error_msg: null });
  const log = normalizeJobLog(jobLog, job.output_path);

  try {
    if (job.params?.perScene) {
      await runPerSceneJob(job, durationSec, config, log);
      return;
    }

    const scalePreset = getResolutionPreset(job.params?.scale ?? 'source');
    let requestedBitrate = Number(job.params?.bitrateKbps);
    const hasValidBitrate = Number.isFinite(requestedBitrate) && requestedBitrate > 0;
    const qualityMode = job.params?.qualityMode === 'bitrate' && hasValidBitrate ? 'bitrate' : 'crf';
    let currentBitrate = qualityMode === 'bitrate'
      ? Math.max(MIN_BITRATE_KBPS, Math.min(MAX_BITRATE_KBPS, Math.round(requestedBitrate)))
      : null;
    const vmafTargets = qualityMode === 'bitrate' ? parseVmafTargets(job.params) : null;
    const adaptiveVmaf = Boolean(vmafTargets && currentBitrate);
    const enableVmaf = Boolean(job.params?.enableVmaf || adaptiveVmaf);
    const maxAttempts = adaptiveVmaf ? MAX_VMAF_TUNING_ATTEMPTS : 1;
    const history = [];
    let attempt = 0;
    let lastMetrics = null;

    while (attempt < maxAttempts) {
      attempt += 1;
      const qualityOverride = qualityMode === 'bitrate'
        ? buildBitrateOverride(currentBitrate)
        : null;
      const result = await transcodeOnce(job, durationSec, config, {
        qualityOverride,
        scalePreset,
        enableVmaf,
        jobLog: log
      });
      if (!result.success) {
        await finalizeOnFailure(job.id, result);
        return;
      }
      lastMetrics = result.metrics;
      if (qualityMode === 'bitrate' && qualityOverride?.bitrateKbps) {
        lastMetrics.usedBitrateKbps = qualityOverride.bitrateKbps;
      }
      if (adaptiveVmaf && result.metrics?.vmafScore) {
        history.push({
          attempt,
          bitrateKbps: qualityOverride?.bitrateKbps ?? currentBitrate,
          vmafScore: result.metrics.vmafScore,
          vmafMin: result.metrics.vmafMin,
          vmafMax: result.metrics.vmafMax
        });
        const nextBitrate = decideNextBitrate(
          qualityOverride?.bitrateKbps ?? currentBitrate,
          result.metrics,
          vmafTargets
        );
        if (nextBitrate && nextBitrate !== currentBitrate) {
          currentBitrate = nextBitrate;
          continue;
        }
      }
      break;
    }

    if (!lastMetrics) {
      await updateJob(job.id, {
        status: 'failed',
        error_msg: '编码未产生指标结果'
      });
      return;
    }

    if (history.length) {
      lastMetrics.vmafTuningHistory = history;
      lastMetrics.targetVmaf = vmafTargets;
      const finalScore = lastMetrics.vmafScore;
      if (
        finalScore !== undefined &&
        finalScore !== null &&
        vmafTargets &&
        (finalScore < vmafTargets.min || finalScore > vmafTargets.max)
      ) {
        lastMetrics.vmafNote = '已达到最大调整次数，仍未进入目标范围';
      }
    }

    await updateJob(job.id, {
      status: 'success',
      progress: 100,
      metrics_json: lastMetrics
    });
  } finally {
    await persistJobLog(log, job.output_path);
  }
}

async function runPerSceneJob(job, durationSec, config, jobLog) {
  const scalePreset = getResolutionPreset(job.params?.scale ?? 'source');
  const threshold = Number.isFinite(Number(job.params?.sceneThreshold))
    ? Math.max(0.01, Math.min(1, Number(job.params.sceneThreshold)))
    : 0.4;
  const cuts = await detectSceneCuts(config.ffmpeg.bin, job.input_path, threshold, jobLog);
  const scenes = buildSceneTimeline(cuts, durationSec);
  if (!scenes.length) {
    scenes.push({ index: 1, start: 0, end: durationSec ?? 0, duration: durationSec ?? 0 });
  }
  const outputDir = dirname(job.output_path);
  await mkdir(outputDir, { recursive: true });
  const baseName = basename(job.output_path, extname(job.output_path)) || 'output';
  const segmentsDir = join(outputDir, `${baseName}-scenes`);
  await mkdir(segmentsDir, { recursive: true });
  const vmafTargets = parseVmafTargets(job.params);
  const hasValidBitrate = Number.isFinite(Number(job.params?.bitrateKbps)) && Number(job.params?.bitrateKbps) > 0;
  const qualityMode = job.params?.qualityMode === 'bitrate' && hasValidBitrate ? 'bitrate' : 'crf';
  let currentBitrate = qualityMode === 'bitrate'
    ? Math.max(MIN_BITRATE_KBPS, Math.min(MAX_BITRATE_KBPS, Math.round(Number(job.params?.bitrateKbps))))
    : null;
  const sceneMetrics = [];
  let processedDuration = 0;

  for (const scene of scenes) {
    const paddedIndex = String(scene.index).padStart(3, '0');
    const segmentPath = join(segmentsDir, `scene-${paddedIndex}.mp4`);
    const progressOffset = durationSec
      ? (processedDuration / durationSec) * 100
      : ((scene.index - 1) / scenes.length) * 100;
    const progressScale = durationSec
      ? (scene.duration / (durationSec || 1)) * 100
      : (1 / scenes.length) * 100;
    const result = await encodeSceneSegment(job, durationSec, config, {
      scene,
      targetPath: segmentPath,
      scalePreset,
      vmafTargets,
      qualityMode,
      initialBitrate: currentBitrate,
      progressTracker: {
        offset: progressOffset,
        scale: progressScale,
        duration: scene.duration
      },
      jobLog
    });
    if (!result.success) {
      await finalizeOnFailure(job.id, {
        status: 'failed',
        error: result.error || `场景 ${scene.index} 编码失败`,
        progress: Math.floor(progressOffset)
      });
      return;
    }
    if (result.nextBitrate) {
      currentBitrate = result.nextBitrate;
    }
    sceneMetrics.push({
      index: scene.index,
      start: scene.start,
      end: scene.end,
      duration: scene.duration,
      output: segmentPath,
      metrics: result.metrics
    });
    processedDuration += scene.duration;
  }

  const segmentFiles = sceneMetrics.map((item) => item.output);
  try {
    await concatSceneSegments(config.ffmpeg.bin, segmentFiles, job.output_path, jobLog);
  } catch (error) {
    await finalizeOnFailure(job.id, { status: 'failed', error: `场景合并失败: ${error.message}` });
    return;
  }

  let hlsInfo = null;
  let dashInfo = null;
  try {
    hlsInfo = await generateHlsOutputs(config.ffmpeg.bin, job.output_path, jobLog);
  } catch (error) {
    await finalizeOnFailure(job.id, { status: 'failed', error: `HLS 生成失败: ${error.message}` });
    return;
  }
  try {
    dashInfo = await generateDashOutputs(config.ffmpeg.bin, job.output_path, jobLog);
  } catch (error) {
    await finalizeOnFailure(job.id, { status: 'failed', error: `DASH 生成失败: ${error.message}` });
    return;
  }

  const finalStat = await stat(job.output_path);
  const totalEncodeTime = Number(sceneMetrics
    .reduce((acc, scene) => acc + (scene.metrics?.encodeDurationSec ?? 0), 0)
    .toFixed(3));
  const finalMetrics = {
    sizeBytes: finalStat.size,
    encodeDurationSec: totalEncodeTime,
    encodeEfficiency: durationSec && durationSec > 0
      ? Number((totalEncodeTime / durationSec).toFixed(3))
      : null,
    perScene: sceneMetrics.map((scene) => ({
      index: scene.index,
      start: scene.start,
      end: scene.end,
      duration: scene.duration,
      usedBitrateKbps: scene.metrics?.usedBitrateKbps ?? null,
      vmafScore: scene.metrics?.vmafScore ?? null,
      vmafMin: scene.metrics?.vmafMin ?? null,
      vmafMax: scene.metrics?.vmafMax ?? null,
      vmafTuningHistory: scene.metrics?.vmafTuningHistory ?? null
    })),
    hlsPlaylist: hlsInfo?.playlist ?? null,
    dashManifest: dashInfo?.manifest ?? null
  };

  const aggregatedVmaf = aggregateVmaf(sceneMetrics);
  if (aggregatedVmaf) {
    finalMetrics.sceneVmafAggregate = aggregatedVmaf;
  }

  if (job.params?.enableVmaf || vmafTargets) {
    try {
      const finalReportPath = `${job.output_path}.vmaf.json`;
      const finalVmafStats = await computeVmafScore(
        config.ffmpeg.bin,
        job.output_path,
        job.input_path,
        { reportPath: finalReportPath, jobLog }
      );
      finalMetrics.vmafScore = Number(finalVmafStats.mean.toFixed(3));
      finalMetrics.vmafMax = Number(finalVmafStats.max.toFixed(3));
      finalMetrics.vmafMin = Number(finalVmafStats.min.toFixed(3));
      logVmafResult(jobLog, {
        targetPath: job.output_path,
        referencePath: job.input_path,
        reportPath: finalReportPath,
        mean: finalMetrics.vmafScore,
        max: finalMetrics.vmafMax,
        min: finalMetrics.vmafMin,
        context: buildVmafContext(null, 'final-output')
      });
    } catch (error) {
      finalMetrics.vmafError = error.message;
      logVmafResult(jobLog, {
        targetPath: job.output_path,
        referencePath: job.input_path,
        context: buildVmafContext(null, 'final-output'),
        error: error.message
      });
    }
  }

  await updateJob(job.id, {
    status: 'success',
    progress: 100,
    metrics_json: finalMetrics
  });
}


function parseVmafTargets(params = {}) {
  const min = Number(params.vmafMin);
  const max = Number(params.vmafMax);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 100 || min > max) {
    return null;
  }
  return { min, max };
}

function buildBitrateOverride(bitrate) {
  if (!Number.isFinite(bitrate) || bitrate <= 0) {
    return null;
  }
  const normalized = Math.max(MIN_BITRATE_KBPS, Math.min(MAX_BITRATE_KBPS, Math.round(bitrate)));
  return {
    mode: 'bitrate',
    bitrateKbps: normalized,
    maxrateKbps: Math.min(MAX_BITRATE_KBPS, Math.round(normalized * 1.15)),
    minrateKbps: Math.max(MIN_BITRATE_KBPS, Math.round(normalized * 0.7)),
    bufsizeKbps: Math.round(normalized * 2)
  };
}

function decideNextBitrate(current, metrics, targets) {
  if (!targets || !Number.isFinite(current)) {
    return null;
  }
  const score = Number(metrics?.vmafScore);
  if (!Number.isFinite(score)) {
    return null;
  }
  if (score < targets.min) {
    const next = Math.min(MAX_BITRATE_KBPS, Math.round(current * BITRATE_INCREASE_FACTOR));
    return next !== current ? next : null;
  }
  if (score > targets.max) {
    const next = Math.max(MIN_BITRATE_KBPS, Math.round(current * BITRATE_DECREASE_FACTOR));
    return next !== current ? next : null;
  }
  return null;
}

async function finalizeOnFailure(jobId, result) {
  if (result.status === 'canceled') {
    await updateJob(jobId, {
      status: 'canceled',
      error_msg: null,
      progress: result.progress ?? 0
    });
    return;
  }
  await updateJob(jobId, {
    status: 'failed',
    error_msg: result.error ?? 'ffmpeg 执行失败',
    progress: result.progress ?? 0
  });
}

async function transcodeOnce(job, durationSec, config, options) {
  const {
    qualityOverride,
    scalePreset,
    enableVmaf,
    targetPath = job.output_path,
    timeSlice = null,
    progressTracker = null,
    jobLog: jobLogOption = null
  } = options;
  const segmentDuration = timeSlice?.duration ?? durationSec;
  const ffmpegArgs = buildFfmpegArgs(
    job,
    qualityOverride,
    scalePreset,
    timeSlice,
    targetPath
  );
  const jobLog = normalizeJobLog(jobLogOption);
  const execution = await runFfmpegProcess(
    job,
    segmentDuration,
    config,
    ffmpegArgs,
    progressTracker,
    jobLog
  );
  if (!execution.success) {
    return execution;
  }
  try {
    const metrics = await collectMetrics(
      targetPath,
      job.input_path,
      execution.startTime,
      segmentDuration,
      config,
      enableVmaf,
      jobLog,
      buildVmafContext(timeSlice, 'segment')
    );
    return { success: true, metrics };
  } catch (error) {
    return {
      success: false,
      status: 'failed',
      error: error.message,
      progress: execution.progress
    };
  }
}

function buildFfmpegArgs(job, qualityOverride, scalePreset, timeSlice, targetPath) {
  const ffmpegArgs = ['-y'];
  if (timeSlice?.start >= 0) {
    ffmpegArgs.push('-ss', timeSlice.start.toFixed(3));
  }
  ffmpegArgs.push('-i', job.input_path);
  if (timeSlice?.duration && timeSlice.duration > 0) {
    ffmpegArgs.push('-t', timeSlice.duration.toFixed(3));
  }
  const videoArgs = buildVideoArgs(
    job.codec,
    job.impl,
    job.params?.profile,
    job.params?.preset,
    job.params?.crf,
    qualityOverride
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
  if (scalePreset?.width && scalePreset?.height) {
    ffmpegArgs.push('-vf', `scale=${scalePreset.width}:${scalePreset.height}`);
  }
  if (job.params?.extraArgs && Array.isArray(job.params.extraArgs)) {
    ffmpegArgs.push(...job.params.extraArgs);
  }
  ffmpegArgs.push(...audioArgs(), targetPath ?? job.output_path);
  return ffmpegArgs;
}

async function runFfmpegProcess(job, durationSec, config, ffmpegArgs, progressTracker, jobLog) {
  const startTime = Date.now();
  const command = pushCommand(jobLog, config.ffmpeg.bin, ffmpegArgs);
  const child = spawn(config.ffmpeg.bin, ffmpegArgs, {
    stdio: ['ignore', 'ignore', 'pipe']
  });
  runningChildren.set(job.id, child);

  const timeoutDuration = durationSec ?? 0;
  const maxTimeoutMs = timeoutDuration
    ? Math.max(durationSec * config.ffmpeg.timeoutFactor * 1000, 30000)
    : 0;
  let timeoutTimer;
  if (maxTimeoutMs > 0) {
    timeoutTimer = setTimeout(() => {
      child.kill('SIGKILL');
    }, maxTimeoutMs);
  }

  let lastProgress = 0;
  let stderrBuffer = '';
  child.stderr.on('data', (chunk) => {
    stderrBuffer += chunk.toString();
  });
  const rl = createInterface({ input: child.stderr });
  rl.on('line', (line) => {
    const timeMatch = /time=([0-9:.]+)/.exec(line);
    if (timeMatch && (durationSec || progressTracker?.duration)) {
      const seconds = parseFfmpegTime(timeMatch[1]);
      const durationForProgress = progressTracker?.duration ?? durationSec;
      const offset = progressTracker?.offset ?? 0;
      const scale = progressTracker?.scale ?? 100;
      let progress = lastProgress;
      if (durationForProgress) {
        const ratio = Math.min(1, seconds / durationForProgress);
        progress = Math.min(99, Math.floor(offset + ratio * scale));
      } else {
        progress = Math.min(99, Math.floor((seconds / (durationSec || 1)) * 100));
      }
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

  const stderrText = stderrBuffer.trim();

  if (signal === 'SIGTERM') {
    return { success: false, status: 'canceled', progress: lastProgress };
  }
  if (signal === 'SIGKILL') {
    logCommandError(jobLog, {
      command,
      message: '任务执行超时并被终止',
      signal,
      stderr: stderrText || null,
      context: 'transcode'
    });
    return {
      success: false,
      status: 'failed',
      error: '任务执行超时并被终止',
      progress: lastProgress
    };
  }
  if (code !== 0) {
    logCommandError(jobLog, {
      command,
      message: `ffmpeg 退出码 ${code}`,
      exitCode: code,
      signal,
      stderr: stderrText || null,
      context: 'transcode'
    });
    return {
      success: false,
      status: 'failed',
      error: `ffmpeg 退出码 ${code}`,
      progress: lastProgress
    };
  }
  return { success: true, startTime, progress: lastProgress };
}

async function collectMetrics(
  outputPath,
  referencePath,
  startTime,
  durationSec,
  config,
  enableVmaf,
  jobLog,
  context = null
) {
  const fileStat = await stat(outputPath);
  const encodeDurationSec = Number(((Date.now() - startTime) / 1000).toFixed(3));
  const metrics = { sizeBytes: fileStat.size, encodeDurationSec };
  if (typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0) {
    metrics.encodeEfficiency = Number((encodeDurationSec / durationSec).toFixed(3));
  }
  if (enableVmaf) {
    try {
      const reportPath = `${outputPath}.vmaf.json`;
      const vmafStats = await computeVmafScore(
        config.ffmpeg.bin,
        outputPath,
        referencePath,
        { reportPath, jobLog }
      );
      metrics.vmafScore = Number(vmafStats.mean.toFixed(3));
      metrics.vmafMax = Number(vmafStats.max.toFixed(3));
      metrics.vmafMin = Number(vmafStats.min.toFixed(3));
      logVmafResult(jobLog, {
        targetPath: outputPath,
        referencePath,
        reportPath,
        mean: metrics.vmafScore,
        max: metrics.vmafMax,
        min: metrics.vmafMin,
        context
      });
    } catch (error) {
      metrics.vmafError = error.message;
      logVmafResult(jobLog, {
        targetPath: outputPath,
        referencePath,
        context,
        error: error.message
      });
    }
  }
  return metrics;
}

async function encodeSceneSegment(job, durationSec, config, options) {
  const {
    scene,
    targetPath,
    scalePreset,
    vmafTargets,
    qualityMode,
    initialBitrate,
    progressTracker,
    jobLog
  } = options;
  let attempt = 0;
  let bitrate = initialBitrate;
  const history = [];

  while (attempt < MAX_VMAF_TUNING_ATTEMPTS) {
    attempt += 1;
    const qualityOverride = qualityMode === 'bitrate' && bitrate
      ? buildBitrateOverride(bitrate)
      : null;
    const result = await transcodeOnce(job, durationSec, config, {
      qualityOverride,
      scalePreset,
      enableVmaf: Boolean(vmafTargets),
      targetPath,
      timeSlice: scene,
      progressTracker,
      jobLog
    });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    const metrics = result.metrics;
    if (qualityOverride?.bitrateKbps) {
      metrics.usedBitrateKbps = qualityOverride.bitrateKbps;
    }
    const withinRange = !vmafTargets || isVmafWithin(metrics, vmafTargets);
    if (vmafTargets) {
      history.push({
        attempt,
        bitrateKbps: metrics.usedBitrateKbps ?? bitrate ?? null,
        vmafScore: metrics.vmafScore ?? null,
        vmafMin: metrics.vmafMin ?? null,
        vmafMax: metrics.vmafMax ?? null
      });
      metrics.vmafTuningHistory = history.slice();
    }
    if (withinRange || !vmafTargets) {
      return { success: true, metrics, nextBitrate: metrics.usedBitrateKbps ?? bitrate ?? null };
    }
    if (qualityMode !== 'bitrate') {
      return {
        success: false,
        error: `场景 ${scene.index} 的 VMAF ${metrics.vmafScore?.toFixed?.(2) ?? metrics.vmafScore} 不在目标范围内`
      };
    }
    const nextBitrate = decideNextBitrate(
      metrics.usedBitrateKbps ?? bitrate ?? initialBitrate ?? MIN_BITRATE_KBPS,
      metrics,
      vmafTargets
    );
    if (!nextBitrate || nextBitrate === bitrate) {
      return {
        success: false,
        error: `场景 ${scene.index} 多次尝试后仍未达到目标 VMAF`
      };
    }
    bitrate = nextBitrate;
  }
  return {
    success: false,
    error: `场景 ${scene.index} 达到最大尝试次数仍未满足 VMAF 范围`
  };
}

function isVmafWithin(metrics, targets) {
  if (!metrics) return false;
  const score = Number(metrics.vmafScore);
  if (!Number.isFinite(score)) {
    return false;
  }
  return score >= targets.min && score <= targets.max;
}

async function detectSceneCuts(ffmpegBin, inputPath, threshold, jobLog) {
  return new Promise((resolve) => {
    const filterExpr = `select='gt(scene,${threshold})',showinfo`;
    const args = [
      '-hide_banner',
      '-i',
      inputPath,
      '-vf',
      filterExpr,
      '-f',
      'null',
      '-'
    ];
    pushCommand(jobLog, ffmpegBin, args);
    const child = spawn(ffmpegBin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const cuts = [];
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      const matches = text.match(/pts_time:([0-9.]+)/g);
      if (matches) {
        matches.forEach((match) => {
          const val = parseFloat(match.split(':')[1]);
          if (Number.isFinite(val)) {
            cuts.push(val);
          }
        });
      }
    });
    child.on('close', () => {
      resolve(cuts.sort((a, b) => a - b));
    });
    child.on('error', () => resolve([]));
  });
}

function buildSceneTimeline(cuts, durationSec) {
  const timeline = [];
  const totalDuration = Number.isFinite(durationSec) ? durationSec : null;
  const points = [0, ...cuts.filter((value) => value > 0)];
  if (totalDuration && totalDuration > 0) {
    points.push(totalDuration);
  }
  const uniquePoints = [...new Set(points)].sort((a, b) => a - b);
  for (let i = 0; i < uniquePoints.length - 1; i += 1) {
    const start = uniquePoints[i];
    const end = uniquePoints[i + 1];
    const duration = Number(Math.max(0, end - start).toFixed(3));
    if (duration <= 0.1) {
      continue;
    }
    timeline.push({
      index: timeline.length + 1,
      start,
      end,
      duration
    });
  }
  if (!timeline.length && totalDuration) {
    timeline.push({
      index: 1,
      start: 0,
      end: totalDuration,
      duration: totalDuration
    });
  }
  return timeline;
}

async function concatSceneSegments(ffmpegBin, files, outputPath, jobLog) {
  const listContent = files
    .map((file) => `file '${file.replace(/'/g, "'\\''")}'`)
    .join('\n');
  const listPath = `${outputPath}.concat.txt`;
  await writeFile(listPath, listContent, 'utf8');
  const args = ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath];
  await runExternalFfmpeg(ffmpegBin, args, jobLog);
}

async function generateHlsOutputs(ffmpegBin, sourcePath, jobLog) {
  const outputDir = dirname(sourcePath);
  const baseName = basename(sourcePath, extname(sourcePath)) || 'output';
  const hlsDir = join(outputDir, `${baseName}-hls`);
  await mkdir(hlsDir, { recursive: true });
  const segmentPattern = join(hlsDir, `${baseName}-segment-%03d.ts`);
  const playlistPath = join(hlsDir, `${baseName}.m3u8`);
  const args = [
    '-y',
    '-i',
    sourcePath,
    '-codec',
    'copy',
    '-start_number',
    '0',
    '-hls_time',
    '4',
    '-hls_playlist_type',
    'vod',
    '-hls_segment_filename',
    segmentPattern,
    playlistPath
  ];
  await runExternalFfmpeg(ffmpegBin, args, jobLog);
  return { playlist: playlistPath };
}

async function generateDashOutputs(ffmpegBin, sourcePath, jobLog) {
  const outputDir = dirname(sourcePath);
  const baseName = basename(sourcePath, extname(sourcePath)) || 'output';
  const dashDir = join(outputDir, `${baseName}-dash`);
  await mkdir(dashDir, { recursive: true });
  const manifestPath = join(dashDir, `${baseName}.mpd`);
  const args = [
    '-y',
    '-i',
    sourcePath,
    '-c',
    'copy',
    '-map',
    '0',
    '-f',
    'dash',
    '-seg_duration',
    '4',
    '-init_seg_name',
    `${baseName}-init-\$RepresentationID\$.m4s`,
    '-media_seg_name',
    `${baseName}-\$RepresentationID\$-\$Number%05d\$.m4s`,
    manifestPath
  ];
  await runExternalFfmpeg(ffmpegBin, args, jobLog);
  return { manifest: manifestPath };
}

async function runExternalFfmpeg(ffmpegBin, args, jobLog) {
  const command = pushCommand(jobLog, ffmpegBin, args);
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        const stderrText = stderr.trim();
        logCommandError(jobLog, {
          command,
          message: stderrText || `ffmpeg 退出码 ${code}`,
          stderr: stderrText || null,
          exitCode: code,
          context: 'external'
        });
        reject(new Error(stderrText || `ffmpeg 退出码 ${code}`));
      }
    });
    child.on('error', (error) => {
      logCommandError(jobLog, {
        command,
        message: error.message,
        context: 'external'
      });
      reject(error);
    });
  });
}

function aggregateVmaf(sceneMetrics) {
  const items = sceneMetrics.filter((scene) => Number.isFinite(scene.metrics?.vmafScore));
  if (!items.length) {
    return null;
  }
  const totalDuration = items.reduce((acc, scene) => acc + (scene.duration || 0), 0);
  if (!totalDuration) {
    return null;
  }
  const weighted = items.reduce(
    (acc, scene) => acc + (scene.metrics.vmafScore * (scene.duration || 0)),
    0
  );
  return {
    vmafScore: Number((weighted / totalDuration).toFixed(3)),
    vmafMin: Math.min(...items.map((scene) => scene.metrics.vmafMin ?? scene.metrics.vmafScore)),
    vmafMax: Math.max(...items.map((scene) => scene.metrics.vmafMax ?? scene.metrics.vmafScore))
  };
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

async function computeVmafScore(ffmpegBin, distortedPath, referencePath, options = {}) {
  const { reportPath = null, jobLog = null } = options;
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
  const command = pushCommand(jobLog, ffmpegBin, args);
  const child = spawn(ffmpegBin, args, {
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  const [code] = await once(child, 'close');
  if (code !== 0) {
    const stderrText = stderr.trim();
    logCommandError(jobLog, {
      command,
      message: `VMAF 计算失败，退出码 ${code}`,
      stderr: stderrText || null,
      exitCode: code,
      context: 'vmaf'
    });
    throw new Error(`VMAF 计算失败，退出码 ${code}`);
  }
  const jsonStart = stderr.lastIndexOf('{"version"');
  if (jsonStart === -1) {
    logCommandError(jobLog, {
      command,
      message: '未能解析 VMAF 结果',
      stderr: stderr.trim() || null,
      context: 'vmaf'
    });
    throw new Error('未能解析 VMAF 结果');
  }
  const jsonSlice = stderr.slice(jsonStart);
  const jsonEnd = jsonSlice.lastIndexOf('}');
  if (jsonEnd === -1) {
    logCommandError(jobLog, {
      command,
      message: '未能解析 VMAF 结果',
      stderr: stderr.trim() || null,
      context: 'vmaf'
    });
    throw new Error('未能解析 VMAF 结果');
  }
  const jsonText = jsonSlice.slice(0, jsonEnd + 1);
  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch (error) {
    logCommandError(jobLog, {
      command,
      message: `VMAF 结果 JSON 解析失败: ${error.message}`,
      stderr: stderr.trim() || null,
      context: 'vmaf'
    });
    throw new Error(`VMAF 结果 JSON 解析失败: ${error.message}`);
  }
  const aggregateScore = Number(payload?.aggregate?.vmaf);
  if (!Number.isFinite(aggregateScore)) {
    logCommandError(jobLog, {
      command,
      message: 'VMAF 结果缺少 aggregate.vmaf',
      stderr: stderr.trim() || null,
      context: 'vmaf'
    });
    throw new Error('VMAF 结果缺少 aggregate.vmaf');
  }
  const frameScores = Array.isArray(payload?.frames)
    ? payload.frames
        .map((frame) => Number(frame?.metrics?.vmaf))
        .filter((value) => Number.isFinite(value))
    : [];
  const maxScore = frameScores.length ? Math.max(...frameScores) : aggregateScore;
  const minScore = frameScores.length ? Math.min(...frameScores) : aggregateScore;
  if (reportPath) {
    await writeFile(reportPath, jsonText, 'utf8');
  }
  return {
    mean: aggregateScore,
    max: maxScore,
    min: minScore
  };
}
