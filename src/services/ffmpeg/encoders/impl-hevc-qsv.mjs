/**
 * @file impl-hevc-qsv
 * @description Intel QSV HEVC/H.265 硬件编码器实现
 */

export const hevcQsvConfig = {
  label: 'Intel HEVC（QSV）',
  requiresHardware: true,
  ffmpegEncoder: 'hevc_qsv',
  baseArgs: ['-c:v', 'hevc_qsv'],
  qualityFlag: '-global_quality',
  qualityRange: { min: 20, max: 28, default: 24 },

  presets: [
    { key: 'veryfast', label: 'Veryfast（最快）', args: ['-preset', 'veryfast'] },
    { key: 'faster', label: 'Faster（更快）', args: ['-preset', 'faster'] },
    { key: 'fast', label: 'Fast（快速）', args: ['-preset', 'fast'] },
    { key: 'medium', label: 'Medium（均衡）', args: ['-preset', 'medium'] },
    { key: 'slow', label: 'Slow（高质量）', args: ['-preset', 'slow'] }
  ],

  profiles: [
    {
      key: 'main',
      label: 'Main（8-bit）',
      args: ['-profile:v', 'main', '-pix_fmt', 'yuv420p'],
      defaultPreset: 'medium',
      defaultCrf: '26'
    },
    {
      key: 'main10',
      label: 'Main10（10-bit）',
      args: ['-profile:v', 'main10', '-pix_fmt', 'p010le'],
      defaultPreset: 'slow',
      defaultCrf: '24'
    },
    {
      key: 'main422',
      label: 'Main422（4:2:2）',
      args: ['-profile:v', 'main422_10', '-pix_fmt', 'p210le'],
      defaultPreset: 'slow',
      defaultCrf: '22'
    }
  ],

  crfOptions: [
    { key: '30', label: 'Quality 30（快速）', value: '30' },
    { key: '26', label: 'Quality 26（均衡）', value: '26' },
    { key: '22', label: 'Quality 22（高质量）', value: '22' }
  ],

  extraArgs: [],
  pixelFormat: 'yuv420p'
};

export default hevcQsvConfig;
