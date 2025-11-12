/**
 * @file impl-av1-nvenc
 * @description NVIDIA NVENC AV1 硬件编码器实现
 */

export const av1NvencConfig = {
  label: 'NVIDIA AV1（NVENC）',
  requiresHardware: true,
  ffmpegEncoder: 'av1_nvenc',
  baseArgs: ['-c:v', 'av1_nvenc'],
  qualityFlag: '-cq',
  qualityRange: { min: 20, max: 32, default: 28 },

  presets: [
    { key: 'p1', label: 'P1（最快）', args: ['-preset', 'p1'] },
    { key: 'p4', label: 'P4（均衡）', args: ['-preset', 'p4'] },
    { key: 'p7', label: 'P7（最高质量）', args: ['-preset', 'p7'] }
  ],

  profiles: [
    {
      key: 'main',
      label: 'Main（8-bit）',
      args: ['-profile:v', 'main', '-pix_fmt', 'yuv420p'],
      defaultPreset: 'p4',
      defaultCrf: '28'
    },
    {
      key: 'main10',
      label: 'Main10（10-bit）',
      args: ['-profile:v', 'main10', '-pix_fmt', 'p010le'],
      defaultPreset: 'p4',
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

export default av1NvencConfig;
