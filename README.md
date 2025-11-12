# 视频编码农场（Video Encoding Farm）

一个功能丰富的单机视频转码管理系统，支持智能场景检测、VMAF 质量评估、CUDA 加速等高级特性。

## ✨ 核心特性

- 🎬 **智能场景编码** - 自动检测视频场景边界，为每个场景优化编码参数
- 📊 **VMAF 质量评估** - 基于 VMAF 分数的动态质量优化，支持目标质量范围调优
- ⚡ **CUDA 加速** - 自动检测并使用 NVIDIA GPU 硬件加速（NVENC）
- 🎯 **多编码器支持** - x264, x265, SVT-AV1, VP9, NVENC 等主流编码器
- 📱 **流媒体输出** - 支持 HLS 和 DASH 流媒体格式生成
- 🌐 **远程输入** - 支持 HTTP/HTTPS 远程输入源
- 📋 **完整 API** - RESTful API 和直观的 Web 界面
- 📝 **审计日志** - 完整的操作审计追踪

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
    "impl": "ffmpeg",
    "params": {
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

## 🔌 API 参考

### 创建任务

`POST /api/jobs`

**请求体：**
```json
{
  "inputPath": "/path/to/input.mp4",
  "outputPath": "/path/to/output.mp4",
  "codec": "h264|h265|av1|vp9",
  "impl": "ffmpeg|nvenc",
  "params": {
    "qualityMode": "crf|bitrate",
    "crf": 23,
    "bitrateKbps": 2000,
    "scale": "source|720p|1080p|4k",
    "perScene": false,
    "sceneThreshold": 0.4,
    "enableVmaf": false,
    "vmafMin": 85,
    "vmafMax": 95
  }
}
```

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
│   │   ├── logger.mjs
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

## 🚨 故障排查

### 常见问题

1. **ffmpeg 未找到**
   - 确保 ffmpeg 和 ffprobe 在 PATH 中
   - 或设置 `FFMPEG_BIN` 和 `FFPROBE_BIN`

2. **CUDA 未启用**
   - 检查 NVIDIA 驱动是否安装
   - 验证 ffmpeg 是否支持 NVENC

3. **VMAF 失败**
   - 确保 VMAF 模型文件存在
   - 检查 ffmpeg 编译时是否启用 VMAF 支持

### 日志位置

- 控制台输出（使用 Morgan 日志中间件）
- 任务日志：工作区目录下的 `.log` 文件

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
