/**
 * @file 应用入口
 * @description 初始化 Express 服务与任务调度器
 */
import express from 'express';
import morgan from 'morgan';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import defaultConfig from './config/default.mjs';
import apiRoutes from './src/routes/api.mjs';
import webRoutes from './src/routes/web.mjs';
import {
  getNextQueuedJob,
  hasRunningJob,
  updateJob
} from './src/controllers/jobs.mjs';
import { probeDuration, runJob } from './src/services/ffmpeg-runner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * @description 合并环境变量配置
 * @returns {object} 配置对象
 */
function buildConfig() {
  const config = JSON.parse(JSON.stringify(defaultConfig));
  if (process.env.PORT) config.server.port = Number(process.env.PORT);
  if (process.env.WORKSPACE_PATH) config.paths.workspace = process.env.WORKSPACE_PATH;
  if (process.env.FFMPEG_BIN) config.ffmpeg.bin = process.env.FFMPEG_BIN;
  if (process.env.FFPROBE_BIN) config.ffmpeg.ffprobe = process.env.FFPROBE_BIN;
  if (process.env.FFMPEG_TIMEOUT_FACTOR) {
    config.ffmpeg.timeoutFactor = Number(process.env.FFMPEG_TIMEOUT_FACTOR);
  }
  return config;
}

const config = buildConfig();
await mkdir(config.paths.workspace, { recursive: true });

const app = express();
app.set('views', join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(join(__dirname, 'src/public')));

app.use('/', webRoutes);
app.use('/api', apiRoutes);

app.use((err, req, res, next) => {
  console.error('请求处理异常', err);
  if (req.accepts('json')) {
    res.status(500).json({ error: '服务器内部错误' });
  } else {
    res.status(500).send('服务器内部错误');
  }
});

const server = app.listen(config.server.port, () => {
  console.log(`服务器已启动：http://localhost:${config.server.port}`);
});

async function schedulerLoop() {
  while (true) {
    try {
      if (await hasRunningJob()) {
        await delay(2000);
        continue;
      }
      const job = await getNextQueuedJob();
      if (!job) {
        await delay(2000);
        continue;
      }
      const duration = await probeDuration(config.ffmpeg.ffprobe, job.input_path);
      if (duration === null) {
        await updateJob(job.id, {
          status: 'failed',
          error_msg: '无法通过 ffprobe 获取媒体时长'
        });
        continue;
      }
      await runJob(job, duration, config);
    } catch (error) {
      console.error('调度器异常', error);
    }
    await delay(2000);
  }
}

schedulerLoop();

export default server;
