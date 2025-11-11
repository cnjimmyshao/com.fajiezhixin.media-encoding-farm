/**
 * @file encoding params
 * @description 编码参数构建、码率控制
 */

import { audioArgs, buildVideoArgs, videoPresets, getResolutionPreset } from './presets.mjs';
import { getCodecExtraArgs, getAudioArgs as getCodecAudioArgs } from './codec-config.mjs';

function buildFfmpegArgs(
  job,
  qualityOverride,
  scalePreset,
  timeSlice,
  targetPath,
  config
) {
  const ffmpegArgs = ["-y"];
  if (timeSlice?.start >= 0) {
    ffmpegArgs.push("-ss", timeSlice.start.toFixed(3));
  }
  ffmpegArgs.push("-i", job.input_path);
  if (timeSlice?.duration && timeSlice.duration > 0) {
    ffmpegArgs.push("-t", timeSlice.duration.toFixed(3));
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
      fallbackKeys.push(
        `${job.codec}:${job.impl}:${job.params.profile}:${job.params.crf}`
      );
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
    ffmpegArgs.push("-vf", `scale=${scalePreset.width}:${scalePreset.height}`);
  }
  
  // 添加GOP控制参数
  const encodingConfig = config.encoding || {};
  const gopLength = encodingConfig.gopLength || 60;
  const keyintMin = encodingConfig.keyintMin || 30;
  const scThreshold = encodingConfig.scThreshold !== undefined ? encodingConfig.scThreshold : 0;
  
  // 如果是按场景切片编码，强制场景边界为I帧
  if (job.params?.perScene && timeSlice) {
    // 在场景开始处强制I帧
    ffmpegArgs.push("-force_key_frames", timeSlice.start.toFixed(3));
  }
  
  // 设置GOP长度
  ffmpegArgs.push("-g", String(gopLength));
  
  // 设置最小关键帧间隔
  ffmpegArgs.push("-keyint_min", String(keyintMin));
  
  // 禁用自动场景检测（我们自己控制场景边界）
  ffmpegArgs.push("-sc_threshold", String(scThreshold));
  
  // 添加codec-specific参数
  const codecExtraArgs = getCodecExtraArgs(job.codec, job.impl, qualityOverride?.mode || 'crf');
  if (codecExtraArgs.length > 0) {
    ffmpegArgs.push(...codecExtraArgs);
  }
  
  if (job.params?.extraArgs && Array.isArray(job.params.extraArgs)) {
    ffmpegArgs.push(...job.params.extraArgs);
  }
  ffmpegArgs.push(
    ...getCodecAudioArgs(job.codec, targetPath ?? job.output_path),
    targetPath ?? job.output_path
  );
  return ffmpegArgs;
}


function buildBitrateOverride(bitrate, config) {
  if (!Number.isFinite(bitrate) || bitrate <= 0) {
    return null;
  }
  const minBitrate = config.vmaf.minBitrateKbps;
  const maxBitrate = config.vmaf.maxBitrateKbps;
  const normalized = Math.max(
    minBitrate,
    Math.min(maxBitrate, Math.round(bitrate))
  );
  
  // 使用配置的ABR因子（从硬编码改为可配置）
  const abrConfig = config.abr || {};
  const minrateFactor = abrConfig.minrateFactor || 0.7;
  const maxrateFactor = abrConfig.maxrateFactor || 1.15;
  const bufsizeFactor = abrConfig.bufsizeFactor || 2;
  
  return {
    mode: "bitrate",
    bitrateKbps: normalized,
    maxrateKbps: Math.min(maxBitrate, Math.round(normalized * maxrateFactor)),
    minrateKbps: Math.max(minBitrate, Math.round(normalized * minrateFactor)),
    bufsizeKbps: Math.round(normalized * bufsizeFactor),
  };
}


function decideNextBitrate(current, metrics, targets, config) {
  if (!targets || !Number.isFinite(current)) {
    return null;
  }
  const score = Number(metrics?.vmafScore);
  if (!Number.isFinite(score)) {
    return null;
  }
  const minBitrate = config.vmaf.minBitrateKbps;
  const maxBitrate = config.vmaf.maxBitrateKbps;
  const increaseFactor = config.vmaf.bitrateIncreaseFactor;
  const decreaseFactor = config.vmaf.bitrateDecreaseFactor;

  if (score < targets.min) {
    const next = Math.min(maxBitrate, Math.round(current * increaseFactor));
    return next !== current ? next : null;
  }
  if (score > targets.max) {
    const next = Math.max(minBitrate, Math.round(current * decreaseFactor));
    return next !== current ? next : null;
  }
  return null;
}


function parseVmafTargets(params = {}) {
  const min = Number(params.vmafMin);
  const max = Number(params.vmafMax);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 100 || min > max) {
    return null;
  }
  return { min, max };
}

export {
  buildFfmpegArgs,
  buildBitrateOverride,
  decideNextBitrate,
  parseVmafTargets
};
