# 高级功能详解

本文档详细介绍视频编码农场的高级功能和使用场景。

## 目录

1. [VMAF 智能调优](#vmaf-智能调优)
2. [场景检测编码](#场景检测编码)
3. [CUDA 硬件加速](#cuda-硬件加速)
4. [ABR 码率控制](#abr-码率控制)
5. [多编码器支持](#多编码器支持)
6. [流媒体输出](#流媒体输出)
7. [远程输入支持](#远程输入支持)

## VMAF 智能调优

### 概述

VMAF（Video Multimethod Assessment Fusion）是 Netflix 开发的开源视频质量评估算法，能够准确预测人眼感知的视频质量。

### 工作原理

1. **初始编码**：使用初始参数进行编码
2. **VMAF 计算**：计算输出视频的 VMAF 分数
3. **参数调整**：根据 VMAF 与目标范围的差距调整码率或 CRF
4. **迭代优化**：重复步骤 1-3，直到 VMAF 达到目标范围或无法进一步提升

### 使用场景

- **质量控制**：确保输出视频达到预定的质量标准
- **码率优化**：找到达到目标质量的最小码率
- **一致性**：批量处理时保持质量一致

### 配置示例

```json
{
  "params": {
    "qualityMode": "bitrate",
    "bitrateKbps": 2000,
    "enableVmaf": true,
    "vmafMin": 85,
    "vmafMax": 95
  }
}
```

### 调优策略

**码率模式调优：**
- VMAF < vmafMin：增加码率（乘以 `bitrateIncreaseFactor`，默认 1.15）
- VMAF > vmafMax：减少码率（乘以 `bitrateDecreaseFactor`，默认 0.9）
- vmafMin ≤ VMAF ≤ vmafMax：达到目标，停止调优

**调优边界：**
- 系统会持续迭代，直到 VMAF 落入目标区间或码率触及边界
- 最小码率：`minBitrateKbps`（默认 200）
- 最大码率：`maxBitrateKbps`（默认 80000）

### 性能影响

- VMAF 计算需要额外时间（约增加 20-50% 总处理时间）
- 可通过 `nSubsample` 参数减少计算量
- 建议对质量要求高的场景使用

### 最佳实践

1. **合理设置目标范围**：
   - 流媒体：85-95
   - 存档：90-95
   - 低码率：75-85

2. **初始码率估计**：
   - 根据分辨率和内容复杂度设置合理的初始码率
   - 避免起始码率过高或过低

3. **批量处理**：
   - 同类内容使用相同参数
   - 记录 VMAF 结果用于分析

## 场景检测编码

### 概述

自动检测视频中的场景边界，为每个场景使用最优的编码参数，提升整体质量和压缩效率。

### 工作原理

1. **场景检测**：使用 ffmpeg 的 scene detection 功能识别场景切换
2. **片段分割**：根据检测到的切换点分割视频
3. **独立编码**：每个场景片段独立编码（可使用不同参数）
4. **合并输出**：将所有片段合并为最终输出

### 使用场景

- **混合内容**：视频包含多种类型的场景（动作、对话、静态）
- **优化压缩**：为不同复杂度场景分配不同码率
- **智能关键帧**：在场景边界插入关键帧，提升随机访问性能

### 配置示例

```json
{
  "params": {
    "perScene": true,
    "sceneThreshold": 0.4,
    "enableVmaf": true,
    "vmafMin": 85,
    "vmafMax": 95
  }
}
```

### 场景检测算法

**阈值参数：**
- `sceneThreshold`: 0.01-1.0
- 值越小，检测越敏感（检测到更多场景）
- 推荐值：0.3-0.5

**检测原理：**
- 计算相邻帧的相似度
- 相似度低于阈值认为是场景切换
- 支持渐变色和快速切换检测

### 编码策略

**场景分类：**
- **高复杂度**：动作场景、快速运动
- **中复杂度**：标准对话场景
- **低复杂度**：静态画面、纯色背景

**码率分配：**
- 高复杂度：目标码率 × 1.2
- 中复杂度：目标码率 × 1.0
- 低复杂度：目标码率 × 0.8

**GOP 结构：**
- 每个场景开始处插入关键帧
- GOP 长度根据场景长度动态调整
- 避免跨场景参考

### 性能影响

- 需要额外时间进行场景检测（通常 1-5% 总时间）
- 每个场景独立编码，可能增加总时间
- 需要更多临时存储空间（场景片段）

### 最佳实践

1. **阈值调整**：
   - 快速切换内容：0.3-0.4
   - 渐变转场较多：0.4-0.5
   - 动画内容：0.2-0.3

2. **与 VMAF 结合**：
   - 启用 VMAF 确保每个场景达到质量目标
   - 避免某些场景质量过高或过低

3. **批量处理**：
   - 同类内容使用相同阈值
   - 记录场景数量用于分析

## CUDA 硬件加速

### 概述

自动检测并使用 NVIDIA GPU 的 NVENC 硬件编码器，显著提升编码速度。

### 支持特性

- **自动检测**：启动时自动检测 NVIDIA GPU 和 NVENC 支持
- **多 GPU 支持**：可选择使用哪个 GPU 设备
- **编码器支持**：H.264, H.265/HEVC, AV1（取决于 GPU 代际）
- **质量匹配**：硬件编码质量接近软件编码

### 工作原理

1. **启动检测**：应用启动时运行 `ffmpeg -hwaccels` 和 `ffmpeg -codecs`
2. **能力查询**：检测支持的编码器和 GPU 型号
3. **自动启用**：检测到支持时自动使用 NVENC
4. **参数映射**：将软件编码参数映射到硬件编码等价参数

### 使用方式

**自动启用（推荐）：**
```json
{
  "codec": "h264",
  "impl": "nvenc"
}
```

**手动控制：**
```bash
# .env
CUDA_ENABLED=true
CUDA_DEVICE=0
```

### 支持的 GPU 和编码器

| GPU 系列 | H.264 | HEVC (H.265) | AV1 |
|----------|-------|--------------|-----|
| Maxwell (9xx) | ✅ | ❌ | ❌ |
| Pascal (10xx) | ✅ | ✅ | ❌ |
| Turing (16xx, 20xx) | ✅ | ✅ | ❌ |
| Ampere (30xx) | ✅ | ✅ | ✅ |
| Ada Lovelace (40xx) | ✅ | ✅ | ✅ |

### 性能对比

**编码速度提升：**
- H.264: 3-5x 加速
- H.265: 5-10x 加速
- AV1: 10-20x 加速

**质量差异：**
- 相同码率下，质量接近 x264/x265
- 推荐使用 2-pass 或 CQP 模式提升质量
- 对于高质量要求，建议进行质量测试

### 配置示例

```json
{
  "inputPath": "/media/input.mp4",
  "outputPath": "/media/output-hevc.mp4",
  "codec": "hevc",
  "impl": "hevc_nvenc",
  "params": {
    "profile": "main",
    "preset": "p4",
    "presetKey": "hevc:hevc_nvenc:main:p4:bitrate",
    "qualityMode": "bitrate",
    "bitrateKbps": 2500,
    "scale": "source"
  }
}
```

### 最佳实践

1. **质量模式选择：**
   - 速度优先：CQP 模式
   - 码率控制：2-pass 模式
   - 质量优先：目标质量模式

2. **多 GPU 环境：**
   - 使用 `CUDA_DEVICE` 选择 GPU
   - 负载均衡：不同任务使用不同 GPU

3. **混合使用：**
   - 快速预览：NVENC
   - 最终输出：软件编码（质量优先）

## ABR 码率控制

### 概述

ABR（Average Bitrate）是 CBR（Constant Bitrate）和 CRF（Constant Rate Factor）的折中方案，适合媒体存储和点播场景。

### 工作原理

ABR 模式通过三个参数控制码率波动：

1. **最小码率**（minrate）- 静态画面时的最低码率
2. **最大码率**（maxrate）- 复杂画面时的最高码率
3. **缓冲区**（bufsize）- 控制码率波动的平滑程度

### 配置参数

```javascript
{
  abr: {
    minrateFactor: 0.7,     // 最小码率 = 目标码率 × 0.7
    maxrateFactor: 1.15,    // 最大码率 = 目标码率 × 1.15
    bufsizeFactor: 2,       // 缓冲区 = 目标码率 × 2
  }
}
```

### 使用场景

**适合使用 ABR：**
- 媒体文件存储
- 点播流媒体（VOD）
- 需要控制文件大小
- 兼容性要求（某些设备不支持 CRF）

**不适合使用 ABR：**
- 实时流媒体（使用 CBR）
- 质量优先的存档（使用 CRF）
- 极短片段

### 配置示例

```json
{
  "params": {
    "qualityMode": "bitrate",
    "bitrateKbps": 2500,
    "scale": "source"
  }
}
```

### 与 CRF 的对比

| 特性 | ABR | CRF |
|------|-----|-----|
| **文件大小** | 可预测 | 不可预测 |
| **质量一致性** | 较好 | 优秀 |
| **编码速度** | 较慢（可能需 2-pass） | 快速 |
| **适用场景** | 流媒体、存储 | 存档、质量优先 |

### 最佳实践

1. **码率设置：**
   - 根据分辨率和内容类型选择
   - 参考：1080p 2500-5000 Kbps，4K 8000-15000 Kbps
   - 动画可适当降低，运动场景适当增加

2. **缓冲区配置：**
   - 网络流媒体：较小的 bufsize（1-2x）
   - 文件存储：较大的 bufsize（2-3x）

3. **与 VMAF 结合：**
   - 使用 VMAF 验证质量
   - 根据 VMAF 结果调整目标码率

## 多编码器支持

### 支持的编码器

项目支持多种视频编码器，适用于不同场景：

| 编码器 | Codec | 特点 | 适用场景 |
|--------|-------|------|----------|
| **x264** | H.264 | 兼容性最好，速度快 | 通用，流媒体 |
| **x265** | H.265/HEVC | 压缩率高，速度慢 | 4K，存储 |
| **SVT-AV1** | AV1 | 压缩率最高，速度慢 | 高压缩率需求 |
| **libvpx-vp9** | VP9 | 开源，浏览器支持好 | Web 流媒体 |
| **NVENC** | H.264/H.265/AV1 | 硬件加速，速度快 | 实时处理，批量转码 |

### 编码器对比

**压缩率（相同质量）：**
AV1 > H.265 > VP9 > H.264

**编码速度：**
NVENC > x264 > VP9 > H.265 > AV1

**兼容性：**
H.264 > H.265 > VP9 > AV1

### 配置示例

**H.264（通用）：**
```json
{
  "codec": "h264",
  "impl": "x264",
  "params": {
    "profile": "main",
    "preset": "medium",
    "presetKey": "h264:x264:main:medium:23",
    "qualityMode": "crf",
    "crf": 23
  }
}
```

**H.265（高压缩）：**
```json
{
  "codec": "hevc",
  "impl": "x265",
  "params": {
    "profile": "main",
    "preset": "slow",
    "presetKey": "hevc:x265:main:slow:28",
    "qualityMode": "crf",
    "crf": 28
  }
}
```

**AV1（最高压缩）：**
```json
{
  "codec": "av1",
  "impl": "svt-av1",
  "params": {
    "profile": "baseline",
    "preset": "speed-6",
    "presetKey": "av1:svt-av1:baseline:speed-6:32",
    "qualityMode": "crf",
    "crf": 32
  }
}
```

**NVENC H.265（快速）：**
```json
{
  "codec": "hevc",
  "impl": "hevc_nvenc",
  "params": {
    "profile": "main",
    "preset": "p4",
    "presetKey": "hevc:hevc_nvenc:main:p4:bitrate",
    "qualityMode": "bitrate",
    "bitrateKbps": 2500
  }
}
```

### 选择建议

**按用途：**
- **流媒体**：H.264（兼容性）或 HEVC（节省带宽）
- **存档**：HEVC 或 AV1（压缩率）
- **Web**：H.264 或 VP9
- **快速处理**：NVENC

**按分辨率：**
- **1080p 及以下**：H.264
- **4K**：HEVC
- **高压缩需求**：AV1

**按设备：**
- **移动设备**：H.264（兼容性）
- **现代设备**：HEVC
- **浏览器**：H.264、VP9

## 流媒体输出

### 概述

支持生成 HLS（HTTP Live Streaming）和 DASH（Dynamic Adaptive Streaming）流媒体格式。

### HLS 输出

HLS 是 Apple 开发的自适应流媒体协议，广泛支持。

**特点：**
- m3u8 播放列表 + TS 分片
- 自适应码率
- 支持 DRM
- 延迟较高（10-30 秒）

### DASH 输出

DASH 是国际标准，基于 MPEG 的自适应流媒体协议。

**特点：**
- MPD 描述文件 + MP4 分片
- 自适应码率
- 支持多种编解码器
- 延迟可优化（低延迟 DASH）

### 使用方式

**HLS 输出：**
```json
{
  "outputPath": "/media/output.m3u8",
  "codec": "h264",
  "impl": "x264",
  "params": {
    "presetKey": "h264:x264:main:medium:bitrate",
    "profile": "main",
    "preset": "medium",
    "qualityMode": "bitrate",
    "bitrateKbps": 2500,
    "perScene": true,
    "sceneThreshold": 0.4,
    "enableVmaf": true,
    "vmafMin": 85,
    "vmafMax": 95
  }
}
```

**DASH 输出：**
```json
{
  "outputPath": "/media/output.mpd",
  "codec": "hevc",
  "impl": "x265",
  "params": {
    "presetKey": "hevc:x265:main:slow:bitrate",
    "profile": "main",
    "preset": "slow",
    "qualityMode": "bitrate",
    "bitrateKbps": 3000,
    "perScene": true,
    "sceneThreshold": 0.35,
    "enableVmaf": true,
    "vmafMin": 85,
    "vmafMax": 95
  }
}
```

> 当前版本会为每个场景编码生成一套 HLS/DASH 切片，用于回放与分析；多码率自适应输出仍在规划中。

### 最佳实践

1. **分片时长：**
   - 直播：2-6 秒
   - 点播：6-10 秒

2. **码率阶梯：**
   - 至少 3-5 个质量等级
   - 覆盖不同网络条件

3. **关键帧：**
   - 与分片对齐
   - 支持快速切换

## 远程输入支持

### 概述

支持 HTTP/HTTPS 远程输入源，无需先下载到本地。

### 工作原理

1. **流式下载**：ffmpeg 边下载边编码
2. **断点续传**：支持 HTTP Range 请求
3. **错误重试**：网络错误自动重试
4. **进度跟踪**：实时显示下载进度

### 使用方式

```json
{
  "inputPath": "https://example.com/video.mp4",
  "outputPath": "/media/output.mp4",
  "codec": "h264",
  "params": {
    "qualityMode": "crf",
    "crf": 23
  }
}
```

### 支持特性

- **HTTP/HTTPS**：标准 Web 服务器
- **Range 请求**：支持断点续传
- **重定向**：自动跟随重定向
- **认证**：支持 Basic Auth（URL 中嵌入）

### 限制

- 需要服务器支持 Range 请求（推荐）
- 大文件处理可能需要较长下载时间
- 网络不稳定可能导致失败

### 最佳实践

1. **服务器配置：**
   - 确保支持 HTTP Range 请求
   - 配置合适的缓存策略
   - 使用 CDN 加速

2. **错误处理：**
   - 监控网络错误
   - 实现重试机制
   - 记录下载进度

3. **性能优化：**
   - 选择就近的服务器
   - 使用高速网络
   - 考虑先下载再编码（不稳定网络）
