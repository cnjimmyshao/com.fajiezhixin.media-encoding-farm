/**
 * @file 默认配置
 * @description 提供服务器、路径与 ffmpeg 相关默认常量
 */
export const defaultConfig = {
  server: {
    port: 3000,
  },
  scheduler: {
    loopInterval: 1000,
  },
  paths: {
    workspace: "/tmp/vef",
  },
  ffmpeg: {
    bin: "ffmpeg",
    ffprobe: "ffprobe",
    timeoutFactor: 5,
  },
  vmaf: {
    modelVersion: "vmaf_v0.6.1",
    maxTuningAttempts: 8,
    minBitrateKbps: 200,
    maxBitrateKbps: 80000,
    bitrateIncreaseFactor: 1.15,
    bitrateDecreaseFactor: 0.9,
    nThreads: 4,
    nSubsample: 5,
  },
  sceneDetection: {
    threshold: 0.4, // 场景检测阈值 (0.01-1.0)，值越小越敏感
  },
  encoding: {
    gopLength: 60, // GOP长度（帧数），场景编码时会根据场景边界调整
    keyintMin: 30, // 最小关键帧间隔
    scThreshold: 0, // 禁用自动场景检测（我们自己控制场景边界）
  },
  abr: {
    // ABR (Average Bitrate) 模式参数
    // ABR是CBR和CRF的折中方案，适合媒体存储和点播场景
    minrateFactor: 0.7, // 最小码率因子 (target × 0.7)
    maxrateFactor: 1.15, // 最大码率因子 (target × 1.15)
    bufsizeFactor: 2, // 缓冲区因子 (target × 2)
    // 说明:
    // - minrateFactor: 静态画面时允许的最低码率，节省空间
    // - maxrateFactor: 复杂画面时允许的最高码率，保证质量
    // - bufsizeFactor: 控制码率波动的平滑程度，越大越平滑
  },
  cuda: {
    enabled: false, // 是否启用CUDA加速（自动检测）
    device: 0, // CUDA设备ID
    hasCudaSupport: false, // 系统是否支持CUDA（运行时检测）
  },
};

export default defaultConfig;
