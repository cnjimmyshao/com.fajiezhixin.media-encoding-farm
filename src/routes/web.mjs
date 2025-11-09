/**
 * @file 页面路由
 * @description 渲染任务相关页面
 */
import { Router } from 'express';
import { listJobs, getJobById } from '../controllers/jobs.mjs';
import { videoPresets } from '../services/presets.mjs';

const router = Router();
const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

router.get('/', (req, res) => {
  res.redirect('/jobs');
});

router.get('/jobs', async (req, res, next) => {
  try {
    const jobs = await listJobs();
    res.render('jobs-list', {
      title: '任务列表',
      jobs,
      formatDate: (value) => (value ? dateFormatter.format(new Date(value)) : '')
    });
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/new', (req, res) => {
  res.render('jobs-new', {
    title: '新建任务',
    presets: Object.entries(videoPresets).map(([key, preset]) => ({
      key,
      label: preset.label
    }))
  });
});

router.get('/jobs/:id', async (req, res, next) => {
  try {
    const job = await getJobById(req.params.id);
    if (!job) {
      res.status(404).render('jobs-show', { title: '任务不存在', job: null });
      return;
    }
    res.render('jobs-show', {
      title: '任务详情',
      job,
      formatDate: (value) => (value ? dateFormatter.format(new Date(value)) : '')
    });
  } catch (error) {
    next(error);
  }
});

export default router;
