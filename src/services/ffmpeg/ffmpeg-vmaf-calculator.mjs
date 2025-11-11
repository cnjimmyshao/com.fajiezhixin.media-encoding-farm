/**
 * @file vmaf calculator
 * @description VMAF计算、质量评估
 */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { stat } from 'node:fs/promises';

async function computeVmafScore(
  ffmpegBin,
  distortedPath,
  referencePath,
  config,
  timeoutMs = 0
) {
  const logPath = `${distortedPath}.vmaf.json`;
  const modelVersion = config.vmaf.modelVersion;
  const nThreads = config.vmaf.nThreads;
  const nSubsample = config.vmaf.nSubsample;
  
  // 检测CUDA支持
  let cudaInfo = null;
  if (config.cuda?.enabled !== false) {
    try {
      cudaInfo = await detectCudaSupport(ffmpegBin);
      if (cudaInfo.enabled) {
        console.log(`VMAF: 检测到CUDA支持，使用GPU加速 (${cudaInfo.gpuInfo || 'NVIDIA GPU'})`);
      }
    } catch (error) {
      console.log('VMAF: CUDA检测失败，使用CPU版本:', error.message);
    }
  }
  
  // 获取视频分辨率信息
  const [distortedInfo, referenceInfo] = await Promise.all([
    getVideoInfo(config.ffmpeg.ffprobe, distortedPath),
    getVideoInfo(config.ffmpeg.ffprobe, referencePath)
  ]);
  
  if (!distortedInfo.width || !distortedInfo.height) {
    throw new Error('无法获取输出视频分辨率');
  }
  
  // 构建filter graph，处理分辨率不匹配的情况
  let filterGraph;
  if (!referenceInfo.width || !referenceInfo.height) {
    // 如果无法获取参考视频分辨率，直接计算（可能会失败）
    filterGraph = cudaInfo?.enabled ? 
      `[0:v]setpts=PTS-STARTPTS[dist];[1:v]setpts=PTS-STARTPTS[ref];[dist][ref]libvmaf_cuda=model='version=${modelVersion}':n_threads=${nThreads}:n_subsample=${nSubsample}:log_fmt=json:log_path=${logPath}` :
      `[0:v]setpts=PTS-STARTPTS[dist];[1:v]setpts=PTS-STARTPTS[ref];[dist][ref]libvmaf=model='version=${modelVersion}':n_threads=${nThreads}:n_subsample=${nSubsample}:log_fmt=json:log_path=${logPath}`;
  } else if (distortedInfo.width === referenceInfo.width && distortedInfo.height === referenceInfo.height) {
    // 分辨率相同，直接计算
    filterGraph = cudaInfo?.enabled ?
      `[0:v]setpts=PTS-STARTPTS[dist];[1:v]setpts=PTS-STARTPTS[ref];[dist][ref]libvmaf_cuda=model='version=${modelVersion}':n_threads=${nThreads}:n_subsample=${nSubsample}:log_fmt=json:log_path=${logPath}` :
      `[0:v]setpts=PTS-STARTPTS[dist];[1:v]setpts=PTS-STARTPTS[ref];[dist][ref]libvmaf=model='version=${modelVersion}':n_threads=${nThreads}:n_subsample=${nSubsample}:log_fmt=json:log_path=${logPath}`;
  } else {
    // 分辨率不同，将参考视频缩放到与输出视频相同的分辨率
    console.log(`VMAF: 分辨率不匹配，将参考视频从 ${referenceInfo.width}x${referenceInfo.height} 缩放到 ${distortedInfo.width}x${distortedInfo.height}`);
    filterGraph = cudaInfo?.enabled ?
      `[0:v]setpts=PTS-STARTPTS[dist];[1:v]setpts=PTS-STARTPTS[ref];[ref]scale=${distortedInfo.width}:${distortedInfo.height}[ref_scaled];[dist][ref_scaled]libvmaf_cuda=model='version=${modelVersion}':n_threads=${nThreads}:n_subsample=${nSubsample}:log_fmt=json:log_path=${logPath}` :
      `[0:v]setpts=PTS-STARTPTS[dist];[1:v]setpts=PTS-STARTPTS[ref];[ref]scale=${distortedInfo.width}:${distortedInfo.height}[ref_scaled];[dist][ref_scaled]libvmaf=model='version=${modelVersion}':n_threads=${nThreads}:n_subsample=${nSubsample}:log_fmt=json:log_path=${logPath}`;
  }
  
  const args = [
    "-loglevel",
    "error",
    "-hide_banner",
    "-i",
    distortedPath,
    "-i",
    referencePath,
    "-lavfi",
    filterGraph,
    "-f",
    "null",
    "-",
  ];
  const child = spawn(ffmpegBin, args, {
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const closePromise = once(child, "close");
  const timeoutPromise =
    timeoutMs > 0
      ? new Promise((_, reject) => {
          setTimeout(() => {
            child.kill("SIGKILL");
            reject(new Error(`VMAF 计算超时 (${timeoutMs}ms)`));
          }, timeoutMs);
        })
      : null;

  const [code] = timeoutPromise
    ? await Promise.race([closePromise, timeoutPromise])
    : await closePromise;

  if (code !== 0) {
    console.error("VMAF stderr:", stderr);
    throw new Error(`VMAF 计算失败，退出码 ${code}`);
  }

  try {
    const fs = await import("fs/promises");
    const logContent = await fs.readFile(logPath, "utf8");
    const payload = JSON.parse(logContent);

    if (!payload || typeof payload !== "object") {
      throw new Error("无效的 VMAF JSON 格式");
    }

    const frames = Array.isArray(payload.frames) ? payload.frames : [];
    if (frames.length === 0) {
      throw new Error("VMAF JSON 中没有帧数据");
    }

    const frameScores = frames
      .map((f) => {
        const vmafScore = f?.metrics?.vmaf;
        return typeof vmafScore === "number" ? vmafScore : null;
      })
      .filter((v) => v !== null);

    if (frameScores.length === 0) {
      throw new Error("没有有效的 VMAF 分数");
    }

    const sum = frameScores.reduce((acc, score) => acc + score, 0);
    const mean = sum / frameScores.length;
    const min = Math.min(...frameScores);
    const max = Math.max(...frameScores);

    return {
      mean: Number(mean.toFixed(3)),
      min: Number(min.toFixed(3)),
      max: Number(max.toFixed(3)),
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("VMAF JSON 文件未生成");
    }
    throw new Error(`读取 VMAF JSON 失败: ${error.message}`);
  }
}


function isVmafWithin(metrics, targets) {
  if (!metrics) return false;
  const score = Number(metrics.vmafScore);
  if (!Number.isFinite(score)) {
    return false;
  }
  return score >= targets.min && score <= targets.max;
}

async function getVideoInfo(ffprobeBin, inputPath) {
  return new Promise((resolve) => {
    const args = [
      "-loglevel",
      "error",
      "-hide_banner",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      inputPath,
    ];
    const child = spawn(ffprobeBin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("close", (code) => {
      if (code !== 0) {
        resolve({ width: null, height: null });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        const stream = data?.streams?.[0];
        resolve({ width: stream?.width, height: stream?.height });
      } catch {
        resolve({ width: null, height: null });
      }
    });
    child.on("error", () => resolve({ width: null, height: null }));
  });
}


export {
  computeVmafScore,
  isVmafWithin
};
