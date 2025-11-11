/**
 * @file impl-x264
 * @description libx264 (H.264) 编码器实现
 */

export const x264Config = {
  label: 'x264（CPU）',
  baseArgs: ['-c:v', 'libx264'],
  qualityFlag: '-crf',
  qualityRange: { min: 14, max: 26, default: 23 },
  
  presets: [
    { key: 'ultrafast', label: 'Ultrafast（极速）', args: ['-preset', 'ultrafast'] },
    { key: 'superfast', label: 'Superfast（特快）', args: ['-preset', 'superfast'] },
    { key: 'veryfast', label: 'Veryfast（快速）', args: ['-preset', 'veryfast'] },
    { key: 'faster', label: 'Faster（较快）', args: ['-preset', 'faster'] },
    { key: 'fast', label: 'Fast（均衡）', args: ['-preset', 'fast'] },
    { key: 'medium', label: 'Medium（默认）', args: ['-preset', 'medium'] },
    { key: 'slow', label: 'Slow（高质量）', args: ['-preset', 'slow'] },
    { key: 'slower', label: 'Slower（更慢）', args: ['-preset', 'slower'] },
    { key: 'veryslow', label: 'Veryslow（存档）', args: ['-preset', 'veryslow'] },
    { key: 'placebo', label: 'Placebo（极致）', args: ['-preset', 'placebo'] }
  ],
  
  profiles: [
    {
      key: 'baseline',
      label: 'Baseline（兼容）',
      args: ['-profile:v', 'baseline', '-pix_fmt', 'yuv420p'],
      defaultPreset: 'veryfast',
      defaultCrf: '20'
    },
    {
      key: 'main',
      label: 'Main（通用）',
      args: ['-profile:v', 'main', '-pix_fmt', 'yuv420p'],
      defaultPreset: 'faster',
      defaultCrf: '23'
    },
    {
      key: 'hq',
      label: 'High（高质量）',
      args: ['-profile:v', 'high', '-pix_fmt', 'yuv420p10le'],
      defaultPreset: 'slow',
      defaultCrf: '18'
    },
    {
      key: 'high10',
      label: 'High10（10-bit）',
      args: ['-profile:v', 'high10', '-pix_fmt', 'yuv420p10le'],
      defaultPreset: 'slower',
      defaultCrf: '16'
    },
    {
      key: 'high444',
      label: 'High444（4:4:4）',
      args: ['-profile:v', 'high444', '-pix_fmt', 'yuv444p'],
      defaultPreset: 'veryslow',
      defaultCrf: '14'
    }
  ],
  
  crfOptions: [
    { key: '26', label: 'CRF 26（最快）', value: '26' },
    { key: '24', label: 'CRF 24（快速）', value: '24' },
    { key: '23', label: 'CRF 23（默认）', value: '23' },
    { key: '20', label: 'CRF 20（高质量）', value: '20' },
    { key: '18', label: 'CRF 18（存档）', value: '18' },
    { key: '16', label: 'CRF 16（高保真）', value: '16' },
    { key: '14', label: 'CRF 14（极致质量）', value: '14' }
  ],
  
  // 额外参数（codec-specific）
  extraArgs: [],
  
  // 像素格式
  pixelFormat: 'yuv420p'
};

export default x264Config;
