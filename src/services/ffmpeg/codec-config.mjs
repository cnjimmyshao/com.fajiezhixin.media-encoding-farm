/**
 * @file codec config
 * @description Codec-specific configurations and validation
 */

/**
 * Codec-specific templates with validation rules
 */
export const codecTemplates = {
  h264: {
    encoders: {
      x264: {
        qualityFlag: '-crf',
        qualityRange: { min: 14, max: 26, default: 23 },
        validProfiles: ['baseline', 'main', 'hq', 'high10', 'high444'], // 'main' is the correct profile name
        profileAliases: { 'fast': 'main' }, // Map frontend 'fast' to ffmpeg 'main'
        validPresets: ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow', 'placebo'],
        extraArgs: [],
        pixelFormat: 'yuv420p'
      },
      h264_nvenc: {
        qualityFlag: '-cq',
        qualityRange: { min: 24, max: 32, default: 28 },
        validProfiles: ['baseline', 'main', 'high'],
        validPresets: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
        extraArgs: [],
        pixelFormat: 'yuv420p',
        hardware: true
      },
      h264_amf: {
        qualityFlag: '-qp',
        qualityRange: { min: 22, max: 30, default: 26 },
        validProfiles: ['baseline', 'main', 'high'],
        validPresets: ['speed', 'balanced', 'quality'],
        extraArgs: [],
        pixelFormat: 'yuv420p',
        hardware: true
      }
    },
    defaultEncoder: 'x264'
  },
  
  hevc: {
    encoders: {
      x265: {
        qualityFlag: '-crf',
        qualityRange: { min: 18, max: 28, default: 24 },
        validProfiles: ['baseline', 'hq', 'still'],
        validPresets: ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow', 'placebo'],
        extraArgs: [],
        pixelFormat: 'yuv420p'
      },
      hevc_nvenc: {
        qualityFlag: '-cq',
        qualityRange: { min: 20, max: 28, default: 24 },
        validProfiles: ['main', 'main10'],
        validPresets: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
        extraArgs: [],
        pixelFormat: 'p010le',
        hardware: true
      }
    },
    defaultEncoder: 'x265'
  },
  
  vp9: {
    encoders: {
      'libvpx-vp9': {
        qualityFlag: '-crf',
        qualityRange: { min: 28, max: 38, default: 34 },
        validProfiles: ['profile0', 'profile2'],
        validPresets: ['cpu-0', 'cpu-1', 'cpu-2', 'cpu-3', 'cpu-4', 'cpu-5', 'cpu-6', 'cpu-7', 'cpu-8'],
        extraArgs: ['-row-mt', '1'], // VP9 needs row multi-threading
        pixelFormat: 'yuv420p',
        crfRequiresZeroBitrate: true // CRF mode needs -b:v 0
      }
    },
    defaultEncoder: 'libvpx-vp9'
  },
  
  av1: {
    encoders: {
      'svt-av1': {
        qualityFlag: '-crf',
        qualityRange: { min: 26, max: 36, default: 32 },
        validProfiles: ['baseline', 'quality', 'archival'],
        validPresets: ['speed-2', 'speed-4', 'speed-6', 'speed-8', 'speed-10'],
        extraArgs: ['-pix_fmt', 'yuv420p10le'], // SVT-AV1 defaults to 10-bit
        pixelFormat: 'yuv420p10le'
      }
    },
    defaultEncoder: 'svt-av1'
  }
};

/**
 * Get codec-specific configuration
 */
export function getCodecConfig(codec, impl) {
  const codecData = codecTemplates[codec];
  if (!codecData) return null;
  
  const encoderKey = impl || codecData.defaultEncoder;
  const encoder = codecData.encoders[encoderKey];
  if (!encoder) return null;
  
  return {
    codec,
    encoder: encoderKey,
    ...encoder
  };
}

/**
 * Validate codec parameters
 */
export function validateCodecParameters(codec, impl, params = {}) {
  const config = getCodecConfig(codec, impl);
  if (!config) {
    return { valid: false, error: `Unsupported codec/impl: ${codec}/${impl}` };
  }
  
  const errors = [];
  
  // Validate profile
  if (params.profile && !config.validProfiles.includes(params.profile)) {
    errors.push(`Invalid profile '${params.profile}' for ${codec}/${impl}. Valid: ${config.validProfiles.join(', ')}`);
  }
  
  // Validate preset
  if (params.preset && !config.validPresets.includes(params.preset)) {
    errors.push(`Invalid preset '${params.preset}' for ${codec}/${impl}. Valid: ${config.validPresets.join(', ')}`);
  }
  
  // Validate CRF range
  if (params.crf) {
    const crf = parseInt(params.crf, 10);
    if (isNaN(crf) || crf < config.qualityRange.min || crf > config.qualityRange.max) {
      errors.push(`CRF ${params.crf} out of range [${config.qualityRange.min}-${config.qualityRange.max}] for ${codec}/${impl}`);
    }
  }
  
  // Validate bitrate range
  if (params.bitrateKbps) {
    const bitrate = parseInt(params.bitrateKbps, 10);
    if (bitrate < 50 || bitrate > 50000) {
      errors.push(`Bitrate ${bitrate}kbps out of reasonable range [50-50000]`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : null,
    warnings: []
  };
}

/**
 * Get smart defaults for codec
 */
export function getCodecDefaults(codec, impl) {
  const config = getCodecConfig(codec, impl);
  if (!config) {
    return {
      crf: '23',
      preset: 'medium',
      profile: 'baseline'
    };
  }
  
  return {
    crf: config.qualityRange.default.toString(),
    preset: config.validPresets.includes('medium') ? 'medium' : config.validPresets[0],
    profile: config.validProfiles[0]
  };
}

/**
 * Get codec-specific extra arguments
 */
export function getCodecExtraArgs(codec, impl, qualityMode) {
  const config = getCodecConfig(codec, impl);
  if (!config) return [];
  
  const extraArgs = [...config.extraArgs];
  
  // VP9 CRF mode requires -b:v 0
  if (config.crfRequiresZeroBitrate && qualityMode === 'crf') {
    extraArgs.push('-b:v', '0');
  }
  
  return extraArgs;
}

/**
 * Get quality flag for codec
 */
export function getQualityFlag(codec, impl) {
  const config = getCodecConfig(codec, impl);
  return config?.qualityFlag || '-crf';
}

/**
 * Get audio args based on codec and container
 */
export function getAudioArgs(codec, outputPath) {
  const ext = outputPath.toLowerCase().split('.').pop();
  
  // VP9 in WebM container doesn't support AAC
  if (codec === 'vp9' && ext === 'webm') {
    return ['-c:a', 'libvorbis', '-b:a', '128k'];
  }
  
  // Opus is good for WebM
  if (ext === 'webm') {
    return ['-c:a', 'libopus', '-b:a', '128k'];
  }
  
  // Default to AAC for MP4/MOV
  return ['-c:a', 'aac', '-b:a', '128k'];
}

/**
 * Normalize parameters for consistent API
 */
export function normalizeCodecParameters(job) {
  const { codec, impl, params = {} } = job;
  const defaults = getCodecDefaults(codec, impl);
  const config = getCodecConfig(codec, impl);
  
  let profile = params.profile || defaults.profile;
  
  // Apply profile aliases (e.g., map 'fast' to 'main' for H.264)
  if (config?.profileAliases?.[profile]) {
    profile = config.profileAliases[profile];
  }
  
  return {
    ...params,
    profile,
    preset: params.preset || defaults.preset,
    crf: params.crf || defaults.crf
  };
}
