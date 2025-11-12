/**
 * @file impl-h264-qsv
 * @description Intel QSV H.264 硬件编码器实现
 */

export const h264QsvConfig = {
  label: 'Intel H.264（QSV）',
  requiresHardware: true,
  ffmpegEncoder: 'h264_qsv',
  baseArgs: ['-c:v', 'h264_qsv'],
  qualityFlag: '-global_quality',
  qualityRange: { min: 24, max: 32, default: 28 },

  presets: [
    { key: 'veryfast', label: 'Veryfast（最快）', args: ['-preset', 'veryfast'] },
    { key: 'faster', label: 'Faster（更快）', args: ['-preset', 'faster'] },
    { key: 'fast', label: 'Fast（快速）', args: ['-preset', 'fast'] },
    { key: 'medium', label: 'Medium（均衡）', args: ['-preset', 'medium'] },
    { key: 'slow', label: 'Slow（高质量）', args: ['-preset', 'slow'] }
  ],

  profiles: [
    {
      key: 'baseline',
      label: 'Baseline',
      args: ['-profile:v', 'baseline', '-pix_fmt', 'yuv420p'],
      defaultPreset: 'veryfast',
      defaultCrf: '30'
    },
    {
      key: 'main',
      label: 'Main',
      args: ['-profile:v', 'main', '-pix_fmt', 'yuv420p'],
      defaultPreset: 'medium',
      defaultCrf: '26'
    },
    {
      key: 'high',
      label: 'High',
      args: ['-profile:v', 'high', '-pix_fmt', 'yuv420p10le'],
      defaultPreset: 'slow',
      defaultCrf: '24'
    }
  ],

  crfOptions: [
    { key: '32', label: 'Quality 32（快速）', value: '32' },
    { key: '28', label: 'Quality 28（均衡）', value: '28' },
    { key: '24', label: 'Quality 24（高质量）', value: '24' }
  ],

  extraArgs: [],
  pixelFormat: 'yuv420p'
};

export default h264QsvConfig;
