/**
 * @file impl-x265
 * @description libx265 (HEVC/H.265) 编码器实现
 */

export const x265Config = {
  label: 'x265（CPU）',
  baseArgs: ['-c:v', 'libx265'],
  qualityFlag: '-crf',
  qualityRange: { min: 18, max: 28, default: 24 },
  
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
      label: 'Main（8-bit）',
      args: ['-profile:v', 'main', '-pix_fmt', 'yuv420p'],
      defaultPreset: 'medium',
      defaultCrf: '24'
    },
    {
      key: 'hq',
      label: 'Main10（10-bit）',
      args: ['-profile:v', 'main10', '-pix_fmt', 'yuv420p10le'],
      defaultPreset: 'slow',
      defaultCrf: '20'
    },
    {
      key: 'still',
      label: 'Main Still Picture',
      args: ['-profile:v', 'mainstillpicture', '-pix_fmt', 'yuv420p'],
      defaultPreset: 'slower',
      defaultCrf: '18'
    }
  ],
  
  crfOptions: [
    { key: '28', label: 'CRF 28（极速）', value: '28' },
    { key: '26', label: 'CRF 26（快速）', value: '26' },
    { key: '24', label: 'CRF 24（均衡）', value: '24' },
    { key: '22', label: 'CRF 22（高质量）', value: '22' },
    { key: '20', label: 'CRF 20（更高质量）', value: '20' },
    { key: '18', label: 'CRF 18（极致质量）', value: '18' }
  ],
  
  extraArgs: [],
  pixelFormat: 'yuv420p'
};

export default x265Config;
