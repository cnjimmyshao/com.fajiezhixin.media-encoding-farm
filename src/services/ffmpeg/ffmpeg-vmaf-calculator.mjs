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
  options = {}
) {
  const { reportPath } = options;
  const logPath = reportPath || `${distortedPath}.vmaf.json`;

  // 使用简化的VMAF参数
  const modelVersion = 'vmaf_v0.6.1';
  const nThreads = 4;
  const nSubsample = 1;

  // 添加分辨率缩放以确保两个输入分辨率匹配
  const filterGraph = `[0:v]setpts=PTS-STARTPTS[dist_main];[1:v]setpts=PTS-STARTPTS[ref_in];[ref_in][dist_main]scale2ref=flags=bicubic[ref_scaled][dist_scaled];[dist_scaled][ref_scaled]libvmaf=model='version=${modelVersion}':n_threads=${nThreads}:n_subsample=${nSubsample}:log_fmt=json:log_path=${logPath}`;

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

  const [code] = await once(child, "close");

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


export {
  computeVmafScore,
  isVmafWithin
};
