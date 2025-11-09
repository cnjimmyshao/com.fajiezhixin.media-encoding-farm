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
        baseArgs: ['-c:v', 'libsvtav1'],
        profiles: [
          {
            key: 'baseline',
            label: '均衡（Preset 6）',
            args: ['-preset', '6', '-pix_fmt', 'yuv420p10le'],
            defaultCrf: '32'
          },
          {
            key: 'quality',
            label: '高质量（Preset 4）',
            args: ['-preset', '4', '-pix_fmt', 'yuv420p10le'],
            defaultCrf: '28'
          }
        ],
        crfOptions: [
          { key: '36', label: 'CRF 36（快速）', value: '36' },
          { key: '32', label: 'CRF 32（均衡）', value: '32' },
          { key: '28', label: 'CRF 28（高质量）', value: '28' }
        ]
      }
    }
  },
  hevc: {
    label: 'HEVC（H.265）',
    encoders: {
      x265: {
        label: 'x265',
        baseArgs: ['-c:v', 'libx265'],
        profiles: [
          {
            key: 'baseline',
            label: 'Main（Preset Medium）',
            args: ['-profile:v', 'main', '-preset', 'medium', '-pix_fmt', 'yuv420p'],
            defaultCrf: '24'
          },
          {
            key: 'hq',
            label: 'Main10（Preset Slow）',
            args: ['-profile:v', 'main10', '-preset', 'slow', '-pix_fmt', 'yuv420p10le'],
            defaultCrf: '20'
          }
        ],
        crfOptions: [
          { key: '26', label: 'CRF 26（快速）', value: '26' },
          { key: '24', label: 'CRF 24（均衡）', value: '24' },
          { key: '20', label: 'CRF 20（高质量）', value: '20' }
        ]
      }
    }
  },
  h264: {
    label: 'H.264',
    encoders: {
      x264: {
        label: 'x264',
        baseArgs: ['-c:v', 'libx264'],
        profiles: [
          {
            key: 'baseline',
            label: 'Baseline（Preset Veryfast）',
            args: ['-profile:v', 'baseline', '-preset', 'veryfast', '-pix_fmt', 'yuv420p'],
            defaultCrf: '20'
          },
          {
            key: 'fast',
            label: 'Main（Preset Faster）',
            args: ['-profile:v', 'main', '-preset', 'faster', '-pix_fmt', 'yuv420p'],
            defaultCrf: '23'
          },
          {
            key: 'hq',
            label: 'High（Preset Slow）',
            args: ['-profile:v', 'high', '-preset', 'slow', '-pix_fmt', 'yuv420p10le'],
            defaultCrf: '18'
          }
        ],
        crfOptions: [
          { key: '24', label: 'CRF 24（快速）', value: '24' },
          { key: '23', label: 'CRF 23（默认）', value: '23' },
          { key: '20', label: 'CRF 20（高质量）', value: '20' },
          { key: '18', label: 'CRF 18（存档）', value: '18' }
        ]
      }
    }
  }
};

/**
 * @description 将 codecMatrix 拉平成旧的 preset key 结构，兼容任务执行
 */
export const videoPresets = Object.fromEntries(
  Object.entries(codecMatrix).flatMap(([codecKey, codec]) =>
    Object.entries(codec.encoders).flatMap(([encoderKey, encoder]) => {
      const profileEntries = encoder.profiles ?? [];
      const crfEntries = encoder.crfOptions ?? [];
      return profileEntries.flatMap((profile) => {
        const combinations = crfEntries.map((crf) => ([
          `${codecKey}:${encoderKey}:${profile.key}:${crf.key}`,
          {
            label: `${codec.label} / ${encoder.label} / ${profile.label} / ${crf.label}`,
            args: [...(encoder.baseArgs ?? []), ...(profile.args ?? []), '-crf', crf.value]
          }
        ]));
        if (profile.defaultCrf) {
          const defaultCrf = crfEntries.find((item) => item.key === profile.defaultCrf) ?? crfEntries[0];
          if (defaultCrf) {
            combinations.push([
              `${codecKey}:${encoderKey}:${profile.key}`,
              {
                label: `${codec.label} / ${encoder.label} / ${profile.label} / ${defaultCrf.label}`,
                args: [...(encoder.baseArgs ?? []), ...(profile.args ?? []), '-crf', defaultCrf.value]
              }
            ]);
          }
        }
        return combinations;
      });
    })
  )
);

export function buildVideoArgs(codecKey, encoderKey, profileKey, crfKey) {
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
  const crfOptions = encoder.crfOptions ?? [];
  const crfCandidateKey = crfKey ?? profile.defaultCrf;
  const crf = crfCandidateKey
    ? crfOptions.find((item) => item.key === crfCandidateKey) ?? crfOptions[0]
    : crfOptions[0];
  if (!crf) {
    return null;
  }
  return [...(encoder.baseArgs ?? []), ...(profile.args ?? []), '-crf', crf.value];
}

export function codecOptions() {
  return Object.entries(codecMatrix).map(([codecKey, codec]) => ({
    key: codecKey,
    label: codec.label,
    encoders: Object.entries(codec.encoders).map(([encoderKey, encoder]) => ({
      key: encoderKey,
      label: encoder.label,
      profiles: (encoder.profiles ?? []).map((profile) => ({
        key: profile.key,
        label: profile.label,
        defaultCrf: profile.defaultCrf ?? null
      })),
      crfOptions: (encoder.crfOptions ?? []).map((crf) => ({
        key: crf.key,
        label: crf.label
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
