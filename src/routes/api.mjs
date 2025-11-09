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
    const { inputPath, outputPath, codec, impl, params = {} } = req.body ?? {};
    if (!inputPath || !outputPath || !codec || !impl) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }
    const job = await createJob({ inputPath, outputPath, codec, impl, params });
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
