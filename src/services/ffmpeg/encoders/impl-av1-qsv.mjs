/**
 * @file impl-av1-qsv
 * @description Intel QSV AV1 硬件编码器实现
 */

export const av1QsvConfig = {
  label: 'Intel AV1（QSV）',
  requiresHardware: true,
  ffmpegEncoder: 'av1_qsv',
  baseArgs: ['-c:v', 'av1_qsv'],
  qualityFlag: '-q',
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
      args: ['-profile:v', 'main', '-pix_fmt', 'nv12'],
      defaultPreset: 'medium',
      defaultCrf: '28'
    },
    {
      key: 'main10',
      label: 'Main10（10-bit）',
      args: ['-profile:v', 'main10', '-pix_fmt', 'p010le'],
      defaultPreset: 'medium',
      defaultCrf: '24'
    }
  ],

  crfOptions: [
    { key: '32', label: 'Q 32（快速）', value: '32' },
    { key: '28', label: 'Q 28（均衡）', value: '28' },
    { key: '24', label: 'Q 24（高质量）', value: '24' }
  ],

  extraArgs: [],
  pixelFormat: 'nv12'
};

export default av1QsvConfig;
