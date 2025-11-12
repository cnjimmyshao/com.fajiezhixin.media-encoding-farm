# API 文档

本文档详细介绍视频编码农场的 RESTful API。

## 基础信息

- **Base URL**: `http://localhost:3000/api`
- **Content-Type**: `application/json`
- **认证**: 当前版本无需认证（单机原型）

## 任务管理 API

### 创建任务

创建一个新的视频编码任务。

**Endpoint**: `POST /api/jobs`

**请求体：**

```json
{
  "inputPath": "/path/to/input.mp4",
  "outputPath": "/path/to/output.mp4",
  "codec": "h264",
  "impl": "x264",
  "params": {
    "presetKey": "h264:x264:main:medium:23",
    "profile": "main",
    "preset": "medium",
    "qualityMode": "crf",
    "crf": 23,
    "bitrateKbps": null,
    "scale": "source",
    "enableVmaf": false,
    "perScene": false,
    "sceneThreshold": null,
    "vmafMin": null,
    "vmafMax": null
  }
}
```

> ℹ️ **提示**：创建任务时，系统会自动将 `outputPath` 改写为 `文件名[任务ID].扩展名`，避免多个任务写入相同文件。

**参数说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `inputPath` | string | 是 | 输入文件路径（本地或 HTTP/HTTPS URL） |
| `outputPath` | string | 是 | 输出文件路径（保存时会自动追加任务 ID） |
| `codec` | string | 是 | 编码格式：`h264`, `hevc`, `av1`, `vp9` |
| `impl` | string | 是 | 具体编码实现，需与 `codec` 匹配（见下方矩阵） |
| `params` | object | 否 | 编码参数对象 |

**params 详细说明：**

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `presetKey` | string | - | 预设缓存键，格式 `codec:impl:profile:preset:crf|bitrate` |
| `profile` | string | 依编码器 | 编码 Profile，例如 `baseline`/`main`/`high`（H.264）、`main`/`main10`（HEVC） |
| `preset` | string | 依编码器 | 编码速度预设（如 `medium`、`p4`、`speed` 等） |
| `qualityMode` | string | `"crf"` | 质量模式：`crf`、`bitrate`、`vmaf` |
| `crf` | number | `23` | CRF 值（0-51，`qualityMode=crf` 时必填） |
| `bitrateKbps` | number | - | 目标码率（Kbps，`qualityMode=bitrate` 时必填） |
| `scale` | string | `"source"` | 分辨率：`source`, `360p`, `480p`, `720p`, `1080p`, `4k` |
| `enableVmaf` | boolean | `false` | 是否在编码完成后计算 VMAF 指标 |
| `vmafMin` | number | - | VMAF 最低目标分数（0-100，`qualityMode=vmaf` 或 `perScene=true` 时必填） |
| `vmafMax` | number | - | VMAF 最高目标分数（0-100，`qualityMode=vmaf` 或 `perScene=true` 时必填） |
| `perScene` | boolean | `false` | 是否启用场景切片编码（必须搭配有效的 `vmafMin/vmafMax`） |
| `sceneThreshold` | number | `0.4` | 场景检测阈值（0.01-1.0，`perScene=true` 时必填） |

**实现（impl）支持矩阵：**

| 编码格式 | CPU | NVIDIA NVENC | Intel QSV | AMD AMF | Apple VideoToolbox |
|-----------|-----|--------------|-----------|---------|--------------------|
| `h264` | `x264` | `h264_nvenc` | `h264_qsv` | `h264_amf` | `h264_videotoolbox` |
| `hevc` | `x265` | `hevc_nvenc` | `hevc_qsv` | `hevc_amf` | `hevc_videotoolbox` |
| `av1` | `svt-av1` | `av1_nvenc` | `av1_qsv` | `av1_amf` | - |
| `vp9` | `libvpx-vp9` | - | `vp9_qsv` | - | - |

如果所选实现与硬件能力不匹配，API 将返回错误；通过 Web 表单创建时会根据检测结果灰显不可用选项。

**响应：**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "input_path": "/path/to/input.mp4",
  "output_path": "/path/to/output[550e8400-e29b-41d4-a716-446655440000].mp4",
  "codec": "h264",
  "impl": "x264",
  "params": {
    "presetKey": "h264:x264:main:medium:23",
    "profile": "main",
    "preset": "medium",
    "qualityMode": "crf",
    "crf": 23,
    "scale": "source"
  },
  "status": "queued",
  "progress": 0,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

**状态码：**
- `201` - 创建成功
- `400` - 请求参数错误
- `500` - 服务器错误

### 查询任务列表

获取所有任务或按状态筛选。

**Endpoint**: `GET /api/jobs`

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `status` | string | 状态筛选：`queued`, `running`, `success`, `failed`, `canceled` |

**响应：**

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "input_path": "/path/to/input.mp4",
      "output_path": "/path/to/output[550e8400-e29b-41d4-a716-446655440000].mp4",
      "codec": "h264",
      "status": "success",
      "progress": 100,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T01:00:00.000Z"
    }
  ]
}
```

**状态码：**
- `200` - 成功

### 获取任务详情

获取单个任务的详细信息。

**Endpoint**: `GET /api/jobs/:id`

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 任务 ID |

**响应：**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "input_path": "/path/to/input.mp4",
  "output_path": "/path/to/output.mp4",
  "codec": "h264",
  "impl": "x264",
  "params": {
    "presetKey": "h264:x264:main:medium:23",
    "profile": "main",
    "preset": "medium",
    "qualityMode": "crf",
    "crf": 23,
    "scale": "source",
    "perScene": true,
    "sceneThreshold": 0.4,
    "enableVmaf": true,
    "vmafMin": 85,
    "vmafMax": 95
  },
  "status": "success",
  "progress": 100,
  "error_msg": null,
  "metrics": {
    "duration": 120.5,
    "bitrate": 2500,
    "vmafScore": 92.3,
    "fileSize": 37821420,
    "encodingTime": 45.2
  },
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T01:00:00.000Z"
}
```

**状态码：**
- `200` - 成功
- `404` - 任务不存在

### 取消任务

取消正在运行或排队的任务。

**Endpoint**: `POST /api/jobs/:id/cancel`

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 任务 ID |

**响应：**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "canceled",
  "progress": 45,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:30:00.000Z"
}
```

**状态码：**
- `200` - 成功
- `400` - 任务已完成，无法取消
- `404` - 任务不存在

### 重试任务

重试失败或已取消的任务。

**Endpoint**: `POST /api/jobs/:id/retry`

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 任务 ID |

**响应：**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "progress": 0,
  "error_msg": null,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T02:00:00.000Z"
}
```

**状态码：**
- `200` - 成功
- `400` - 仅失败或取消的任务可重试
- `404` - 任务不存在

## 任务状态

任务在其生命周期中会经历以下状态：

| 状态 | 说明 |
|------|------|
| `queued` | 任务已创建，等待处理 |
| `running` | 任务正在执行 |
| `success` | 任务成功完成 |
| `failed` | 任务执行失败 |
| `canceled` | 任务被用户取消 |

**状态流转图：**

```
queued → running → success
            ↓
        failed
            ↑
        canceled (通过 API 取消)
            ↓
        queued (通过 retry)
```

## 错误处理

API 使用标准的 HTTP 状态码和统一的错误响应格式。

### 错误响应格式

```json
{
  "error": "错误消息描述"
}
```

### 常见错误码

| 状态码 | 说明 | 示例 |
|--------|------|------|
| `400` | 请求参数错误 | 缺少必填字段、参数格式错误 |
| `404` | 资源不存在 | 任务 ID 不存在 |
| `500` | 服务器内部错误 | 编码过程中出现异常 |

### 具体错误场景

#### 创建任务参数错误

```json
{
  "error": "缺少必要参数"
}
```

```json
{
  "error": "码率模式需要输入有效的码率（Kbps）"
}
```

```json
{
  "error": "场景编码需要设置有效的 VMAF 范围"
}
```

#### 任务操作错误

```json
{
  "error": "已完成任务不可取消"
}
```

```json
{
  "error": "仅失败或取消的任务可重试"
}
```

## 使用示例

### cURL 示例

#### 创建 CRF 编码任务

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "inputPath": "/media/input.mp4",
    "outputPath": "/media/output-crf.mp4",
    "codec": "h264",
    "impl": "x264",
    "params": {
      "presetKey": "h264:x264:main:medium:23",
      "profile": "main",
      "preset": "medium",
      "qualityMode": "crf",
      "crf": 23,
      "scale": "source"
    }
  }'
```

#### 创建码率模式任务

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "inputPath": "/media/input.mp4",
    "outputPath": "/media/output-bitrate.mp4",
    "codec": "hevc",
    "impl": "x265",
    "params": {
      "presetKey": "hevc:x265:main:slow:bitrate",
      "profile": "main",
      "preset": "slow",
      "qualityMode": "bitrate",
      "bitrateKbps": 2500,
      "scale": "1080p"
    }
  }'
```

#### 创建 VMAF 调优任务

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "inputPath": "/media/input.mp4",
    "outputPath": "/media/output-vmaf.mp4",
    "codec": "av1",
    "impl": "svt-av1",
    "params": {
      "presetKey": "av1:svt-av1:baseline:speed-6:bitrate",
      "profile": "baseline",
      "preset": "speed-6",
      "qualityMode": "bitrate",
      "bitrateKbps": 2000,
      "enableVmaf": true,
      "vmafMin": 85,
      "vmafMax": 95
    }
  }'
```

#### 创建场景编码任务

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "inputPath": "/media/input.mp4",
    "outputPath": "/media/output-scenes.mp4",
    "codec": "h264",
    "impl": "x264",
    "params": {
      "presetKey": "h264:x264:main:medium:bitrate",
      "profile": "main",
      "preset": "medium",
      "qualityMode": "bitrate",
      "bitrateKbps": 3000,
      "perScene": true,
      "sceneThreshold": 0.4,
      "enableVmaf": true,
      "vmafMin": 85,
      "vmafMax": 95
    }
  }'
```

#### 查询运行中的任务

```bash
curl http://localhost:3000/api/jobs?status=running
```

#### 取消任务

```bash
curl -X POST http://localhost:3000/api/jobs/550e8400-e29b-41d4-a716-446655440000/cancel
```

#### 重试失败任务

```bash
curl -X POST http://localhost:3000/api/jobs/550e8400-e29b-41d4-a716-446655440000/retry
```

### JavaScript/Node.js 示例

```javascript
// 创建任务
const response = await fetch('http://localhost:3000/api/jobs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    inputPath: '/media/input.mp4',
    outputPath: '/media/output.mp4',
    codec: 'h265',
    impl: 'ffmpeg',
    params: {
      qualityMode: 'crf',
      crf: 23,
      scale: 'source',
      enableVmaf: true,
      vmafMin: 85,
      vmafMax: 95
    }
  })
});

const job = await response.json();
console.log('创建任务:', job.id);

// 轮询任务状态
while (true) {
  const statusResponse = await fetch(`http://localhost:3000/api/jobs/${job.id}`);
  const status = await statusResponse.json();
  
  console.log(`进度: ${status.progress}%`);
  
  if (status.status === 'success') {
    console.log('任务完成!', status.metrics);
    break;
  } else if (status.status === 'failed') {
    console.error('任务失败:', status.error_msg);
    break;
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

### Python 示例

```python
import requests
import time

# 创建任务
response = requests.post('http://localhost:3000/api/jobs', json={
    'inputPath': '/media/input.mp4',
    'outputPath': '/media/output.mp4',
    'codec': 'h264',
    'impl': 'ffmpeg',
    'params': {
        'qualityMode': 'crf',
        'crf': 23,
        'scale': 'source'
    }
})

job = response.json()
print(f"创建任务: {job['id']}")

# 轮询状态
while True:
    response = requests.get(f"http://localhost:3000/api/jobs/{job['id']}")
    status = response.json()
    
    print(f"进度: {status['progress']}%")
    
    if status['status'] == 'success':
        print(f"任务完成! VMAF: {status['metrics']['vmafScore']}")
        break
    elif status['status'] == 'failed':
        print(f"任务失败: {status['error_msg']}")
        break
    
    time.sleep(1)
```

## WebSocket 支持（未来规划）

当前版本使用轮询方式获取任务进度。未来版本计划支持 WebSocket 实时推送进度更新。

## 速率限制

当前版本无速率限制。生产环境建议添加：

- 每个 IP 的请求频率限制
- 并发任务数量限制
- API 密钥认证

## 监控指标

通过任务详情 API 可获取以下编码指标：

| 指标 | 说明 |
|------|------|
| `duration` | 视频时长（秒） |
| `bitrate` | 输出码率（bps） |
| `vmafScore` | VMAF 质量分数 |
| `fileSize` | 文件大小（字节） |
| `encodingTime` | 编码耗时（秒） |

这些指标可用于质量分析和性能优化。
