/**
 * @file ffmpeg utils
 * @description ffmpeg工具函数、辅助功能
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { stat, writeFile, mkdir } from "node:fs/promises";
import { dirname, basename, extname, join } from "node:path";
import { buildFfmpegArgs } from "./ffmpeg-encoding-params.mjs";
import { updateJob } from "../../controllers/jobs.mjs";
import { computeVmafScore } from "./ffmpeg-vmaf-calculator.mjs";

const runningChildren = new Map();

function parseFfmpegTime(timeStr) {
  const [h, m, s] = timeStr.split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/**
 * @description 运行 ffprobe 获取媒体时长
 * @param {string} ffprobeBin ffprobe 路径
 */

async function probeDuration(ffprobeBin, inputPath) {
  const child = spawn(
    ffprobeBin,
    [
      "-loglevel",
      "warning",
      "-hide_banner",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });

  const [code] = await once(child, "close");
  if (code !== 0) {
    return null;
  }
  const val = parseFloat(stdout.trim());
  return Number.isFinite(val) ? val : null;
}

/**
 * @description 运行 ffprobe 获取媒体时长
 * @param {string} ffprobeBin ffprobe 路径
 */

async function finalizeOnFailure(jobId, result) {
  if (result.status === "canceled") {
    await updateJob(jobId, {
      status: "canceled",
      error_msg: null,
      progress: result.progress ?? 0,
    });
    return;
  }
  await updateJob(jobId, {
    status: "failed",
    error_msg: result.error ?? "ffmpeg 执行失败",
    progress: result.progress ?? 0,
  });
}

async function collectMetrics(
  outputPath,
  referencePath,
  startTime,
  durationSec,
  config,
  enableVmaf
) {
  const fileStat = await stat(outputPath);
  const encodeDurationSec = Number(
    ((Date.now() - startTime) / 1000).toFixed(3)
  );
  const metrics = { sizeBytes: fileStat.size, encodeDurationSec };
  if (
    typeof durationSec === "number" &&
    Number.isFinite(durationSec) &&
    durationSec > 0
  ) {
    metrics.encodeEfficiency = Number(
      (encodeDurationSec / durationSec).toFixed(3)
    );
  }
  if (enableVmaf) {
    try {
      const vmafStats = await computeVmafScore(
        config.ffmpeg.bin,
        outputPath,
        referencePath,
        config,
        0
      );
      metrics.vmafScore = Number(vmafStats.mean.toFixed(3));
      metrics.vmafMax = Number(vmafStats.max.toFixed(3));
      metrics.vmafMin = Number(vmafStats.min.toFixed(3));
    } catch (error) {
      metrics.vmafError = error.message;
    }
  }
  return metrics;
}

async function runExternalFfmpeg(ffmpegBin, args) {
  return new Promise((resolve, reject) => {
    const argsWithLogLevel = ["-loglevel", "warning", "-hide_banner", ...args];
    const child = spawn(ffmpegBin, argsWithLogLevel, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(stderr.trim() || `ffmpeg 退出码 ${code}`));
      }
    });
    child.on("error", (error) => reject(error));
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
  } = options;
  const segmentDuration = timeSlice?.duration ?? durationSec;
  const ffmpegArgs = buildFfmpegArgs(
    job,
    qualityOverride,
    scalePreset,
    timeSlice,
    targetPath,
    config
  );
  const execution = await runFfmpegProcess(
    job,
    segmentDuration,
    config,
    ffmpegArgs,
    progressTracker
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
      enableVmaf
    );
    return { success: true, metrics };
  } catch (error) {
    return {
      success: false,
      status: "failed",
      error: error.message,
      progress: execution.progress,
    };
  }
}

async function runFfmpegProcess(
  job,
  durationSec,
  config,
  ffmpegArgs,
  progressTracker
) {
  const startTime = Date.now();
  const argsWithLogLevel = [
    "-loglevel",
    "warning",
    "-hide_banner",
    ...ffmpegArgs,
  ];
  const child = spawn(config.ffmpeg.bin, argsWithLogLevel, {
    stdio: ["ignore", "ignore", "pipe"],
  });
  runningChildren.set(job.id, child);

  const timeoutDuration = durationSec ?? 0;
  const maxTimeoutMs = timeoutDuration
    ? Math.max(durationSec * config.ffmpeg.timeoutFactor * 1000, 30000)
    : 0;
  let timeoutTimer;
  if (maxTimeoutMs > 0) {
    timeoutTimer = setTimeout(() => {
      child.kill("SIGKILL");
    }, maxTimeoutMs);
  }

  let lastProgress = 0;
  let stderrBuffer = "";
  const rl = createInterface({ input: child.stderr });
  rl.on("line", (line) => {
    stderrBuffer += line + "\n";
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
        progress = Math.min(
          99,
          Math.floor((seconds / (durationSec || 1)) * 100)
        );
      }
      if (progress >= lastProgress + 1) {
        lastProgress = progress;
        updateJob(job.id, { progress }).catch((err) => {
          console.error("进度更新失败", err);
        });
      }
    }
  });

  const [code, signal] = await once(child, "close");
  runningChildren.delete(job.id);
  rl.close();
  if (timeoutTimer) {
    clearTimeout(timeoutTimer);
  }

  if (signal === "SIGTERM") {
    return { success: false, status: "canceled", progress: lastProgress };
  }
  if (signal === "SIGKILL") {
    return {
      success: false,
      status: "failed",
      error: "任务执行超时并被终止",
      progress: lastProgress,
    };
  }
  if (code !== 0) {
    const errorDetail = stderrBuffer.trim() || `ffmpeg 退出码 ${code}`;
    return {
      success: false,
      status: "failed",
      error: errorDetail,
      progress: lastProgress,
    };
  }
  return { success: true, startTime, progress: lastProgress };
}

function cancelRunningJob(jobId) {
  const child = runningChildren.get(jobId);
  if (child) {
    child.kill("SIGTERM");
    runningChildren.delete(jobId);
    return true;
  }
  return false;
}

export {
  probeDuration,
  parseFfmpegTime,
  finalizeOnFailure,
  collectMetrics,
  runExternalFfmpeg,
  transcodeOnce,
  runFfmpegProcess,
  cancelRunningJob,
};
