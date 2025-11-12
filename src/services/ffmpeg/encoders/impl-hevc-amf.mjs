/**
 * @file impl-hevc-amf
 * @description AMD AMF HEVC/H.265 硬件编码器实现
 */

export const hevcAmfConfig = {
  label: 'AMD HEVC（AMF）',
  requiresHardware: true,
  ffmpegEncoder: 'hevc_amf',
  baseArgs: ['-c:v', 'hevc_amf'],
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
      defaultCrf: '26'
    },
    {
      key: 'main10',
      label: 'Main10（10-bit）',
      args: ['-profile:v', 'main10', '-pix_fmt', 'p010le'],
      defaultPreset: 'quality',
      defaultCrf: '20'
    }
  ],

  crfOptions: [
    { key: '28', label: 'QP 28（均衡）', value: '28' },
    { key: '24', label: 'QP 24（高质量）', value: '24' },
    { key: '20', label: 'QP 20（更高质量）', value: '20' }
  ],

  extraArgs: [],
  pixelFormat: 'yuv420p'
};

export default hevcAmfConfig;
