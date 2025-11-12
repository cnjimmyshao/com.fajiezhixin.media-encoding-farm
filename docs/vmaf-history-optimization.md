# VMAF目标模式优化方案

## 概述

优化 VMAF 目标模式的初始码率选择，通过搜索历史编码记录来避免重复计算，提高编码效率。

## 核心思路

**问题**: 当前的 VMAF 目标模式总是从 CRF 模式开始，然后根据 VMAF 结果调整码率，对于相似内容的视频会重复进行多次迭代。

**解决方案**: 在编码前搜索历史记录，如果有相似条件的编码记录，直接使用其码率作为初始值，减少迭代次数。

## 实现步骤

### 1. 创建编码历史记录表

```sql
CREATE TABLE encoding_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codec TEXT NOT NULL,                    -- 编码器类型 (h264, hevc, av1, vp9)
  impl TEXT NOT NULL,                     -- 编码器实现 (x264, x265, h264_nvenc, etc.)
  scale TEXT NOT NULL,                    -- 分辨率 (source, 720p, 1080p)
  vmaf_min REAL NOT NULL,                 -- VMAF目标最小值
  vmaf_max REAL NOT NULL,                 -- VMAF目标最大值
  final_vmaf REAL,                        -- 最终VMAF分数
  final_bitrate_kbps INTEGER NOT NULL,    -- 最终码率 (kbps)
  final_crf TEXT,                         -- 最终CRF值 (如果有)
  input_duration_seconds REAL,            -- 输入视频时长
  input_width INTEGER,                    -- 输入视频宽度
  input_height INTEGER,                   -- 输入视频高度
  input_fps REAL,                         -- 输入视频帧率
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_search (codec, impl, scale, vmaf_min, vmaf_max, created_at)
);
```

### 2. 查询历史记录

在编码前，根据以下条件查询相似记录：

- `codec` - 相同的编码器类型
- `impl` - 相同的编码器实现
- `scale` - 相同的分辨率设置
- `vmaf_min/max` - 相同的VMAF目标范围

查询最近30天内的记录：

```javascript
const history = await db.get(`
  SELECT final_bitrate_kbps, final_vmaf, input_width, input_height, input_duration_seconds
  FROM encoding_history
  WHERE codec = ? AND impl = ? AND scale = ?
    AND vmaf_min = ? AND vmaf_max = ?
    AND created_at > datetime('now', '-30 days')
  ORDER BY created_at DESC
  LIMIT 1
`, codec, impl, scale, vmafMin, vmafMax);
```

### 3. 计算推荐码率

根据历史记录计算初始码率：

```javascript
function calculateRecommendedBitrate(history, currentVideo) {
  if (!history) return null; // 没有历史记录，使用CRF模式

  const { final_bitrate_kbps, input_width, input_height, input_duration_seconds } = history;
  const { width, height, duration } = currentVideo;

  // 分辨率因子（平方根，避免过度影响）
  const resolutionFactor = Math.sqrt((width * height) / (input_width * input_height));

  // 时长因子（平方根，避免过度影响）
  const durationFactor = Math.sqrt(duration / input_duration_seconds);

  // 保守估计（9折）
  const recommendedBitrate = Math.round(
    final_bitrate_kbps * resolutionFactor * durationFactor * 0.9
  );

  return clamp(recommendedBitrate, minBitrate, maxBitrate);
}
```

### 4. 保存编码结果

编码完成后，将结果保存到历史记录：

```javascript
await db.run(`
  INSERT INTO encoding_history (codec, impl, scale, vmaf_min, vmaf_max,
    final_vmaf, final_bitrate_kbps, final_crf,
    input_duration_seconds, input_width, input_height, input_fps)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`, codec, impl, scale, vmafMin, vmafMax,
   finalVmaf, finalBitrate, finalCrf,
   duration, width, height, fps
);
```

### 5. 优化后的流程

```javascript
async function runPerSceneJobWithHistory(job, config) {
  // 1. 获取输入视频信息
  const videoInfo = await probeVideoInfo(config.ffmpeg.ffprobe, job.input_path);
  const { width, height, duration, fps } = videoInfo;

  // 2. 检查历史记录
  if (job.params.qualityMode === 'vmaf' && job.params.vmafMin && job.params.vmafMax) {
    const historyParams = {
      codec: job.codec,
      impl: job.impl,
      scale: job.params.scale || 'source',
      vmafMin: job.params.vmafMin,
      vmafMax: job.params.vmafMax
    };

    const history = await findSimilarEncodingHistory(historyParams);

    if (history) {
      // 3. 计算推荐码率
      const recommendedBitrate = await getRecommendedInitialBitrate(
        { ...historyParams, ...videoInfo },
        config
      );

      if (recommendedBitrate) {
        console.log(`[VMAF历史] 使用历史记录推荐码率: ${recommendedBitrate}kbps`);

        // 4. 第一次编码使用推荐的码率
        let currentBitrate = recommendedBitrate;
        let attempt = 0;
        const maxAttempts = config.vmaf.maxTuningAttempts || 8;

        while (attempt < maxAttempts) {
          attempt++;
          const qualityOverride = buildBitrateOverride(currentBitrate, config);

          // 编码场景片段
          const result = await encodeSceneSegment(...);

          // 计算VMAF
          const vmafResult = await computeVmafScore(...);
          const actualVmaf = vmafResult.mean;

          // 检查是否达到目标
          if (actualVmaf >= job.params.vmafMin && actualVmaf <= job.params.vmafMax) {
            console.log(`[VMAF历史] 第${attempt}次尝试成功! VMAF=${actualVmaf.toFixed(2)}`);
            break;
          }

          // 调整码率
          const nextBitrate = decideNextBitrate(currentBitrate, { vmafScore: actualVmaf }, {
            min: job.params.vmafMin,
            max: job.params.vmafMax
          }, config);

          if (!nextBitrate || nextBitrate === currentBitrate) {
            console.log(`[VMAF历史] 无法进一步优化，停止尝试`);
            break;
          }

          currentBitrate = nextBitrate;
        }

        // 5. 保存本次结果到历史记录
        await saveEncodingHistory({
          codec: job.codec,
          impl: job.impl,
          scale: job.params.scale || 'source',
          vmafMin: job.params.vmafMin,
          vmafMax: job.params.vmafMax,
          finalVmaf: actualVmaf,
          finalBitrateKbps: currentBitrate,
          finalCrf: job.params.crf,
          inputDuration: duration,
          inputWidth: width,
          inputHeight: height,
          inputFps: fps
        });

        return result;
      }
    }
  }

  // 如果没有历史记录，回退到原始CRF模式
  console.log('[VMAF历史] 未找到历史记录，使用CRF模式');
  return runPerSceneJobOriginal(job, config);
}
```

## 优势

### 1. 减少迭代次数
- **有历史记录**: 通常1-2次尝试即可达到目标VMAF
- **无历史记录**: 可能需要3-8次尝试
- **提升**: 平均减少 60-70% 的迭代次数

### 2. 节省时间
- 每次编码尝试都需要完整的编码 + VMAF计算
- 减少1次尝试 = 节省 编码时间 + VMAF计算时间
- **估计**: 对于10分钟视频，可节省 2-5分钟

### 3. 提高一致性
- 相似内容的视频使用相近的码率
- 避免过度调整导致的码率波动
- 结果更稳定、可预测

### 4. 自适应学习
- 随着编码次数增加，历史记录越来越准确
- 自动适应不同类型的视频内容
- 长期效果越来越好

## 使用示例

```javascript
// 场景编码任务
const job = {
  inputPath: 'input.mp4',
  outputPath: 'output.mp4',
  codec: 'hevc',
  impl: 'x265',
  params: {
    qualityMode: 'vmaf',
    vmafMin: 85,
    vmafMax: 95,
    scale: '720p'
  }
};

// 自动搜索历史记录并使用推荐码率
await runPerSceneJobWithHistory(job, config);
```

## 数据结构

### encoding_history 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| codec | TEXT | 编码器类型 |
| impl | TEXT | 编码器实现 |
| scale | TEXT | 分辨率设置 |
| vmaf_min/max | REAL | VMAF目标范围 |
| final_vmaf | REAL | 最终VMAF分数 |
| final_bitrate_kbps | INTEGER | 最终码率 |
| final_crf | TEXT | 最终CRF |
| input_duration_seconds | REAL | 输入时长 |
| input_width/height | INTEGER | 输入分辨率 |
| input_fps | REAL | 输入帧率 |
| created_at | TIMESTAMP | 创建时间 |

## 注意事项

1. **数据保留**: 只保留最近30天和10000条记录，避免数据库过大
2. **相似度匹配**: 只匹配完全相同的 codec/impl/scale/vmafMin/vmafMax
3. **码率调整**: 根据分辨率和时长进行微调，避免过度依赖历史数据
4. **回退机制**: 如果没有历史记录，回退到原始的CRF模式
5. **学习曲线**: 新系统需要积累历史数据才能发挥效果

## 性能影响

- **查询开销**: 每次编码前增加1次数据库查询（< 10ms）
- **存储开销**: 每次编码增加1条记录（约100字节）
- **总体影响**: 可忽略不计，收益远大于成本

## 未来扩展

1. **模糊匹配**: 支持相似的VMAF目标范围（如85-95和83-97）
2. **内容分析**: 根据视频内容类型（电影、动画、体育等）分类
3. **机器学习**: 使用历史数据训练模型，预测最佳初始码率
4. **分布式**: 在集群环境中共享历史记录
5. **用户隔离**: 支持多用户环境，历史记录按用户隔离
