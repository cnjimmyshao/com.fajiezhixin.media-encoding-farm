/**
 * @file API 路由
 * @description 提供任务管理的 JSON 接口
 */
import { Router } from 'express';
import {
  createJob,
  getJobById,
  listJobs,
  updateJob
} from '../controllers/jobs.mjs';
import { cancelRunningJob } from '../services/ffmpeg-runner.mjs';
import { existsSync, mkdirSync, accessSync, constants } from 'fs';
import { dirname } from 'path';


function normalizeJobParams(rawParams = {}) {
  const params = { ...rawParams };
  params.scale = params.scale || 'source';
  params.perScene = Boolean(params.perScene);

  // 检查是否有 VMAF 范围 (VMAF 模式)
  const vmafMin = Number(params.vmafMin);
  const vmafMax = Number(params.vmafMax);
  const hasVmafRange = Number.isFinite(vmafMin) && Number.isFinite(vmafMax) && vmafMin >= 0 && vmafMax <= 100 && vmafMin <= vmafMax;

  // 确定质量模式
  let qualityMode = params.qualityMode;
  if (!qualityMode) {
    // 自动检测模式
    if (params.bitrateKbps) {
      qualityMode = 'bitrate';
    } else if (hasVmafRange) {
      qualityMode = 'vmaf';
    } else {
      qualityMode = 'crf';
    }
  }
  params.qualityMode = qualityMode;

  if (qualityMode === 'bitrate') {
    const bitrate = Number(params.bitrateKbps);
    if (!Number.isFinite(bitrate) || bitrate <= 0) {
      return { error: '码率模式需要输入有效的码率（Kbps）' };
    }
    params.bitrateKbps = Math.round(bitrate);
  } else if (qualityMode === 'crf') {
    // CRF 模式需要 CRF 值
    if (!params.crf) {
      return { error: 'CRF 模式需要选择 CRF 值' };
    }
  } else if (qualityMode === 'vmaf') {
    // VMAF 模式不需要 CRF 或 bitrate
    // 处理 VMAF 范围
    if (hasVmafRange) {
      params.vmafMin = vmafMin;
      params.vmafMax = vmafMax;
      params.enableVmaf = true;
    } else {
      return { error: 'VMAF 模式需要设置有效的 VMAF 范围 (vmafMin, vmafMax)' };
    }
  }

  // 删除不适用的参数
  if (qualityMode !== 'bitrate') {
    delete params.bitrateKbps;
  }
  if (qualityMode !== 'crf') {
    delete params.crf;
  }
  if (qualityMode !== 'vmaf' && !hasVmafRange) {
    delete params.vmafMin;
    delete params.vmafMax;
  }

  // 场景编码检查
  if (params.perScene) {
    if (!hasVmafRange) {
      return { error: '场景编码需要设置有效的 VMAF 范围' };
    }
    const sceneThreshold = Number(params.sceneThreshold);
    if (!Number.isFinite(sceneThreshold) || sceneThreshold <= 0 || sceneThreshold > 1) {
      return { error: '场景编码需要 0-1 之间的阈值（sceneThreshold）' };
    }
    params.sceneThreshold = sceneThreshold;
  } else {
    delete params.sceneThreshold;
  }

  params.enableVmaf = Boolean(params.enableVmaf || hasVmafRange);

  return params;
}

const router = Router();

function assertJob(job, res) {
  if (!job) {
    res.status(404).json({ error: '任务不存在' });
    return false;
  }
  return true;
}

router.post('/jobs', async (req, res, next) => {
  try {
    let { inputPath, outputPath, codec, impl } = req.body ?? {};
    let params = req.body?.params ?? {};

    // 验证必需参数
    if (!inputPath || !outputPath || !codec || !impl) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }

    // 规范化路径（处理Windows反斜杠和引号）
    try {
      // 1. 去除首尾引号（用户可能输入 "D:/path" 或 'D:/path'）
      inputPath = inputPath.replace(/^["']|["']$/g, '').trim();
      outputPath = outputPath.replace(/^["']|["']$/g, '').trim();

      // 2. 确保路径使用正斜杠（Node.js跨平台兼容）
      inputPath = inputPath.replace(/\\/g, '/');
      outputPath = outputPath.replace(/\\/g, '/');

      // 3. 去除多余空格
      inputPath = inputPath.replace(/\s+/g, ' ').trim();
      outputPath = outputPath.replace(/\s+/g, ' ').trim();

      // 4. Windows盘符验证（确保格式正确）
      if (process.platform === 'win32') {
        // 验证路径格式（不允许file://或///格式）
        if (inputPath.match(/^[a-zA-Z]:\/\/.*$/) || inputPath.match(/^\/\/\/+/)) {
          res.status(400).json({ error: '文件路径格式错误。Windows路径示例: D:/tmp/video.mp4 或 /tmp/video.mp4' });
          return;
        }
      }

      console.log(`[API] 规范化路径 - 输入: ${inputPath}, 输出: ${outputPath}`);
    } catch (error) {
      console.warn('[API] 路径规范化失败:', error.message);
    }

    // === 输入文件存在性检查 ===
    try {
      // 检查输入文件是否存在（仅本地路径）
      if (inputPath.startsWith('/') || inputPath.match(/^[a-zA-Z]:\/.*$/i)) {
        // 绝对路径，检查文件是否存在
        if (!existsSync(inputPath)) {
          res.status(400).json({ error: `输入文件不存在: ${inputPath}` });
          return;
        }
        // 检查文件是否可读
        try {
          accessSync(inputPath, constants.R_OK);
        } catch (err) {
          res.status(400).json({ error: `输入文件不可读 (权限不足): ${inputPath}` });
          return;
        }
      } else if (!inputPath.startsWith('http://') && !inputPath.startsWith('https://')) {
        // 相对路径，转换为绝对路径后检查
        const absolutePath = new URL(inputPath, `file://${process.cwd()}/`).pathname;
        if (process.platform === 'win32') {
          // Windows: 移除前导斜杠
          const winPath = absolutePath.replace(/^\//, '');
          if (!existsSync(winPath)) {
            res.status(400).json({ error: `输入文件不存在: ${winPath}` });
            return;
          }
          try {
            accessSync(winPath, constants.R_OK);
          } catch (err) {
            res.status(400).json({ error: `输入文件不可读 (权限不足): ${winPath}` });
            return;
          }
        } else {
          // Linux/macOS
          if (!existsSync(absolutePath)) {
            res.status(400).json({ error: `输入文件不存在: ${absolutePath}` });
            return;
          }
          try {
            accessSync(absolutePath, constants.R_OK);
          } catch (err) {
            res.status(400).json({ error: `输入文件不可读 (权限不足): ${absolutePath}` });
            return;
          }
        }
      }
      console.log(`[API] ✅ 输入文件检查通过: ${inputPath}`);
    } catch (error) {
      console.error('[API] 输入文件检查失败:', error.message);
      res.status(500).json({ error: `输入文件检查失败: ${error.message}` });
      return;
    }

    // === 输出目录可写性检查 ===
    try {
      const outputDir = dirname(outputPath);

      // 检查输出目录是否存在
      if (!existsSync(outputDir)) {
        // 目录不存在，尝试创建
        try {
          mkdirSync(outputDir, { recursive: true });
          console.log(`[API] ✅ 创建输出目录: ${outputDir}`);
        } catch (err) {
          res.status(400).json({ error: `无法创建输出目录: ${outputDir} - ${err.message}` });
          return;
        }
      }

      // 检查目录是否可写
      try {
        accessSync(outputDir, constants.W_OK);
      } catch (err) {
        res.status(400).json({ error: `输出目录不可写 (权限不足): ${outputDir}` });
        return;
      }

      console.log(`[API] ✅ 输出目录检查通过: ${outputDir}`);
    } catch (error) {
      console.error('[API] 输出目录检查失败:', error.message);
      res.status(500).json({ error: `输出目录检查失败: ${error.message}` });
      return;
    }

    // 规范化其他参数
    params = normalizeJobParams(params);
    if (params.error) {
      res.status(400).json({ error: params.error });
      return;
    }

    // console.log('创建新任务', { inputPath, outputPath, codec, impl, params });
    const job = await createJob({
      inputPath,
      outputPath,
      codec,
      impl,
      params
    });
    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
});

router.get('/jobs', async (req, res, next) => {
  try {
    const { status } = req.query;
    const jobs = await listJobs(status ? { status } : {});
    res.json({ items: jobs });
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/:id', async (req, res, next) => {
  try {
    const job = await getJobById(req.params.id);
    if (!assertJob(job, res)) return;
    res.json(job);
  } catch (error) {
    next(error);
  }
});

router.post('/jobs/:id/cancel', async (req, res, next) => {
  try {
    const job = await getJobById(req.params.id);
    if (!assertJob(job, res)) return;
    if (job.status === 'success') {
      res.status(400).json({ error: '已完成任务不可取消' });
      return;
    }
    if (job.status === 'running') {
      cancelRunningJob(job.id);
    }
    const updated = await updateJob(job.id, { status: 'canceled' });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post('/jobs/:id/retry', async (req, res, next) => {
  try {
    const job = await getJobById(req.params.id);
    if (!assertJob(job, res)) return;
    if (!['failed', 'canceled'].includes(job.status)) {
      res.status(400).json({ error: '仅失败或取消的任务可重试' });
      return;
    }
    const updated = await updateJob(job.id, { status: 'queued', progress: 0, error_msg: null });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
