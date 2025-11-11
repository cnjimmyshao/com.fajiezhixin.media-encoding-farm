/**
 * @file impl-svt-av1
 * @description SVT-AV1 (AV1) 编码器实现
 */

export const svtAv1Config = {
  label: 'SVT-AV1（CPU）',
  baseArgs: ['-c:v', 'libsvtav1'],
  qualityFlag: '-crf',
  qualityRange: { min: 26, max: 36, default: 32 },
  
  // SVT-AV1默认使用10-bit
  defaultPixelFormat: 'yuv420p10le',
  
  presets: [
    { key: 'speed-10', label: 'Preset 10（极速）', args: ['-preset', '10'] },
    { key: 'speed-8', label: 'Preset 8（更快）', args: ['-preset', '8'] },
    { key: 'speed-6', label: 'Preset 6（均衡）', args: ['-preset', '6'] },
    { key: 'speed-4', label: 'Preset 4（高质量）', args: ['-preset', '4'] },
    { key: 'speed-2', label: 'Preset 2（极致质量）', args: ['-preset', '2'] }
  ],
  
  profiles: [
    {
      key: 'baseline',
      label: '标准 10-bit',
      args: ['-pix_fmt', 'yuv420p10le'],
      defaultPreset: 'speed-6',
      defaultCrf: '32'
    },
    {
      key: 'quality',
      label: '高质量 10-bit',
      args: ['-pix_fmt', 'yuv420p10le'],
      defaultPreset: 'speed-4',
      defaultCrf: '28'
    },
    {
      key: 'archival',
      label: '存档 10-bit',
      args: ['-pix_fmt', 'yuv420p10le'],
      defaultPreset: 'speed-2',
      defaultCrf: '26'
    }
  ],
  
  crfOptions: [
    { key: '36', label: 'CRF 36（快速）', value: '36' },
    { key: '32', label: 'CRF 32（均衡）', value: '32' },
    { key: '28', label: 'CRF 28（高质量）', value: '28' },
    { key: '26', label: 'CRF 26（极致质量）', value: '26' }
  ],
  
  // AV1 10-bit是标准
  extraArgs: ['-pix_fmt', 'yuv420p10le'],
  
  // 像素格式
  pixelFormat: 'yuv420p10le'
};

export default svtAv1Config;
