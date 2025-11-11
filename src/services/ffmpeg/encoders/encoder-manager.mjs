/**
 * @file encoder manager
 * @description 统一管理所有编码器配置
 */

// 导入CPU编码器
import x264Config from './impl-x264.mjs';
import x265Config from './impl-x265.mjs';
import libvpxVp9Config from './impl-libvpx-vp9.mjs';
import svtAv1Config from './impl-svt-av1.mjs';

// 导入硬件编码器
import nvencConfigs from './impl-nvenc.mjs';

/**
 * 编码器配置注册表
 */
export const encoderRegistry = {
  // H.264 编码器
  h264: {
    x264: x264Config,
    'h264_nvenc': nvencConfigs.h264_nvenc,
    // AMD AMF
    'h264_amf': {
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
    },
    // Intel QSV
    'h264_qsv': {
      label: 'Intel H.264（QSV）',
      requiresHardware: true,
      ffmpegEncoder: 'h264_qsv',
      baseArgs: ['-c:v', 'h264_qsv'],
      qualityFlag: '-global_quality',
      qualityRange: { min: 24, max: 32, default: 28 },
      presets: [
        { key: 'veryfast', label: 'Veryfast（最快）', args: ['-preset', 'veryfast'] },
        { key: 'faster', label: 'Faster（更快）', args: ['-preset', 'faster'] },
        { key: 'fast', label: 'Fast（快速）', args: ['-preset', 'fast'] },
        { key: 'medium', label: 'Medium（均衡）', args: ['-preset', 'medium'] },
        { key: 'slow', label: 'Slow（高质量）', args: ['-preset', 'slow'] }
      ],
      profiles: [
        {
          key: 'baseline',
          label: 'Baseline',
          args: ['-profile:v', 'baseline', '-pix_fmt', 'yuv420p'],
          defaultPreset: 'veryfast',
          defaultCrf: '30'
        },
        {
          key: 'main',
          label: 'Main',
          args: ['-profile:v', 'main', '-pix_fmt', 'yuv420p'],
          defaultPreset: 'medium',
          defaultCrf: '26'
        },
        {
          key: 'high',
          label: 'High',
          args: ['-profile:v', 'high', '-pix_fmt', 'yuv420p10le'],
          defaultPreset: 'slow',
          defaultCrf: '24'
        }
      ],
      crfOptions: [
        { key: '32', label: 'Quality 32（快速）', value: '32' },
        { key: '28', label: 'Quality 28（均衡）', value: '28' },
        { key: '24', label: 'Quality 24（高质量）', value: '24' }
      ],
      extraArgs: [],
      pixelFormat: 'yuv420p'
    }
  },
  
  // H.265/HEVC 编码器
  hevc: {
    x265: x265Config,
    'hevc_nvenc': nvencConfigs.hevc_nvenc,
    // AMD AMF
    'hevc_amf': {
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
          defaultCrf: '22'
        }
      ],
      crfOptions: [
        { key: '28', label: 'QP 28（均衡）', value: '28' },
        { key: '24', label: 'QP 24（高质量）', value: '24' },
        { key: '20', label: 'QP 20（更高质量）', value: '20' }
      ],
      extraArgs: [],
      pixelFormat: 'yuv420p'
    }
  },
  
  // VP9 编码器
  vp9: {
    'libvpx-vp9': libvpxVp9Config
  },
  
  // AV1 编码器
  av1: {
    'svt-av1': svtAv1Config
  }
};

/**
 * 获取编码器配置
 */
export function getEncoderConfig(codec, impl) {
  const codecEncoders = encoderRegistry[codec];
  if (!codecEncoders) {
    return null;
  }
  
  return codecEncoders[impl] || null;
}

/**
 * 获取所有支持的编码器列表
 */
export function listSupportedEncoders() {
  const result = [];
  
  for (const [codec, encoders] of Object.entries(encoderRegistry)) {
    for (const [impl, config] of Object.entries(encoders)) {
      result.push({
        codec,
        impl,
        label: config.label,
        requiresHardware: config.requiresHardware || false,
        qualityFlag: config.qualityFlag,
        qualityRange: config.qualityRange
      });
    }
  }
  
  return result;
}

/**
 * 验证编码器是否支持
 */
export function isEncoderSupported(codec, impl, hardwareCapabilities = {}) {
  const config = getEncoderConfig(codec, impl);
  if (!config) {
    return { supported: false, reason: '编码器不存在' };
  }
  
  // 检查是否需要硬件支持
  if (config.requiresHardware) {
    const ffmpegName = config.ffmpegEncoder || impl;
    const isHardwareAvailable = hardwareCapabilities[ffmpegName] || false;
    
    if (!isHardwareAvailable) {
      return {
        supported: false,
        reason: `需要硬件支持: ${config.label}`,
        hardwareRequired: true
      };
    }
  }
  
  return { supported: true };
}

/**
 * 获取编码器统计信息
 */
export function getEncoderStats() {
  const stats = {
    totalEncoders: 0,
    hardwareEncoders: 0,
    codecs: {}
  };
  
  for (const [codec, encoders] of Object.entries(encoderRegistry)) {
    const encoderList = Object.values(encoders);
    stats.totalEncoders += encoderList.length;
    
    const hardwareCount = encoderList.filter(e => e.requiresHardware).length;
    stats.hardwareEncoders += hardwareCount;
    
    stats.codecs[codec] = {
      total: encoderList.length,
      hardware: hardwareCount,
      software: encoderList.length - hardwareCount
    };
  }
  
  return stats;
}

export default encoderRegistry;
