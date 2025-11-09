/**
 * @file 预设定义
 * @description 提供编码器预设选项
 */
export const videoPresets = {
  'av1:svt-av1:baseline': {
    label: 'AV1 / SVT-AV1 / baseline',
    args: ['-c:v', 'libsvtav1', '-crf', '32', '-preset', '6', '-pix_fmt', 'yuv420p10le']
  },
  'hevc:x265:baseline': {
    label: 'HEVC / x265 / baseline',
    args: ['-c:v', 'libx265', '-crf', '24', '-preset', 'medium', '-pix_fmt', 'yuv420p']
  },
  'h264:x264:baseline': {
    label: 'H.264 / x264 / baseline',
    args: ['-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-pix_fmt', 'yuv420p']
  }
};

/**
 * @description 获取音频编码参数
 * @returns {string[]} 音频参数数组
 */
export function audioArgs() {
  return ['-c:a', 'aac', '-b:a', '128k'];
}

export default videoPresets;
