/**
 * @file impl-av1-amf
 * @description AMD AMF AV1 硬件编码器实现
 */

export const av1AmfConfig = {
  label: 'AMD AV1（AMF）',
  requiresHardware: true,
  ffmpegEncoder: 'av1_amf',
  baseArgs: ['-c:v', 'av1_amf'],
  qualityFlag: '-qp',
  qualityRange: { min: 20, max: 28, default: 24 },

  presets: [
    { key: 'speed', label: 'Speed（最快）', args: ['-quality', 'speed'] },
    { key: 'balanced', label: 'Balanced（均衡）', args: ['-quality', 'balanced'] },
    { key: 'quality', label: 'Quality（高质量）', args: ['-quality', 'quality'] }
  ],

  profiles: [
    {
      key: 'main',
      label: 'Main（8-bit）',
      args: ['-profile:v', 'main', '-pix_fmt', 'yuv420p'],
      defaultPreset: 'balanced',
      defaultCrf: '28'
    },
    {
      key: 'main10',
      label: 'Main10（10-bit）',
      args: ['-profile:v', 'main10', '-pix_fmt', 'yuv420p10le'],
      defaultPreset: 'balanced',
      defaultCrf: '24'
    }
  ],

  crfOptions: [
    { key: '32', label: 'QP 32（快速）', value: '32' },
    { key: '28', label: 'QP 28（均衡）', value: '28' },
    { key: '24', label: 'QP 24（高质量）', value: '24' }
  ],

  extraArgs: [],
  pixelFormat: 'yuv420p'
};

export default av1AmfConfig;
