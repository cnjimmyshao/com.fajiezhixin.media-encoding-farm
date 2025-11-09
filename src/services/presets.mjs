/**
 * @file 预设定义
 * @description 提供编码器预设选项（编码 → 编码器 → Profile）
 */

export const codecMatrix = {
  av1: {
    label: 'AV1（更高压缩率）',
    encoders: {
      'svt-av1': {
        label: 'SVT-AV1',
        profiles: {
          baseline: {
            label: 'Baseline：CRF 32 / preset 6',
            args: ['-c:v', 'libsvtav1', '-crf', '32', '-preset', '6', '-pix_fmt', 'yuv420p10le']
          },
          quality: {
            label: '高质量：CRF 28 / preset 4',
            args: ['-c:v', 'libsvtav1', '-crf', '28', '-preset', '4', '-pix_fmt', 'yuv420p10le']
          }
        }
      }
    }
  },
  hevc: {
    label: 'HEVC（H.265）',
    encoders: {
      x265: {
        label: 'x265',
        profiles: {
          baseline: {
            label: 'Baseline：CRF 24 / medium',
            args: ['-c:v', 'libx265', '-crf', '24', '-preset', 'medium', '-pix_fmt', 'yuv420p']
          },
          hq: {
            label: '高质量：CRF 20 / slow',
            args: ['-c:v', 'libx265', '-crf', '20', '-preset', 'slow', '-pix_fmt', 'yuv420p10le']
          }
        }
      }
    }
  },
  h264: {
    label: 'H.264',
    encoders: {
      x264: {
        label: 'x264',
        profiles: {
          baseline: {
            label: 'Baseline：CRF 20 / veryfast',
            args: ['-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-pix_fmt', 'yuv420p']
          },
          fast: {
            label: '快速：CRF 23 / faster',
            args: ['-c:v', 'libx264', '-crf', '23', '-preset', 'faster', '-pix_fmt', 'yuv420p']
          }
        }
      }
    }
  }
};

/**
 * @description 将 codecMatrix 拉平成旧的 preset key 结构，兼容任务执行
 */
export const videoPresets = Object.fromEntries(
  Object.entries(codecMatrix).flatMap(([codecKey, codec]) =>
    Object.entries(codec.encoders).flatMap(([encoderKey, encoder]) =>
      Object.entries(encoder.profiles).map(([profileKey, profile]) => ([
        `${codecKey}:${encoderKey}:${profileKey}`,
        { label: `${codec.label} / ${encoder.label} / ${profile.label}`, args: profile.args }
      ]))
    )
  )
);

export function codecOptions() {
  return Object.entries(codecMatrix).map(([codecKey, codec]) => ({
    key: codecKey,
    label: codec.label,
    encoders: Object.entries(codec.encoders).map(([encoderKey, encoder]) => ({
      key: encoderKey,
      label: encoder.label,
      profiles: Object.entries(encoder.profiles).map(([profileKey, profile]) => ({
        key: profileKey,
        label: profile.label
      }))
    }))
  }));
}

/**
 * @description 获取音频编码参数
 * @returns {string[]} 音频参数数组
 */
export function audioArgs() {
  return ['-c:a', 'aac', '-b:a', '128k'];
}

export default videoPresets;
