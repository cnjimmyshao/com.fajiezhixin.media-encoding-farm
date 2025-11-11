/**
 * @file scene processor
 * @description 场景检测、场景编码、场景合并
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { stat, writeFile, mkdir } from "node:fs/promises";
import { dirname, basename, extname, join } from "node:path";
import {
  buildBitrateOverride,
  decideNextBitrate,
} from "./ffmpeg-encoding-params.mjs";
import { computeVmafScore, isVmafWithin } from "./ffmpeg-vmaf-calculator.mjs";
import { transcodeOnce } from "./ffmpeg-utils.mjs";

async function detectSceneCuts(ffmpegBin, inputPath, threshold) {
  return new Promise((resolve) => {
    const filterExpr = `select='gt(scene,${threshold})',showinfo`;
    const args = [
      "-hide_banner",
      "-i",
      inputPath,
      "-vf",
      filterExpr,
      "-f",
      "null",
      "-",
    ];
    const child = spawn(ffmpegBin, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    const cuts = [];
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      const matches = text.match(/pts_time:([0-9.]+)/g);
      if (matches) {
        matches.forEach((match) => {
          const val = parseFloat(match.split(":")[1]);
          if (Number.isFinite(val)) {
            cuts.push(val);
          }
        });
      }
    });
    child.on("close", () => {
      resolve(cuts.sort((a, b) => a - b));
    });
    child.on("error", () => resolve([]));
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
      duration,
    });
  }
  if (!timeline.length && totalDuration) {
    timeline.push({
      index: 1,
      start: 0,
      end: totalDuration,
      duration: totalDuration,
    });
  }
  return timeline;
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
  } = options;
  let attempt = 0;
  let bitrate = initialBitrate;
  const history = [];

  while (attempt < config.vmaf.maxTuningAttempts) {
    attempt += 1;
    const qualityOverride =
      qualityMode === "bitrate" && bitrate
        ? buildBitrateOverride(bitrate, config)
        : null;
    const result = await transcodeOnce(job, durationSec, config, {
      qualityOverride,
      scalePreset,
      enableVmaf: Boolean(vmafTargets),
      targetPath,
      timeSlice: scene,
      progressTracker,
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
        vmafMax: metrics.vmafMax ?? null,
      });
      metrics.vmafTuningHistory = history.slice();
    }
    if (withinRange || !vmafTargets) {
      return {
        success: true,
        metrics,
        nextBitrate: metrics.usedBitrateKbps ?? bitrate ?? null,
      };
    }
    if (qualityMode !== "bitrate") {
      return {
        success: false,
        error: `场景 ${scene.index} 的 VMAF ${
          metrics.vmafScore?.toFixed?.(2) ?? metrics.vmafScore
        } 不在目标范围内`,
      };
    }
    const nextBitrate = decideNextBitrate(
      metrics.usedBitrateKbps ??
        bitrate ??
        initialBitrate ??
        config.vmaf.minBitrateKbps,
      metrics,
      vmafTargets,
      config
    );
    if (!nextBitrate || nextBitrate === bitrate) {
      return {
        success: false,
        error: `场景 ${scene.index} 多次尝试后仍未达到目标 VMAF`,
      };
    }
    bitrate = nextBitrate;
  }
  return {
    success: false,
    error: `场景 ${scene.index} 达到最大尝试次数仍未满足 VMAF 范围`,
  };
}

async function concatSceneSegments(ffmpegBin, files, outputPath) {
  const listContent = files
    .map((file) => `file '${file.replace(/'/g, "'\\''")}'`)
    .join("\n");
  const listPath = `${outputPath}.concat.txt`;
  await writeFile(listPath, listContent, "utf8");
  const args = [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    outputPath,
  ];
  await runExternalFfmpeg(ffmpegBin, args);
}

function aggregateVmaf(sceneMetrics) {
  const items = sceneMetrics.filter((scene) =>
    Number.isFinite(scene.metrics?.vmafScore)
  );
  if (!items.length) {
    return null;
  }
  const totalDuration = items.reduce(
    (acc, scene) => acc + (scene.duration || 0),
    0
  );
  if (!totalDuration) {
    return null;
  }
  const weighted = items.reduce(
    (acc, scene) => acc + scene.metrics.vmafScore * (scene.duration || 0),
    0
  );
  return {
    vmafScore: Number((weighted / totalDuration).toFixed(3)),
    vmafMin: Math.min(
      ...items.map((scene) => scene.metrics.vmafMin ?? scene.metrics.vmafScore)
    ),
    vmafMax: Math.max(
      ...items.map((scene) => scene.metrics.vmafMax ?? scene.metrics.vmafScore)
    ),
  };
}

/**
 * @description 终止运行中的 ffmpeg 进程
 * @param {string} jobId 任务标识
 */

export {
  detectSceneCuts,
  buildSceneTimeline,
  encodeSceneSegment,
  concatSceneSegments,
  aggregateVmaf,
};
