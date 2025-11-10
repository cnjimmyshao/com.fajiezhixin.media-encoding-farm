/**
 * @file 默认配置
 * @description 提供服务器、路径与 ffmpeg 相关默认常量
 */
export const defaultConfig = {
  server: {
    port: 3000
  },
  paths: {
    workspace: '/tmp/vef'
  },
  ffmpeg: {
    bin: 'ffmpeg',
    ffprobe: 'ffprobe',
    timeoutFactor: 5,
    vmaf: {
      timeoutSec: 300,
      model: 'version=vmaf_v0.6.1',
      n_threads: 8,
      n_subsample: 12
    }
  },
  scheduler: {
    loopInterval: 2000
  }
};

export default defaultConfig;
