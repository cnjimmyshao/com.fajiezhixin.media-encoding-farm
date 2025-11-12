# 配置指南

本文档详细介绍视频编码农场的配置系统。

## 配置架构

项目采用分层配置策略：

1. **默认配置** (`config/default.mjs`) - 内置默认值
2. **环境变量** (`.env`) - 覆盖默认配置
3. **运行时配置** - 动态检测（如 CUDA）

## 配置结构

### 服务器配置 (`server`)

```javascript
{
  server: {
    port: 3000,           // HTTP 服务端口
  }
}
```

**环境变量：**
- `PORT` - 覆盖 `server.port`

### 调度器配置 (`scheduler`)

```javascript
{
  scheduler: {
    loopInterval: 1000,   // 调度循环间隔（毫秒）
  }
}
```

**环境变量：**
- `SCHEDULER_LOOP_INTERVAL` - 覆盖 `scheduler.loopInterval`

### 路径配置 (`paths`)

```javascript
{
  paths: {
    workspace: "/tmp/vef",  // 工作区目录
  }
}
```

**环境变量：**
- `WORKSPACE_PATH` - 覆盖 `paths.workspace`

### FFmpeg 配置 (`ffmpeg`)

```javascript
{
  ffmpeg: {
    bin: "ffmpeg",              // FFmpeg 路径
    ffprobe: "ffprobe",         // FFprobe 路径
    timeoutFactor: 5,           // 超时系数
    vmaf: {
      model: "vmaf_v0.6.1",     // 传递给 libvmaf 的模型标识
      n_threads: 4,              // VMAF 计算线程数
      n_subsample: 5,            // VMAF 子采样率
      fps: null                  // 可选的帧率限制
    }
  }
}
```

**环境变量：**
- `FFMPEG_BIN` - 覆盖 `ffmpeg.bin`
- `FFPROBE_BIN` - 覆盖 `ffmpeg.ffprobe`
- `FFMPEG_TIMEOUT_FACTOR` - 覆盖 `ffmpeg.timeoutFactor`

> VMAF 相关的 CLI 参数会在运行时根据下方 `vmaf` 配置块自动同步至 `ffmpeg.vmaf`，无需单独配置。

### VMAF 配置 (`vmaf`)

VMAF（Video Multimethod Assessment Fusion）是 Netflix 开发的开源视频质量评估算法。

```javascript
{ 
  vmaf: {
    modelVersion: "vmaf_v0.6.1",      // VMAF 模型版本
    minBitrateKbps: 200,              // 最小码率（Kbps）
    maxBitrateKbps: 80000,            // 最大码率（Kbps）
    bitrateIncreaseFactor: 1.15,      // 码率增加因子
    bitrateDecreaseFactor: 0.9,       // 码率减少因子
    nThreads: 4,                      // VMAF 计算线程数
    nSubsample: 5,                    // 子采样率
  }
}
```

**环境变量：**
- `VMAF_MODEL` - 覆盖 `vmaf.modelVersion`（同时更新 `ffmpeg.vmaf.model`）
- `VMAF_N_THREADS` - 覆盖 `vmaf.nThreads`（同时更新 `ffmpeg.vmaf.n_threads`）
- `VMAF_N_SUBSAMPLE` - 覆盖 `vmaf.nSubsample`（同时更新 `ffmpeg.vmaf.n_subsample`）
- `VMAF_FPS` - 覆盖 `vmaf.fps`（设置为正数会同步到 `ffmpeg.vmaf.fps`，留空则清除限制）

> 调优过程中不再设置最大尝试次数限制，系统会在 `minBitrateKbps` 与 `maxBitrateKbps` 的约束内持续迭代，直到 VMAF 达到目标范围或无法再调整码率。

**VMAF 模型版本说明：**

- `vmaf_v0.6.1` - 默认模型，适用于 1080p 及以下分辨率
- `vmaf_v0.6.1neg` - 适用于低码率场景
- `vmaf_4k_v0.6.1` - 适用于 4K 分辨率

### 场景检测配置 (`sceneDetection`)

```javascript
{
  sceneDetection: {
    threshold: 0.4,   // 场景检测阈值 (0.01-1.0)
  }
}
```

**说明：**
- 值越小，场景检测越敏感
- 推荐值：0.3-0.5
- 适用于 `perScene` 编码模式

**环境变量：**
- `SCENE_DETECTION_THRESHOLD` - 覆盖 `sceneDetection.threshold`

### 编码参数配置 (`encoding`)

```javascript
{
  encoding: {
    gopLength: 60,      // GOP 长度（帧数）
    keyintMin: 30,      // 最小关键帧间隔
    scThreshold: 0,     // 禁用自动场景检测
  }
}
```

**参数说明：**

- **GOP 长度** - Group of Pictures，影响压缩效率和随机访问性能
- **最小关键帧间隔** - 防止关键帧过于密集
- **scThreshold** - 设为 0 禁用 ffmpeg 自动场景检测（因为我们自己控制）

### ABR 模式配置 (`abr`)

ABR（Average Bitrate）是 CBR 和 CRF 的折中方案，适合媒体存储和点播场景。

```javascript
{
  abr: {
    minrateFactor: 0.7,     // 最小码率因子 (target × 0.7)
    maxrateFactor: 1.15,    // 最大码率因子 (target × 1.15)
    bufsizeFactor: 2,       // 缓冲区因子 (target × 2)
  }
}
```

**参数说明：**

- **minrateFactor** - 静态画面时允许的最低码率，节省空间
- **maxrateFactor** - 复杂画面时允许的最高码率，保证质量
- **bufsizeFactor** - 控制码率波动的平滑程度，越大越平滑

### CUDA 配置 (`cuda`)

```javascript
{
  cuda: {
    enabled: false,           // 是否启用（自动检测）
    device: 0,                // CUDA 设备 ID
    hasCudaSupport: false,    // 系统是否支持（运行时检测）
  }
}
```

**说明：**
- 系统自动检测 NVIDIA GPU 和 NVENC 支持
- 检测到支持时自动启用
- 支持多 GPU 环境（通过 `device` 选择）

**环境变量：**
- `CUDA_ENABLED` - 强制启用/禁用 CUDA
- `CUDA_DEVICE` - 选择 CUDA 设备

## 配置示例

### 高质量编码配置

```javascript
// config/production-high-quality.mjs
export default {
  vmaf: {
    modelVersion: "vmaf_v0.6.1",
    nThreads: 8,
    nSubsample: 3,
  },
  encoding: {
    gopLength: 120,
    keyintMin: 60,
  },
  sceneDetection: {
    threshold: 0.3,  // 更敏感的场景检测
  },
};
```

### 快速编码配置

```javascript
// config/production-fast.mjs
export default {
  vmaf: {
    nThreads: 2,
    nSubsample: 10,  // 更多子采样，更快但精度稍低
  },
  encoding: {
    gopLength: 30,   // 更短的 GOP，更快
    keyintMin: 15,
  },
  sceneDetection: {
    threshold: 0.6,  // 较不敏感，减少场景数量
  },
};
```

### 4K 专用配置

```javascript
// config/production-4k.mjs
export default {
  vmaf: {
    modelVersion: "vmaf_4k_v0.6.1",  // 4K 专用模型
    nThreads: 16,                    // 更多线程
    nSubsample: 5,
  },
  encoding: {
    gopLength: 60,
    keyintMin: 30,
  },
  sceneDetection: {
    threshold: 0.4,
  },
};
```

## 环境变量快速参考

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `PORT` | HTTP 端口 | 3000 |
| `WORKSPACE_PATH` | 工作区目录 | /tmp/vef |
| `FFMPEG_BIN` | FFmpeg 路径 | ffmpeg |
| `FFPROBE_BIN` | FFprobe 路径 | ffprobe |
| `FFMPEG_TIMEOUT_FACTOR` | 超时系数 | 5 |
| `VMAF_MODEL` | VMAF 模型 | vmaf_v0.6.1 |
| `VMAF_N_THREADS` | VMAF 线程数 | 4 |
| `VMAF_N_SUBSAMPLE` | VMAF 子采样 | 5 |
| `SCENE_DETECTION_THRESHOLD` | 场景阈值 | 0.4 |
| `CUDA_ENABLED` | CUDA 开关 | 自动检测 |
| `CUDA_DEVICE` | CUDA 设备 ID | 0 |

## 性能调优建议

### CPU 使用

- 增加 `VMAF_N_THREADS` 可加速 VMAF 计算
- 减少 `nSubsample` 提高精度但增加计算量
- 场景编码会显著增加 CPU 使用（每个场景独立编码）

### 内存使用

- 工作区目录需要足够空间（临时文件）
- 场景编码会同时处理多个片段，需要更多内存
- 建议至少 4GB 内存，8GB 或更多用于 4K 编码

### 存储 I/O

- 使用 SSD 可显著提升性能
- 监控工作区磁盘空间
- 定期清理旧日志和临时文件

## 故障排查

### 配置未生效

1. 检查环境变量名是否正确
2. 确认 `.env` 文件存在且格式正确
3. 查看启动日志中的配置信息
4. 检查是否有拼写错误

### VMAF 计算失败

1. 确认 ffmpeg 编译时启用了 VMAF 支持
2. 检查 VMAF 模型文件是否存在
3. 查看 `VMAF_MODEL` 是否设置正确
4. 检查视频分辨率与模型是否匹配

### CUDA 未启用

1. 确认 NVIDIA 驱动已安装
2. 检查 ffmpeg 是否支持 NVENC
3. 运行 `nvidia-smi` 验证 GPU 状态
4. 查看启动日志中的 CUDA 检测信息
