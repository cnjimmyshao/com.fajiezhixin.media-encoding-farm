# 视频编码农场（Video Encoding Farm）

一个功能丰富的单机视频转码管理系统，支持智能场景检测、VMAF 质量评估、CUDA 加速等高级特性。

## ✨ 核心特性

- 🎬 **智能场景编码** - 自动检测视频场景边界，为每个场景优化编码参数
- 📊 **VMAF 质量评估** - 基于 VMAF 分数的动态质量优化，支持目标质量范围调优
- ⚡ **CUDA 加速** - 自动检测并使用 NVIDIA GPU 硬件加速（NVENC）
- 🎯 **多编码器支持** - x264, x265, SVT-AV1, VP9, NVENC (H.264/HEVC/AV1) 等主流编码器
- 📱 **流媒体输出** - 支持 HLS 和 DASH 流媒体格式生成
- 🌐 **远程输入** - 支持 HTTP/HTTPS 远程输入源
- 📋 **完整 API** - RESTful API 和直观的 Web 界面
- 📝 **审计日志** - 完整的操作审计追踪
- 🎯 **VMAF 目标模式** - 设置目标 VMAF 分数，系统自动调整编码参数
- 🔧 **场景切片编码** - 按场景自动分段编码，每段使用最优参数

## 🚀 快速开始

### 前提条件

- Node.js 22 或更高版本（需支持 `--env-file` 与 ESM）
- 本机已安装 `ffmpeg` 与 `ffprobe`，并已加入 `PATH`
- 推荐准备 10-30 秒的测试样片（mp4）
- 全局安装 `pnpm`（建议 10.x 以上版本）

### 安装步骤

1. **安装依赖**
   ```bash
   pnpm install
   ```

2. **初始化数据库**
   ```bash
   pnpm migrate
   ```

3. **启动服务**
   ```bash
   # 生产环境
   pnpm start
   
   # 开发环境
   pnpm dev
   ```

服务默认运行在 `http://localhost:3000`。

### 冒烟测试

使用 curl 创建测试任务：
```bash
curl -X POST http://localhost:3000/api/jobs \
  -H 'Content-Type: application/json' \
  -d '{
    "inputPath": "/path/to/sample.mp4",
    "outputPath": "/path/to/output.mp4",
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

## ⚙️ 环境变量配置

创建 `.env` 文件（参考 `.env.example`）：

```bash
# 服务器配置
PORT=3000
WORKSPACE_PATH=/tmp/vef

# FFmpeg 路径（如非系统默认）
FFMPEG_BIN=ffmpeg
FFPROBE_BIN=ffprobe

# VMAF 配置（可选）
VMAF_MODEL=vmaf_v0.6.1
VMAF_N_THREADS=4
VMAF_N_SUBSAMPLE=5
VMAF_FPS=

# 超时系数
FFMPEG_TIMEOUT_FACTOR=5
```

## 🎮 使用指南

### Web 界面

1. **创建任务**：访问 `http://localhost:3000/jobs/new`
   - 填写输入/输出文件路径（支持本地路径和 HTTP URL）
   - 选择编码器和预设
   - 配置质量模式（CRF 或码率）
   - 启用场景编码和 VMAF 调优（可选）

2. **任务监控**：访问 `http://localhost:3000/jobs`
   - 查看所有任务状态
   - 实时监控进度
   - 支持取消和重试操作

3. **任务详情**：点击任务 ID 查看
   - 详细进度信息
   - 编码参数和指标
   - 错误日志（如失败）

### 高级功能

#### VMAF 目标质量模式
设置目标 VMAF 质量范围，系统自动调整编码参数以达到目标质量：
```json
{
  "params": {
    "qualityMode": "vmaf",
    "vmafMin": 85,
    "vmafMax": 95
  }
}
```

#### VMAF 智能调优
启用 VMAF 后，系统会自动调整编码参数以达到目标质量范围：
```json
{
  "params": {
    "enableVmaf": true,
    "vmafMin": 85,
    "vmafMax": 95,
    "qualityMode": "bitrate"
  }
}
```

#### 场景检测编码
为不同场景使用最优编码参数：
```json
{
  "params": {
    "perScene": true,
    "sceneThreshold": 0.4,
    "vmafMin": 85,
    "vmafMax": 95
  }
}
```

#### CUDA 加速
系统自动检测 NVIDIA GPU 并启用硬件加速，无需手动配置。

支持的 NVENC 编码器：
- **H.264 NVENC** - 高效视频编码（H.264/AVC）
- **HEVC NVENC** - 高效视频编码（H.265/HEVC）
- **AV1 NVENC** - 下一代视频编码（AV1）

## 🔌 API 参考

### 创建任务

`POST /api/jobs`

**请求体：**
```json
{
  "inputPath": "/path/to/input.mp4",
  "outputPath": "/path/to/output.mp4",
  "codec": "h264|hevc|av1|vp9",
  "impl": "见下方支持矩阵",
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

> ℹ️ **注意**：后端会在保存任务时将输出文件名改写为 `文件名[任务ID].扩展名`，以避免并发任务写入同一路径。

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `inputPath` | string | ✅ | 输入文件路径，可为本地绝对路径或 HTTP/HTTPS URL |
| `outputPath` | string | ✅ | 期望输出路径（保存时会自动追加任务 ID） |
| `codec` | string | ✅ | 编码格式：`h264` / `hevc` / `av1` / `vp9` |
| `impl` | string | ✅ | 具体编码实现，需与 `codec` 匹配（见下方矩阵） |
| `params` | object | ➖ | 编码参数对象 |

**`params` 字段说明：**

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `presetKey` | string | - | 预设缓存键，格式 `codec:impl:profile:preset:crf|bitrate`，用于命中历史配置 |
| `profile` | string | 依编码器 | 编码 Profile，例如 H.264: `baseline`/`main`/`high`，HEVC: `main`/`main10` |
| `preset` | string | 依编码器 | 编码速度预设（如 `medium`、`p4`、`speed` 等） |
| `qualityMode` | string | `"crf"` | 质量模式：`crf`、`bitrate`、`vmaf` |
| `crf` | number | `23` | CRF 值（0-51，`qualityMode=crf` 时必填） |
| `bitrateKbps` | number | - | 目标码率（Kbps，`qualityMode=bitrate` 时必填） |
| `scale` | string | `"source"` | 输出分辨率：`source`, `360p`, `480p`, `720p`, `1080p`, `4k` |
| `enableVmaf` | boolean | `false` | 是否在编码完成后计算 VMAF 指标 |
| `vmafMin` | number | - | VMAF 最低目标分数（0-100，`qualityMode=vmaf` 或 `perScene=true` 时必填） |
| `vmafMax` | number | - | VMAF 最高目标分数（0-100，`qualityMode=vmaf` 或 `perScene=true` 时必填） |
| `perScene` | boolean | `false` | 是否启用场景切片编码（需要提供有效的 `vmafMin/vmafMax`） |
| `sceneThreshold` | number | `0.4` | 场景检测灵敏度（0.01-1.0，`perScene=true` 时必填） |

**实现（impl）支持矩阵：**

| 编码格式 | CPU | NVIDIA NVENC | Intel QSV | AMD AMF | Apple VideoToolbox |
|-----------|-----|--------------|-----------|---------|--------------------|
| `h264` | `x264` | `h264_nvenc` | `h264_qsv` | `h264_amf` | `h264_videotoolbox` |
| `hevc` | `x265` | `hevc_nvenc` | `hevc_qsv` | `hevc_amf` | `hevc_videotoolbox` |
| `av1` | `svt-av1` | `av1_nvenc` | `av1_qsv` | `av1_amf` | - |
| `vp9` | `libvpx-vp9` | - | `vp9_qsv` | - | - |

前端会根据 `hardware-capabilities` 的检测结果禁用本机不可用的实现，直接调用 API 时需要手动保证组合有效。

**响应：**
```json
{
  "id": "uuid",
  "status": "queued",
  "progress": 0,
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

### 查询任务

`GET /api/jobs` - 获取所有任务
`GET /api/jobs?status=running` - 按状态筛选
`GET /api/jobs/:id` - 获取单个任务详情

### 任务操作

`POST /api/jobs/:id/cancel` - 取消任务  
`POST /api/jobs/:id/retry` - 重试失败/取消的任务

### 任务状态

- `queued` - 排队中
- `running` - 运行中
- `success` - 成功完成
- `failed` - 失败
- `canceled` - 已取消

## 📁 项目结构

```
├── app.mjs                 # 应用入口
├── config/
│   └── default.mjs        # 默认配置
├── src/
│   ├── controllers/       # 业务逻辑
│   │   └── jobs.mjs
│   ├── db/               # 数据库
│   │   ├── migrate.mjs
│   │   └── sql.mjs
│   ├── routes/           # 路由
│   │   ├── api.mjs
│   │   └── web.mjs
│   ├── services/         # 服务层
│   │   ├── ffmpeg-runner.mjs
│   │   ├── ffmpeg/       # FFmpeg 相关模块
│   │   │   ├── encoders/ # 编码器配置
│   │   │   │   ├── impl-x264.mjs
│   │   │   │   ├── impl-x265.mjs
│   │   │   │   ├── impl-libvpx-vp9.mjs
│   │   │   │   ├── impl-svt-av1.mjs
│   │   │   │   ├── impl-h264-nvenc.mjs
│   │   │   │   ├── impl-hevc-nvenc.mjs
│   │   │   │   └── impl-av1-nvenc.mjs
│   │   │   └── ...
│   │   ├── logger.mjs
│   │   ├── hardware-capabilities.mjs
│   │   └── presets.mjs
│   └── public/           # 静态资源
├── views/                # Pug 模板
├── scripts/              # 脚本
└── data/                 # SQLite 数据库
```

## 🔧 高级配置

项目使用 `config/default.mjs` 作为配置中心，包含：

- **编码参数**：GOP 长度、关键帧间隔
- **VMAF 参数**：模型版本、调优尝试次数、线程数
- **ABR 模式**：码率因子、缓冲区配置
- **场景检测**：敏感度阈值
- **CUDA 配置**：设备选择、能力检测

详见 [docs/configuration.md](docs/configuration.md)。

## 🧪 开发指南

### 测试

项目使用 Node.js 内置测试运行器：
```bash
# 运行所有测试
node --test src/**/*.spec.mjs

# 运行特定测试
node --test src/controllers/jobs.spec.mjs
```

### 代码风格

- ES Modules (`type: module`)
- 2 空格缩进
- JSDoc 注释
- camelCase 命名
- 描述性标识符

### 提交规范

使用轻量级 Conventional Commits：
- `feat:` - 新功能
- `fix:` - 修复
- `chore:` - 杂项
- `docs:` - 文档

## 📊 审计日志

所有任务操作记录在 `audit_logs` 表中：

```sql
SELECT * FROM audit_logs WHERE entity = 'jobs' ORDER BY created_at DESC;
```

## 🧪 测试

### 编码器测试

项目提供完整的编码器测试脚本：

```bash
# 测试所有编码器（使用 ultrafast 加速）
bash temp/test-all-codecs-ultrafast.sh

# 测试结果报告位置
# - 测试日志: temp/test-results.log
# - 输出文件: temp/output/
# - 详细报告: temp/TEST_REPORT.md
```

**测试覆盖**：
- ✅ CPU 编码器: H.264 (x264), HEVC (x265), VP9 (libvpx-vp9), AV1 (SVT-AV1)
- ✅ NVENC 硬件编码器: H.264 NVENC, HEVC NVENC, AV1 NVENC
- ✅ 不同质量模式: CRF、Bitrate、VMAF 目标
- ✅ 分辨率缩放: 360p, 480p, 720p, 1080p
- ✅ 场景检测和分段编码

### 单元测试

项目使用 Node.js 内置测试运行器：

```bash
# 运行所有测试
node --test src/**/*.spec.mjs

# 运行特定测试
node --test src/controllers/jobs.spec.mjs

# 监听模式
node --test --watch src/**/*.spec.mjs
```

### 硬件检测测试

验证硬件编码器支持：

```bash
# 检测可用编码器
node temp/test-hardware-detect.mjs

# 预期输出：
# ✅ NVENC 编码器 (NVIDIA):
#   - h264_nvenc
#   - hevc_nvenc
#   - av1_nvenc
```

## 🚨 故障排查

### 常见问题

1. **ffmpeg 未找到**
   - 确保 ffmpeg 和 ffprobe 在 PATH 中
   - 或设置 `FFMPEG_BIN` 和 `FFPROBE_BIN`

2. **CUDA 未启用**
   - 检查 NVIDIA 驱动是否安装
   - 验证 ffmpeg 是否支持 NVENC
   - 运行测试脚本确认检测: `node temp/test-hardware-detect.mjs`

3. **VMAF 失败**
   - 确保 VMAF 模型文件存在
   - 检查 ffmpeg 编译时是否启用 VMAF 支持
   - 查看任务日志获取详细错误

4. **编码器不显示**
   - 运行硬件检测测试
   - 检查浏览器控制台是否有 JavaScript 错误

### 日志位置

- **控制台输出**: 使用 Morgan 日志中间件
- **任务日志**: 工作区目录下的 `.log` 文件
- **测试日志**: `temp/test-results.log`
- **系统日志**: SQLite 数据库中的 `audit_logs` 表

## 🔒 安全建议

- 不要将 `.env` 文件提交到版本控制
- 使用 `.env.example` 作为模板
- 限制对输出目录的文件系统权限
- 在反向代理后部署（生产环境）

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题，请：
1. 查看 [docs/](docs/) 目录下的详细文档
2. 检查 [AGENTS.md](AGENTS.md) 开发指南
3. 提交 Issue 到项目仓库
