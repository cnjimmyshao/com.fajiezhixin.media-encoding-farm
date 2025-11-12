/**
 * @file impl-h264-nvenc
 * @description NVIDIA NVENC H.264 硬件编码器实现
 */

export const h264NvencConfig = {
  label: 'NVIDIA H.264（NVENC）',
  requiresHardware: true,
  ffmpegEncoder: 'h264_nvenc',
  baseArgs: ['-c:v', 'h264_nvenc'],
  qualityFlag: '-cq',
  qualityRange: { min: 20, max: 32, default: 28 },

  presets: [
    { key: 'p1', label: 'P1（最快）', args: ['-preset', 'p1'] },
    { key: 'p2', label: 'P2（快速）', args: ['-preset', 'p2'] },
    { key: 'p3', label: 'P3（均衡）', args: ['-preset', 'p3'] },
    { key: 'p4', label: 'P4（标准）', args: ['-preset', 'p4'] },
    { key: 'p5', label: 'P5（高质量）', args: ['-preset', 'p5'] },
    { key: 'p6', label: 'P6（更高质量）', args: ['-preset', 'p6'] },
    { key: 'p7', label: 'P7（最高质量）', args: ['-preset', 'p7'] }
  ],

  profiles: [
    {
      key: 'baseline',
      label: 'Baseline',
      args: ['-profile:v', 'baseline', '-pix_fmt', 'yuv420p'],
      defaultPreset: 'p4',
      defaultCrf: '28'
    },
    {
      key: 'main',
      label: 'Main',
      args: ['-profile:v', 'main', '-pix_fmt', 'yuv420p'],
      defaultPreset: 'p4',
      defaultCrf: '26'
    },
    {
      key: 'high',
      label: 'High（10-bit）',
      args: ['-profile:v', 'high', '-pix_fmt', 'p010le'],
      defaultPreset: 'p7',
      defaultCrf: '24'
    }
  ],

  crfOptions: [
    { key: '32', label: 'CQ 32（快速）', value: '32' },
    { key: '28', label: 'CQ 28（均衡）', value: '28' },
    { key: '24', label: 'CQ 24（高质量）', value: '24' }
  ],

  extraArgs: [],
  pixelFormat: 'yuv420p'
};

export default h264NvencConfig;
