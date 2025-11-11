/**
 * @file impl-libvpx-vp9
 * @description libvpx-vp9 (VP9) 编码器实现
 */

export const libvpxVp9Config = {
  label: 'libvpx-vp9（CPU）',
  baseArgs: ['-c:v', 'libvpx-vp9'],
  qualityFlag: '-crf',
  qualityRange: { min: 28, max: 38, default: 34 },
  
  // VP9需要特殊处理: CRF模式需要-b:v 0
  crfRequiresZeroBitrate: true,
  
  presets: [
    { key: 'cpu-8', label: 'CPU 8（极速）', args: ['-cpu-used', '8', '-row-mt', '1'] },
    { key: 'cpu-7', label: 'CPU 7（更快）', args: ['-cpu-used', '7', '-row-mt', '1'] },
    { key: 'cpu-6', label: 'CPU 6（最快）', args: ['-cpu-used', '6', '-row-mt', '1'] },
    { key: 'cpu-5', label: 'CPU 5（很快）', args: ['-cpu-used', '5', '-row-mt', '1'] },
    { key: 'cpu-4', label: 'CPU 4（均衡）', args: ['-cpu-used', '4', '-row-mt', '1'] },
    { key: 'cpu-3', label: 'CPU 3（较慢）', args: ['-cpu-used', '3', '-row-mt', '1'] },
    { key: 'cpu-2', label: 'CPU 2（高质量）', args: ['-cpu-used', '2', '-row-mt', '1'] },
    { key: 'cpu-1', label: 'CPU 1（更高质量）', args: ['-cpu-used', '1', '-row-mt', '1'] },
    { key: 'cpu-0', label: 'CPU 0（极致质量）', args: ['-cpu-used', '0', '-row-mt', '1'] }
  ],
  
  profiles: [
    {
      key: 'profile0',
      label: 'Profile 0（8-bit）',
      args: ['-profile:v', '0', '-pix_fmt', 'yuv420p'],
      defaultPreset: 'cpu-4',
      defaultCrf: '34'
    },
    {
      key: 'profile2',
      label: 'Profile 2（10-bit）',
      args: ['-profile:v', '2', '-pix_fmt', 'yuv420p10le'],
      defaultPreset: 'cpu-2',
      defaultCrf: '30'
    },
    {
      key: 'profile3',
      label: 'Profile 3（4:4:4）',
      args: ['-profile:v', '3', '-pix_fmt', 'yuv444p'],
      defaultPreset: 'cpu-2',
      defaultCrf: '28'
    }
  ],
  
  crfOptions: [
    { key: '38', label: 'CRF 38（最快）', value: '38' },
    { key: '34', label: 'CRF 34（均衡）', value: '34' },
    { key: '30', label: 'CRF 30（高质量）', value: '30' },
    { key: '28', label: 'CRF 28（极致质量）', value: '28' }
  ],
  
  // VP9需要多线程优化
  extraArgs: ['-row-mt', '1'],
  
  // 像素格式
  pixelFormat: 'yuv420p'
};

export default libvpxVp9Config;
