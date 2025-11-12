/**
 * @file impl-h264-amf
 * @description AMD AMF H.264 硬件编码器实现
 */

export const h264AmfConfig = {
  label: 'AMD H.264（AMF）',
  requiresHardware: true,
  ffmpegEncoder: 'h264_amf',
  baseArgs: ['-c:v', 'h264_amf'],
  qualityFlag: '-qp',
  qualityRange: { min: 22, max: 30, default: 26 },

  presets: [
    { key: 'speed', label: 'Speed（最快）', args: ['-quality', 'speed'] },
    { key: 'balanced', label: 'Balanced（均衡）', args: ['-quality', 'balanced'] },
    { key: 'quality', label: 'Quality（高质量）', args: ['-quality', 'quality'] }
  ],

  profiles: [
    {
      key: 'baseline',
      label: 'Baseline',
      args: ['-profile:v', 'baseline', '-pix_fmt', 'yuv420p'],
      defaultPreset: 'speed',
      defaultCrf: '30'
    },
    {
      key: 'main',
      label: 'Main',
      args: ['-profile:v', 'main', '-pix_fmt', 'yuv420p'],
      defaultPreset: 'balanced',
      defaultCrf: '26'
    },
    {
      key: 'high',
      label: 'High',
      args: ['-profile:v', 'high', '-pix_fmt', 'yuv420p'],
      defaultPreset: 'quality',
      defaultCrf: '24'
    }
  ],

  crfOptions: [
    { key: '30', label: 'QP 30（快速）', value: '30' },
    { key: '26', label: 'QP 26（均衡）', value: '26' },
    { key: '22', label: 'QP 22（高质量）', value: '22' }
  ],

  extraArgs: [],
  pixelFormat: 'yuv420p'
};

export default h264AmfConfig;
