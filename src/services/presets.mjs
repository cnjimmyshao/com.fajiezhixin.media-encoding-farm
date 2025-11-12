/**
 * @file 预设定义
 * @description 提供编码 → 编码器 → Profile → Preset → 质量参数的矩阵
 */

const DEFAULT_QUALITY_FLAG = '-crf';

export const codecMatrix = {
  av1: {
    label: 'AV1（更高压缩率）',
    encoders: {
      'svt-av1': {
        label: 'SVT-AV1（CPU）',
        baseArgs: ['-c:v', 'libsvtav1'],
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
        ]
      },
      av1_nvenc: {
        label: 'NVIDIA AV1（NVENC，支持 RTX 40 系）',
        requiresHardware: true,
        ffmpegEncoder: 'av1_nvenc',
        baseArgs: ['-c:v', 'av1_nvenc'],
        qualityFlag: '-cq',
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
        ]
      },
      av1_qsv: {
        label: 'Intel AV1（QSV，Arc GPU）',
        requiresHardware: true,
        ffmpegEncoder: 'av1_qsv',
        baseArgs: ['-c:v', 'av1_qsv'],
        qualityFlag: '-q',
        presets: [
          { key: 'speed', label: 'Speed（最快）', args: ['-preset', 'speed'] },
          { key: 'balanced', label: 'Balanced（均衡）', args: ['-preset', 'balanced'] },
          { key: 'quality', label: 'Quality（高质量）', args: ['-preset', 'quality'] }
        ],
        profiles: [
          {
            key: 'main',
            label: 'Main（8-bit）',
            args: ['-profile:v', 'main', '-pix_fmt', 'nv12'],
            defaultPreset: 'balanced',
            defaultCrf: '28'
          },
          {
            key: 'main10',
            label: 'Main10（10-bit）',
            args: ['-profile:v', 'main10', '-pix_fmt', 'p010le'],
            defaultPreset: 'balanced',
            defaultCrf: '24'
          }
        ],
        crfOptions: [
          { key: '32', label: 'Q 32（快速）', value: '32' },
          { key: '28', label: 'Q 28（均衡）', value: '28' },
          { key: '24', label: 'Q 24（高质量）', value: '24' }
        ]
      },
      av1_amf: {
        label: 'AMD AV1（AMF，RX 7000 系）',
        requiresHardware: true,
        ffmpegEncoder: 'av1_amf',
        baseArgs: ['-c:v', 'av1_amf'],
        qualityFlag: '-qp',
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
        ]
      }
    }
  },
  hevc: {
    label: 'HEVC（H.265）',
    encoders: {
      x265: {
        label: 'x265（CPU）',
        baseArgs: ['-c:v', 'libx265'],
        presets: [
          { key: 'ultrafast', label: 'Ultrafast（极速）', args: ['-preset', 'ultrafast'] },
          { key: 'superfast', label: 'Superfast（特快）', args: ['-preset', 'superfast'] },
          { key: 'veryfast', label: 'Veryfast（很快）', args: ['-preset', 'veryfast'] },
          { key: 'faster', label: 'Faster（更快）', args: ['-preset', 'faster'] },
          { key: 'fast', label: 'Fast（快速）', args: ['-preset', 'fast'] },
          { key: 'medium', label: 'Medium（默认）', args: ['-preset', 'medium'] },
          { key: 'slow', label: 'Slow（高质量）', args: ['-preset', 'slow'] },
          { key: 'slower', label: 'Slower（更慢）', args: ['-preset', 'slower'] },
          { key: 'veryslow', label: 'Veryslow（极慢）', args: ['-preset', 'veryslow'] },
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
        ]
      },
      hevc_nvenc: {
        label: 'NVIDIA HEVC（NVENC）',
        requiresHardware: true,
        ffmpegEncoder: 'hevc_nvenc',
        baseArgs: ['-c:v', 'hevc_nvenc'],
        qualityFlag: '-cq',
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
        ]
      },
      hevc_amf: {
        label: 'AMD HEVC（AMF）',
        requiresHardware: true,
        ffmpegEncoder: 'hevc_amf',
        baseArgs: ['-c:v', 'hevc_amf'],
        qualityFlag: '-qp',
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
            args: ['-profile:v', 'main10', '-pix_fmt', 'p010le'],
            defaultPreset: 'quality',
            defaultCrf: '24'
          }
        ],
        crfOptions: [
          { key: '30', label: 'QP 30（快速）', value: '30' },
          { key: '26', label: 'QP 26（均衡）', value: '26' },
          { key: '22', label: 'QP 22（高质量）', value: '22' }
        ]
      },
      hevc_qsv: {
        label: 'Intel HEVC（QSV）',
        requiresHardware: true,
        ffmpegEncoder: 'hevc_qsv',
        baseArgs: ['-c:v', 'hevc_qsv'],
        qualityFlag: '-global_quality',
        presets: [
          { key: 'veryfast', label: 'Veryfast（最快）', args: ['-preset', 'veryfast'] },
          { key: 'faster', label: 'Faster（更快）', args: ['-preset', 'faster'] },
          { key: 'fast', label: 'Fast（快速）', args: ['-preset', 'fast'] },
          { key: 'medium', label: 'Medium（均衡）', args: ['-preset', 'medium'] },
          { key: 'slow', label: 'Slow（高质量）', args: ['-preset', 'slow'] }
        ],
        profiles: [
          {
            key: 'main',
            label: 'Main（8-bit）',
            args: ['-profile:v', 'main', '-pix_fmt', 'yuv420p'],
            defaultPreset: 'medium',
            defaultCrf: '28'
          },
          {
            key: 'main10',
            label: 'Main10（10-bit）',
            args: ['-profile:v', 'main10', '-pix_fmt', 'p010le'],
            defaultPreset: 'slow',
            defaultCrf: '24'
          },
          {
            key: 'main422',
            label: 'Main422（4:2:2）',
            args: ['-profile:v', 'main422_10', '-pix_fmt', 'p210le'],
            defaultPreset: 'slow',
            defaultCrf: '22'
          }
        ],
        crfOptions: [
          { key: '30', label: 'Quality 30（快速）', value: '30' },
          { key: '26', label: 'Quality 26（均衡）', value: '26' },
          { key: '22', label: 'Quality 22（高质量）', value: '22' }
        ]
      },
      hevc_videotoolbox: {
        label: 'Apple HEVC（VideoToolbox）',
        requiresHardware: true,
        ffmpegEncoder: 'hevc_videotoolbox',
        baseArgs: ['-c:v', 'hevc_videotoolbox'],
        qualityFlag: '-q:v',
        presets: [
          { key: 'performance', label: '高性能', args: [] },
          { key: 'balanced', label: '均衡', args: [] },
          { key: 'quality', label: '高质量', args: [] }
        ],
        profiles: [
          {
            key: 'main',
            label: 'Main（8-bit）',
            args: ['-profile:v', 'main', '-pix_fmt', 'yuv420p'],
            defaultPreset: 'balanced',
            defaultCrf: '24'
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
          { key: '30', label: 'Q 30（快速）', value: '30' },
          { key: '24', label: 'Q 24（均衡）', value: '24' },
          { key: '20', label: 'Q 20（高质量）', value: '20' }
        ]
      }
    }
  },
  h264: {
    label: 'H.264',
    encoders: {
      x264: {
        label: 'x264（CPU）',
        baseArgs: ['-c:v', 'libx264'],
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
        ]
      },
      h264_nvenc: {
        label: 'NVIDIA H.264（NVENC）',
        requiresHardware: true,
        ffmpegEncoder: 'h264_nvenc',
        baseArgs: ['-c:v', 'h264_nvenc'],
        qualityFlag: '-cq',
        presets: [
          { key: 'p1', label: 'P1（最快）', args: ['-preset', 'p1'] },
          { key: 'p4', label: 'P4（均衡）', args: ['-preset', 'p4'] },
          { key: 'p7', label: 'P7（最高质量）', args: ['-preset', 'p7'] }
        ],
        profiles: [
          {
            key: 'baseline',
            label: 'Baseline',
            args: ['-profile:v', 'baseline', '-pix_fmt', 'yuv420p'],
            defaultPreset: 'p4',
            defaultCrf: '28'
          },
          {
            key: 'main',
            label: 'Main',
            args: ['-profile:v', 'main', '-pix_fmt', 'yuv420p'],
            defaultPreset: 'p4',
            defaultCrf: '26'
          },
          {
            key: 'high',
            label: 'High（10-bit）',
            args: ['-profile:v', 'high', '-pix_fmt', 'p010le'],
            defaultPreset: 'p7',
            defaultCrf: '24'
          }
        ],
        crfOptions: [
          { key: '32', label: 'CQ 32（快速）', value: '32' },
          { key: '28', label: 'CQ 28（均衡）', value: '28' },
          { key: '24', label: 'CQ 24（高质量）', value: '24' }
        ]
      },
      h264_amf: {
        label: 'AMD H.264（AMF）',
        requiresHardware: true,
        ffmpegEncoder: 'h264_amf',
        baseArgs: ['-c:v', 'h264_amf'],
        qualityFlag: '-qp',
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
        ]
      },
      h264_qsv: {
        label: 'Intel H.264（QSV）',
        requiresHardware: true,
        ffmpegEncoder: 'h264_qsv',
        baseArgs: ['-c:v', 'h264_qsv'],
        qualityFlag: '-global_quality',
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
        ]
      },
      h264_videotoolbox: {
        label: 'Apple H.264（VideoToolbox）',
        requiresHardware: true,
        ffmpegEncoder: 'h264_videotoolbox',
        baseArgs: ['-c:v', 'h264_videotoolbox'],
        qualityFlag: '-q:v',
        presets: [
          { key: 'performance', label: '高性能', args: [] },
          { key: 'balanced', label: '均衡', args: [] },
          { key: 'quality', label: '高质量', args: [] }
        ],
        profiles: [
          {
            key: 'baseline',
            label: 'Baseline',
            args: ['-profile:v', 'baseline', '-pix_fmt', 'yuv420p'],
            defaultPreset: 'performance',
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
            args: ['-profile:v', 'high', '-pix_fmt', 'p010le'],
            defaultPreset: 'quality',
            defaultCrf: '22'
          }
        ],
        crfOptions: [
          { key: '32', label: 'Q 32（快速）', value: '32' },
          { key: '26', label: 'Q 26（均衡）', value: '26' },
          { key: '22', label: 'Q 22（高质量）', value: '22' }
        ]
      }
    }
  },
  vp9: {
    label: 'VP9',
    encoders: {
      'libvpx-vp9': {
        label: 'libvpx-vp9（CPU）',
        baseArgs: ['-c:v', 'libvpx-vp9'],
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
        ]
      },
      vp9_qsv: {
        label: 'Intel VP9（QSV）',
        requiresHardware: true,
        ffmpegEncoder: 'vp9_qsv',
        baseArgs: ['-c:v', 'vp9_qsv'],
        qualityFlag: '-q',
        presets: [
          { key: 'speed', label: 'Speed（最快）', args: ['-preset', 'speed'] },
          { key: 'balanced', label: 'Balanced（均衡）', args: ['-preset', 'balanced'] },
          { key: 'quality', label: 'Quality（高质量）', args: ['-preset', 'quality'] }
        ],
        profiles: [
          {
            key: 'profile0',
            label: 'Profile 0（8-bit）',
            args: ['-profile:v', '0', '-pix_fmt', 'nv12'],
            defaultPreset: 'balanced',
            defaultCrf: '34'
          }
        ],
        crfOptions: [
          { key: '38', label: 'Q 38（最快）', value: '38' },
          { key: '34', label: 'Q 34（均衡）', value: '34' },
          { key: '30', label: 'Q 30（高质量）', value: '30' }
        ]
      }
    }
  }
};

function collectPresetArgs(encoder, profile, preset, quality, codec, impl) {
  const args = [
    ...(encoder.baseArgs ?? []),
    ...(profile?.args ?? []),
    ...(preset?.args ?? [])
  ];
  
  // Add codec-specific extra arguments
  if (codec && impl) {
    // VP9 needs row multi-threading
    if (codec === 'vp9' && impl === 'libvpx-vp9') {
      args.push('-row-mt', '1');
      if (quality?.mode === 'crf') {
        args.push('-b:v', '0'); // CRF mode needs zero bitrate
      }
    }
    
    // AV1 defaults to 10-bit
    if (codec === 'av1' && impl === 'svt-av1') {
      // Check if pixel format is already set in profile args
      const hasPixelFormatInProfile = profile?.args?.some(arg => arg.includes('pix_fmt'));
      if (!hasPixelFormatInProfile) {
        args.push('-pix_fmt', 'yuv420p10le');
      }
    }
  }
  
  if (!quality) {
    const qualityFlag = encoder.qualityFlag ?? DEFAULT_QUALITY_FLAG;
    if (qualityFlag && profile?.defaultCrf) {
      args.push(qualityFlag, profile.defaultCrf);
    }
    return args;
  }
  if (quality.mode === 'bitrate' && quality.bitrateKbps) {
    const bitrateValue = `${quality.bitrateKbps}k`;
    args.push('-b:v', bitrateValue);
    if (quality.maxrateKbps) {
      args.push('-maxrate', `${quality.maxrateKbps}k`);
    }
    if (quality.bufsizeKbps) {
      args.push('-bufsize', `${quality.bufsizeKbps}k`);
    }
    if (quality.minrateKbps) {
      args.push('-minrate', `${quality.minrateKbps}k`);
    }
    return args;
  }
  const qualityFlag = encoder.qualityFlag ?? DEFAULT_QUALITY_FLAG;
  if (qualityFlag && quality.value) {
    args.push(qualityFlag, quality.value);
  }
  return args;
}

/**
 * @description 将 codecMatrix 拉平成旧的 preset key 结构，兼容任务执行
 */
export const videoPresets = Object.fromEntries(
  Object.entries(codecMatrix).flatMap(([codecKey, codec]) =>
    Object.entries(codec.encoders).flatMap(([encoderKey, encoder]) => {
      const profiles = encoder.profiles ?? [];
      const presets = (encoder.presets && encoder.presets.length)
        ? encoder.presets
        : [{ key: 'default', label: '默认', args: [] }];
      const crfEntries = encoder.crfOptions ?? [];
      return profiles.flatMap((profile) => {
        const combinations = [];
        const defaultPresetKey = profile.defaultPreset ?? presets[0]?.key;
        const defaultCrfKey = profile.defaultCrf ?? crfEntries[0]?.key;
        presets.forEach((preset) => {
          crfEntries.forEach((crf) => {
            const quality = { mode: 'crf', value: crf.value };
            const args = collectPresetArgs(encoder, profile, preset, quality);
            const key = `${codecKey}:${encoderKey}:${profile.key}:${preset.key}:${crf.key}`;
            combinations.push([
              key,
              {
                label: `${codec.label} / ${encoder.label} / ${profile.label} / ${preset.label} / ${crf.label}`,
                args
              }
            ]);
            if (preset.key === defaultPresetKey) {
              const aliasKey = `${codecKey}:${encoderKey}:${profile.key}:${crf.key}`;
              combinations.push([aliasKey, combinations[combinations.length - 1][1]]);
              if (crf.key === defaultCrfKey) {
                const legacyKey = `${codecKey}:${encoderKey}:${profile.key}`;
                combinations.push([legacyKey, combinations[combinations.length - 1][1]]);
              }
            }
          });
        });
        return combinations;
      });
    })
  )
);

export function buildVideoArgs(codecKey, encoderKey, profileKey, presetKey, crfKey, qualityOverride) {
  const codec = codecMatrix[codecKey];
  if (!codec) {
    return null;
  }
  const encoder = codec.encoders?.[encoderKey];
  if (!encoder) {
    return null;
  }
  const profiles = encoder.profiles ?? [];
  if (!profiles.length) {
    return null;
  }
  const profile = profileKey
    ? profiles.find((item) => item.key === profileKey)
    : profiles[0];
  if (!profile) {
    return null;
  }
  const presets = (encoder.presets && encoder.presets.length)
    ? encoder.presets
    : [{ key: 'default', label: '默认', args: [] }];
  const presetCandidateKey = presetKey ?? profile.defaultPreset ?? presets[0]?.key;
  const preset = presetCandidateKey
    ? presets.find((item) => item.key === presetCandidateKey) ?? presets[0]
    : presets[0];
  
  let args = [];
  if (qualityOverride) {
    args = collectPresetArgs(encoder, profile, preset, qualityOverride, codecKey, encoderKey);
  } else {
    const crfOptions = encoder.crfOptions ?? [];
    const crfCandidateKey = crfKey ?? profile.defaultCrf ?? crfOptions[0]?.key;
    const crf = crfCandidateKey
      ? crfOptions.find((item) => item.key === crfCandidateKey) ?? crfOptions[0]
      : crfOptions[0];
    if (!crf) {
      return null;
    }
    args = collectPresetArgs(encoder, profile, preset, { mode: 'crf', value: crf.value }, codecKey, encoderKey);
  }
  
  if (!args || args.length === 0) {
    return null;
  }
  
  // Add codec-specific extra arguments (e.g., VP9 -row-mt, AV1 10-bit)
  // Note: collectPresetArgs already adds these, so we don't need to add them again
  // const extraArgs = getCodecSpecificExtraArgs(codecKey, encoderKey, qualityOverride?.mode);
  // if (extraArgs.length > 0) {
  //   args = [...args, ...extraArgs];
  // }
  
  return args;
}

/**
 * Get codec-specific extra arguments
 */
function getCodecSpecificExtraArgs(codec, impl, qualityMode) {
  const extraArgs = [];
  
  // VP9 needs row multi-threading
  if (codec === 'vp9' && impl === 'libvpx-vp9') {
    extraArgs.push('-row-mt', '1');
    if (qualityMode === 'crf') {
      extraArgs.push('-b:v', '0'); // CRF mode needs zero bitrate
    }
  }
  
  // AV1 defaults to 10-bit
  if (codec === 'av1' && impl === 'svt-av1') {
    // Check if pixel format is already set, if not add 10-bit
    const hasPixelFormat = extraArgs.some(arg => arg.includes('pix_fmt'));
    if (!hasPixelFormat) {
      extraArgs.push('-pix_fmt', 'yuv420p10le');
    }
  }
  
  return extraArgs;
}

export function codecOptions(options = {}) {
  const supportedEncoders = options.supportedEncoders
    ? new Set(options.supportedEncoders)
    : null;
  return Object.entries(codecMatrix).map(([codecKey, codec]) => ({
    key: codecKey,
    label: codec.label,
    encoders: Object.entries(codec.encoders).map(([encoderKey, encoder]) => {
      const requiresHardware = Boolean(encoder.requiresHardware);
      const ffmpegName = encoder.ffmpegEncoder ?? encoderKey;
      // 如果有 supportedEncoders 集合才进行硬件支持检测，否则显示所有编码器
      const isSupported = !requiresHardware
        || (supportedEncoders ? supportedEncoders.has(ffmpegName) : true);
      return {
        key: encoderKey,
        label: encoder.label,
        // 在有 supportedEncoders 的情况下才标记 disabled，否则全部可用
        disabled: supportedEncoders ? !isSupported : false,
        profiles: (encoder.profiles ?? []).map((profile) => ({
          key: profile.key,
          label: profile.label,
          defaultCrf: profile.defaultCrf ?? null,
          defaultPreset: profile.defaultPreset ?? null
        })),
        presets: (encoder.presets ?? []).map((preset) => ({
          key: preset.key,
          label: preset.label
        })),
        crfOptions: (encoder.crfOptions ?? []).map((crf) => ({
          key: crf.key,
          label: crf.label
        }))
      };
    })
  }));
}

export const resolutionOptions = [
  { key: 'source', label: '保持原始分辨率', width: null, height: null },
  { key: '1080p', label: '1080p（1920×1080）', width: 1920, height: 1080 },
  { key: '720p', label: '720p（1280×720）', width: 1280, height: 720 },
  { key: '480p', label: '480p（854×480）', width: 854, height: 480 },
  { key: '360p', label: '360p（640×360）', width: 640, height: 360 }
];

export function getResolutionPreset(key) {
  return resolutionOptions.find((item) => item.key === key) ?? resolutionOptions[0];
}

/**
 * @description 获取音频编码参数
 * @param {string} outputPath 输出文件路径
 * @returns {string[]} 音频参数数组
 */
export function audioArgs(outputPath = '') {
  const ext = outputPath.toLowerCase().split('.').pop();
  
  // WebM 容器只支持 Vorbis 或 Opus 音频
  if (ext === 'webm') {
    return ['-c:a', 'libvorbis', '-b:a', '128k'];
  }
  
  // 默认使用 AAC
  return ['-c:a', 'aac', '-b:a', '128k'];
}

export default videoPresets;
