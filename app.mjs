/**
 * @file 应用入口
 * @description 初始化 Express 服务与任务调度器
 */
import express from "express";
import morgan from "morgan";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import defaultConfig from "./config/default.mjs";
import apiRoutes from "./src/routes/api.mjs";
import webRoutes from "./src/routes/web.mjs";
import { startScheduler } from "./src/scheduler.mjs";
import { detectEncoderSupport } from "./src/services/hardware-capabilities.mjs";
import logger from "./src/services/logger.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * @description 合并环境变量配置
 * @returns {object} 配置对象
 */
function buildConfig() {
  const config = JSON.parse(JSON.stringify(defaultConfig));
  if (process.env.PORT) config.server.port = Number(process.env.PORT);
  if (process.env.WORKSPACE_PATH)
    config.paths.workspace = process.env.WORKSPACE_PATH;
  if (process.env.FFMPEG_BIN) config.ffmpeg.bin = process.env.FFMPEG_BIN;
  if (process.env.FFPROBE_BIN) config.ffmpeg.ffprobe = process.env.FFPROBE_BIN;
  if (process.env.FFMPEG_TIMEOUT_FACTOR) {
    config.ffmpeg.timeoutFactor = Number(process.env.FFMPEG_TIMEOUT_FACTOR);
  }
  if (process.env.VMAF_TIMEOUT_SEC) {
    config.ffmpeg.vmaf.timeoutSec = Number(process.env.VMAF_TIMEOUT_SEC);
  }
  if (process.env.VMAF_MODEL) {
    config.ffmpeg.vmaf.model = process.env.VMAF_MODEL;
  }
  if (process.env.VMAF_N_THREADS) {
    config.ffmpeg.vmaf.n_threads = Number(process.env.VMAF_N_THREADS);
  }
  if (process.env.VMAF_N_SUBSAMPLE) {
    config.ffmpeg.vmaf.n_subsample = Number(process.env.VMAF_N_SUBSAMPLE);
  }
  if (process.env.VMAF_FPS) {
    config.ffmpeg.vmaf.fps = Number(process.env.VMAF_FPS);
  }
  return config;
}

const config = buildConfig();
await mkdir(config.paths.workspace, { recursive: true });
const encoderSupport = await detectEncoderSupport(config.ffmpeg.bin);

// 检测CUDA支持
const cudaInfo = await detectCudaSupport(config.ffmpeg.bin);
if (cudaInfo.enabled) {
  config.cuda = {
    ...config.cuda,
    enabled: true,
    hasCudaSupport: true,
    device: 0,
    gpuInfo: cudaInfo.gpuInfo,
  };
  console.log(`检测到CUDA支持: ${cudaInfo.gpuInfo || "NVIDIA GPU"}`);
} else {
  config.cuda = {
    ...config.cuda,
    enabled: false,
    hasCudaSupport: false,
  };
}

const app = express();
app.set("views", join(__dirname, "views"));
app.set("view engine", "pug");
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(join(__dirname, "src/public")));
app.locals.encoderSupport = encoderSupport;

app.use("/", webRoutes);
app.use("/api", apiRoutes);

app.use((err, req, res, next) => {
  logger.error("请求处理异常", err);
  if (req.accepts("json")) {
    res.status(500).json({ error: "服务器内部错误" });
  } else {
    res.status(500).send("服务器内部错误");
  }
});

const server = app.listen(config.server.port, () => {
  logger.info(`服务器已启动：http://localhost:${config.server.port}`);
  startScheduler(config);
});

export default server;
