/**
 * @file encoder manager
 * @description 统一管理所有编码器配置
 */

// 导入CPU编码器
import x264Config from './impl-x264.mjs';
import x265Config from './impl-x265.mjs';
import libvpxVp9Config from './impl-libvpx-vp9.mjs';
import svtAv1Config from './impl-svt-av1.mjs';

// 导入NVENC硬件编码器
import h264NvencConfig from './impl-h264-nvenc.mjs';
import hevcNvencConfig from './impl-hevc-nvenc.mjs';
import av1NvencConfig from './impl-av1-nvenc.mjs';

// 导入AMD AMF硬件编码器
import h264AmfConfig from './impl-h264-amf.mjs';
import hevcAmfConfig from './impl-hevc-amf.mjs';
import av1AmfConfig from './impl-av1-amf.mjs';

// 导入Intel QSV硬件编码器
import h264QsvConfig from './impl-h264-qsv.mjs';
import hevcQsvConfig from './impl-hevc-qsv.mjs';
import av1QsvConfig from './impl-av1-qsv.mjs';

/**
 * 编码器配置注册表
 */
export const encoderRegistry = {
  // H.264 编码器
  h264: {
    x264: x264Config,
    'h264_nvenc': h264NvencConfig,
    'hevc_nvenc': hevcNvencConfig,
    'av1_nvenc': av1NvencConfig,
    'h264_amf': h264AmfConfig,
    'h264_qsv': h264QsvConfig
  },

  // H.265/HEVC 编码器
  hevc: {
    x265: x265Config,
    'hevc_nvenc': hevcNvencConfig,
    'hevc_amf': hevcAmfConfig,
    'hevc_qsv': hevcQsvConfig
  },

  // VP9 编码器
  vp9: {
    'libvpx-vp9': libvpxVp9Config
  },

  // AV1 编码器
  av1: {
    'svt-av1': svtAv1Config,
    'av1_nvenc': av1NvencConfig,
    'av1_qsv': av1QsvConfig,
    'av1_amf': av1AmfConfig
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

