/**
 * @file FFmpeg 执行器
 * @description 调度 ffmpeg 并跟踪转码进度（主调度器）
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { stat, writeFile, mkdir } from "node:fs/promises";
import { dirname, basename, extname, join } from "node:path";
import {
  audioArgs,
  buildVideoArgs,
  videoPresets,
  getResolutionPreset,
} from "./presets.mjs";
import { updateJob } from "../controllers/jobs.mjs";
import { cleanupJobTempFiles } from "../../scripts/cleanup-temp-files.mjs";

import {
  detectSceneCuts,
  buildSceneTimeline,
  encodeSceneSegment,
  concatSceneSegments,
  aggregateVmaf,
} from "./ffmpeg/ffmpeg-scene-processor.mjs";
import {
  computeVmafScore,
  isVmafWithin,
} from "./ffmpeg/ffmpeg-vmaf-calculator.mjs";
import {
  buildFfmpegArgs,
  buildBitrateOverride,
  decideNextBitrate,
  parseVmafTargets,
} from "./ffmpeg/ffmpeg-encoding-params.mjs";
import {
  probeDuration,
  parseFfmpegTime,
  finalizeOnFailure,
  collectMetrics,
  runExternalFfmpeg,
  transcodeOnce,
  runFfmpegProcess,
  cancelRunningJob,
} from "./ffmpeg/ffmpeg-utils.mjs";
import {
  generateHlsOutputs,
  generateDashOutputs,
} from "./ffmpeg/ffmpeg-output-generators.mjs";

async function runPerSceneJob(job, durationSec, config) {
  try {
    console.log(`[场景编码] 开始处理任务 ${job.id}`);
    const scalePreset = getResolutionPreset(job.params?.scale ?? "source");
    const threshold = Number.isFinite(Number(job.params?.sceneThreshold))
      ? Math.max(0.01, Math.min(1, Number(job.params.sceneThreshold)))
      : config.sceneDetection?.threshold ?? 0.4;
    
    console.log(`[场景编码] 开始场景检测,阈值=${threshold}`);
    const cuts = await detectSceneCuts(
      config.ffmpeg.bin,
      job.input_path,
      threshold
    );
    console.log(`[场景编码] 检测到 ${cuts.length} 个场景切换点:`, cuts);
    
    const scenes = buildSceneTimeline(cuts, durationSec);
    console.log(`[场景编码] 构建了 ${scenes.length} 个场景片段`);
    if (!scenes.length) {
      scenes.push({
        index: 1,
        start: 0,
        end: durationSec ?? 0,
        duration: durationSec ?? 0,
      });
    }
    const outputDir = dirname(job.output_path);
    await mkdir(outputDir, { recursive: true });
    const baseName =
      basename(job.output_path, extname(job.output_path)) || "output";
    const segmentsDir = join(outputDir, `${baseName}-scenes`);
    await mkdir(segmentsDir, { recursive: true });
    const vmafTargets = parseVmafTargets(job.params);
    const hasValidBitrate =
      Number.isFinite(Number(job.params?.bitrateKbps)) &&
      Number(job.params?.bitrateKbps) > 0;
    const qualityMode =
      job.params?.qualityMode === "bitrate" && hasValidBitrate
        ? "bitrate"
        : "crf";
    let currentBitrate =
      qualityMode === "bitrate"
        ? Math.max(
            config.vmaf.minBitrateKbps,
            Math.min(
              config.vmaf.maxBitrateKbps,
              Math.round(Number(job.params?.bitrateKbps))
            )
          )
        : null;
    const sceneMetrics = [];
    let processedDuration = 0;

    for (const scene of scenes) {
      console.log(`[场景编码] 编码场景 ${scene.index}: ${scene.start}s - ${scene.end}s (时长=${scene.duration}s)`);
      const paddedIndex = String(scene.index).padStart(3, "0");
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
          duration: scene.duration,
        },
      });
      if (!result.success) {
        console.error(`[场景编码] 场景 ${scene.index} 编码失败:`, result.error);
        // 场景编码失败时，清理临时文件
        await cleanupJobTempFiles(job.id, job.output_path);
        await finalizeOnFailure(job.id, {
          status: "failed",
          error: result.error || `场景 ${scene.index} 编码失败`,
          progress: Math.floor(progressOffset),
        });
        return;
      }
      console.log(`[场景编码] 场景 ${scene.index} 编码完成, VMAF=${result.metrics?.vmafScore}`);
      if (result.nextBitrate) {
        console.log(`[场景编码] 下个场景使用码率: ${result.nextBitrate} kbps`);
        currentBitrate = result.nextBitrate;
      }
      sceneMetrics.push({
        index: scene.index,
        start: scene.start,
        end: scene.end,
        duration: scene.duration,
        output: segmentPath,
        metrics: result.metrics,
      });
      processedDuration += scene.duration;
    }

    const segmentFiles = sceneMetrics.map((item) => item.output);
    console.log(`[场景编码] 开始合并 ${segmentFiles.length} 个场景片段`);
    try {
      await concatSceneSegments(
        config.ffmpeg.bin,
        segmentFiles,
        job.output_path
      );
      console.log(`[场景编码] 场景片段合并完成: ${job.output_path}`);
    } catch (error) {
      console.error(`[场景编码] 场景合并失败:`, error);
      // 合并失败时，清理临时文件
      await cleanupJobTempFiles(job.id, job.output_path);
      await finalizeOnFailure(job.id, {
        status: "failed",
        error: `场景合并失败: ${error.message}`,
      });
      return;
    }

    let hlsInfo = null;
    let dashInfo = null;
    console.log(`[场景编码] 开始生成 HLS 输出`);
    try {
      hlsInfo = await generateHlsOutputs(
        config.ffmpeg.bin,
        job.output_path
      );
      console.log(`[场景编码] HLS 生成完成:`, hlsInfo);
    } catch (error) {
      console.error(`[场景编码] HLS 生成失败:`, error);
      // HLS 生成失败时，清理临时文件
      await cleanupJobTempFiles(job.id, job.output_path);
      await finalizeOnFailure(job.id, {
        status: "failed",
        error: `HLS 生成失败: ${error.message}`,
      });
      return;
    }
    console.log(`[场景编码] 开始生成 DASH 输出`);
    try {
      dashInfo = await generateDashOutputs(
        config.ffmpeg.bin,
        job.output_path
      );
      console.log(`[场景编码] DASH 生成完成:`, dashInfo);
    } catch (error) {
      console.error(`[场景编码] DASH 生成失败:`, error);
      // DASH 生成失败时，清理临时文件
      await cleanupJobTempFiles(job.id, job.output_path);
      await finalizeOnFailure(job.id, {
        status: "failed",
        error: `DASH 生成失败: ${error.message}`,
      });
      return;
    }

    const finalStat = await stat(job.output_path);
    const totalEncodeTime = Number(
      sceneMetrics
        .reduce((acc, scene) => acc + (scene.metrics?.encodeDurationSec ?? 0), 0)
        .toFixed(3)
    );
    const finalMetrics = {
      sizeBytes: finalStat.size,
      encodeDurationSec: totalEncodeTime,
      encodeEfficiency:
        durationSec && durationSec > 0
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
        vmafTuningHistory: scene.metrics?.vmafTuningHistory ?? null,
      })),
      hlsPlaylist: hlsInfo?.playlist ?? null,
      dashManifest: dashInfo?.manifest ?? null,
    };

    const aggregatedVmaf = aggregateVmaf(sceneMetrics);
    if (aggregatedVmaf) {
      finalMetrics.sceneVmafAggregate = aggregatedVmaf;
    }

    if (job.params?.enableVmaf || vmafTargets) {
      console.log(`[场景编码] 开始计算最终 VMAF 分数`);
      try {
        const finalReportPath = `${job.output_path}.vmaf.json`;
        const finalVmafStats = await computeVmafScore(
          config.ffmpeg.bin,
          job.output_path,
          job.input_path,
          {
            reportPath: finalReportPath,
          }
        );
        console.log(`[场景编码] 最终 VMAF 计算完成:`, finalVmafStats);
        finalMetrics.vmafScore = Number(finalVmafStats.mean.toFixed(3));
        finalMetrics.vmafMax = Number(finalVmafStats.max.toFixed(3));
        finalMetrics.vmafMin = Number(finalVmafStats.min.toFixed(3));
      } catch (error) {
        console.error(`[场景编码] 最终 VMAF 计算失败:`, error);
        finalMetrics.vmafError = error.message;
      }
    }

    console.log(`[场景编码] 任务完成,更新状态为 success`);

    // 清理临时文件
    await cleanupJobTempFiles(job.id, job.output_path);
    await updateJob(job.id, {
      status: "success",
      progress: 100,
      metrics_json: finalMetrics,
    });
    console.log(`[场景编码] 任务 ${job.id} 全部完成`);
  } catch (error) {
    console.error(`[场景编码] 任务 ${job.id} 异常:`, error);
    await finalizeOnFailure(job.id, {
      status: "failed",
      error: `场景编码流程异常: ${error.message}`,
      progress: 0,
    });
  }
}

async function runJob(job, durationSec, config) {
  await updateJob(job.id, { status: "running", progress: 0, error_msg: null });

  if (job.params?.perScene) {
    await runPerSceneJob(job, durationSec, config);
    return;
  }

  const scalePreset = getResolutionPreset(job.params?.scale ?? "source");
  let requestedBitrate = Number(job.params?.bitrateKbps);
  const hasValidBitrate =
    Number.isFinite(requestedBitrate) && requestedBitrate > 0;
  const qualityMode =
    job.params?.qualityMode === "bitrate" && hasValidBitrate
      ? "bitrate"
      : "crf";
  let currentBitrate =
    qualityMode === "bitrate"
      ? Math.max(
          config.vmaf.minBitrateKbps,
          Math.min(config.vmaf.maxBitrateKbps, Math.round(requestedBitrate))
        )
      : null;
  const vmafTargets =
    qualityMode === "bitrate" ? parseVmafTargets(job.params) : null;
  const adaptiveVmaf = Boolean(vmafTargets && currentBitrate);
  const enableVmaf = Boolean(job.params?.enableVmaf || adaptiveVmaf);
  const maxAttempts = adaptiveVmaf ? config.vmaf.maxTuningAttempts : 1;
  const history = [];
  let attempt = 0;
  let lastMetrics = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    const qualityOverride =
      qualityMode === "bitrate"
        ? buildBitrateOverride(currentBitrate, config)
        : null;
    const result = await transcodeOnce(job, durationSec, config, {
      qualityOverride,
      scalePreset,
      enableVmaf,
    });
    if (!result.success) {
      await finalizeOnFailure(job.id, result);
      return;
    }
    lastMetrics = result.metrics;
    if (qualityMode === "bitrate" && qualityOverride?.bitrateKbps) {
      lastMetrics.usedBitrateKbps = qualityOverride.bitrateKbps;
    }
    if (adaptiveVmaf && result.metrics?.vmafScore) {
      history.push({
        attempt,
        bitrateKbps: qualityOverride?.bitrateKbps ?? currentBitrate,
        vmafScore: result.metrics.vmafScore,
        vmafMin: result.metrics.vmafMin,
        vmafMax: result.metrics.vmafMax,
      });
      lastMetrics.vmafTuningHistory = history;
      const nextBitrate = decideNextBitrate(
        qualityOverride?.bitrateKbps ?? currentBitrate,
        result.metrics,
        vmafTargets,
        config
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
      status: "failed",
      error_msg: "编码未产生指标结果",
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
      lastMetrics.vmafNote = "已达到最大调整次数，仍未进入目标范围";
    }
  }

  await updateJob(job.id, {
    status: "success",
    progress: 100,
    metrics_json: lastMetrics,
  });

  // 清理临时文件（仅场景模式会生成临时文件，但统一处理）
  await cleanupJobTempFiles(job.id, job.output_path);
}

export { runJob, runPerSceneJob, cancelRunningJob, probeDuration };
