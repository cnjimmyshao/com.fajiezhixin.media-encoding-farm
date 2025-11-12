/**
 * @file VMAF编码历史记录
 * @description 存储和查询VMAF目标模式的编码历史，用于优化初始码率选择
 */

import { db } from '../db/sql.mjs';

/**
 * @description 初始化编码历史表
 */
export async function initEncodingHistory() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS encoding_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codec TEXT NOT NULL,
      impl TEXT NOT NULL,
      scale TEXT NOT NULL,
      vmaf_min REAL NOT NULL,
      vmaf_max REAL NOT NULL,
      final_vmaf REAL,
      final_bitrate_kbps INTEGER NOT NULL,
      final_crf TEXT,
      input_duration_seconds REAL,
      input_width INTEGER,
      input_height INTEGER,
      input_fps REAL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建复合索引，加速查询
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vmaf_search
    ON encoding_history(codec, impl, scale, vmaf_min, vmaf_max, created_at DESC)
  `);
}

/**
 * @description 查找相似的VMAF编码历史记录
 * @param {Object} params - 搜索参数
 * @returns {Promise<Object|null>} 最近的历史记录，如果没有返回null
 */
export async function findSimilarEncodingHistory(params) {
  const {
    codec,
    impl,
    scale = 'source',
    vmafMin,
    vmafMax
  } = params;

  // 验证参数
  if (!codec || !impl || !Number.isFinite(vmafMin) || !Number.isFinite(vmafMax)) {
    return null;
  }

  try {
    // 查询最近30天内的相似编码记录
    const result = await db.get(`
      SELECT
        final_bitrate_kbps,
        final_vmaf,
        final_crf,
        input_duration_seconds,
        input_width,
        input_height,
        input_fps,
        created_at
      FROM encoding_history
      WHERE codec = ?
        AND impl = ?
        AND scale = ?
        AND vmaf_min = ?
        AND vmaf_max = ?
        AND created_at > datetime('now', '-30 days')
      ORDER BY created_at DESC
      LIMIT 1
    `, codec, impl, scale, vmafMin, vmafMax);

    if (result) {
      console.log(`[VMAF历史] 找到相似编码记录:`, {
        codec,
        impl,
        scale,
        vmafMin,
        vmafMax,
        finalBitrate: result.final_bitrate_kbps,
        finalVmaf: result.final_vmaf,
        age: '最近30天内'
      });
    }

    return result;
  } catch (error) {
    console.warn('[VMAF历史] 查询历史记录失败:', error.message);
    return null;
  }
}

/**
 * @description 保存VMAF编码结果到历史记录
 * @param {Object} params - 编码结果参数
 */
export async function saveEncodingHistory(params) {
  const {
    codec,
    impl,
    scale = 'source',
    vmafMin,
    vmafMax,
    finalVmaf,
    finalBitrateKbps,
    finalCrf,
    inputDuration,
    inputWidth,
    inputHeight,
    inputFps
  } = params;

  // 验证必需参数
  if (!codec || !impl || !Number.isFinite(vmafMin) || !Number.isFinite(vmafMax) || !Number.isFinite(finalBitrateKbps)) {
    console.warn('[VMAF历史] 参数不全，无法保存历史记录');
    return;
  }

  try {
    await db.run(`
      INSERT INTO encoding_history (
        codec, impl, scale, vmaf_min, vmaf_max,
        final_vmaf, final_bitrate_kbps, final_crf,
        input_duration_seconds, input_width, input_height, input_fps
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    codec, impl, scale, vmafMin, vmafMax,
    finalVmaf, finalBitrateKbps, finalCrf,
    inputDuration, inputWidth, inputHeight, inputFps
    );

    console.log(`[VMAF历史] 保存编码记录: ${codec}/${impl}, 码率: ${finalBitrateKbps}kbps, VMAF: ${finalVmaf}`);
  } catch (error) {
    console.warn('[VMAF历史] 保存历史记录失败:', error.message);
  }
}

/**
 * @description 计算推荐的初始码率
 * @param {Object} params - 编码参数
 * @param {Object} config - 配置对象
 * @returns {number|null} 推荐的初始码率(kbps)，如果没有历史记录返回null
 */
export async function getRecommendedInitialBitrate(params, config) {
  const history = await findSimilarEncodingHistory(params);

  if (!history) {
    console.log('[VMAF历史] 未找到相似编码记录，将使用CRF模式开始');
    return null;  // 返回null表示使用CRF模式
  }

  // 获取历史记录中的码率
  const historicalBitrate = history.final_bitrate_kbps;

  // 根据视频属性进行微调
  const durationFactor = params.durationSeconds && history.input_duration_seconds
    ? Math.sqrt(params.durationSeconds / history.input_duration_seconds)
    : 1;

  const resolutionFactor = params.width && params.height && history.input_width && history.input_height
    ? Math.sqrt((params.width * params.height) / (history.input_width * history.input_height))
    : 1;

  // 计算推荐码率，限制在合理范围内
  const recommendedBitrate = Math.max(
    config.vmaf.minBitrateKbps,
    Math.min(
      config.vmaf.maxBitrateKbps,
      Math.round(historicalBitrate * durationFactor * resolutionFactor * 0.9)  // 9折保守估计
    )
  );

  console.log(`[VMAF历史] 推荐初始码率: ${recommendedBitrate}kbps`);
  console.log(`[VMAF历史]   历史码率: ${historicalBitrate}kbps`);
  console.log(`[VMAF历史]   时长因子: ${durationFactor.toFixed(2)}`);
  console.log(`[VMAF历史]   分辨率因子: ${resolutionFactor.toFixed(2)}`);

  return recommendedBitrate;
}

/**
 * @description 清理过期的历史记录（保留最近10000条）
 */
export async function cleanupOldHistory() {
  try {
    const result = await db.run(`
      DELETE FROM encoding_history
      WHERE id NOT IN (
        SELECT id FROM encoding_history
        ORDER BY created_at DESC
        LIMIT 10000
      )
    `);

    if (result.changes > 0) {
      console.log(`[VMAF历史] 清理了 ${result.changes} 条过期记录`);
    }
  } catch (error) {
    console.warn('[VMAF历史] 清理过期记录失败:', error.message);
  }
}

// 初始化时创建表
initEncodingHistory().catch(err => {
  console.warn('[VMAF历史] 初始化失败:', err.message);
});

export default {
  initEncodingHistory,
  findSimilarEncodingHistory,
  saveEncodingHistory,
  getRecommendedInitialBitrate,
  cleanupOldHistory
};
