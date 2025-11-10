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
    timeoutFactor: 5
  },
  scheduler: {
    loopInterval: 2000
  }
};

export default defaultConfig;
