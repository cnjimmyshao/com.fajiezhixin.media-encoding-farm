# 架构说明

## 系统概览
单机版视频编码农场完全运行在 Node.js ≥ 22 环境，使用 ES Modules。Express 5 提供 HTTP API 与 Pug 模板渲染，FFmpeg + FFprobe 负责实际媒体处理，SQLite（通过 `node:sqlite`）持久化任务与审计日志。系统以单进程串行方式调度任务，确保实现简单且易于调试。

## 主要模块
- `app.mjs`：应用入口，合并配置、挂载中间件与路由，并启动调度循环。
- `src/routes/{web,api}.mjs`：分别渲染任务页面和暴露 JSON API，所有请求最终委派给控制器。
- `src/controllers/jobs.mjs`：封装 CRUD、审计写入、队列查询等业务逻辑。
- `src/services/ffmpeg-runner.mjs`：调用 ffprobe 估算时长、拼装参数、spawn ffmpeg，并把进度/结果写回数据库；支持场景检测、分片编码、自适应码率和 HLS/DASH 产物生成。
- `src/services/presets.mjs`：集中维护编码格式 → 编码器 → Profile/Preset 的参数矩阵，供表单与执行器共用。
- `src/services/hardware-capabilities.mjs`：在启动阶段检测 ffmpeg 可用的 GPU/硬件编码器，提供给前端禁用本机不支持的选项。
- `src/db/{sql,migrate}.mjs`：`DatabaseSync` 的 Promise 包装，以及建表脚本。

## 请求与调度流程
1. 用户通过 `/jobs/new` 表单提交输入/输出路径，可选缩放分辨率、Profile、Preset，切换 CRF / 码率模式，还可设定 VMAF 区间或启用按场景编码；前端生成完整的 `codec/impl/profile/preset` 组合并 POST `/api/jobs`。
2. API 控制器写入 `jobs` 表，同时记录 `audit_logs`（仅 CUD 操作）。
3. `schedulerLoop` 轮询队列：若存在 `running` 任务则等待，否则取最早的 `queued` 任务。
4. 调度器用 FFprobe 获取时长，随后调用 `runJob`。执行期间解析 stderr 时间戳更新 `progress`，完成后写入 metrics 或错误信息；若启用了码率+VMAF 目标会在单次或按场景多次尝试不同码率直至逼近目标区间，按场景模式下还会自动合并片段并生成 HLS/DASH 清单。
5. Web 端通过 `/jobs`、`/jobs/:id` 配合 `fetch /api/jobs/:id` 实时展示状态与进度条。

## 数据模型
### jobs
| 字段 | 说明 |
| --- | --- |
| id | `crypto.randomUUID()` |
| input_path / output_path | 绝对路径 |
| codec / impl | 选择的编码格式与编码器 |
| params_json | 包含 `presetKey`、profile、preset、scale、qualityMode、crf/bitrate、VMAF 目标、perScene 等 |
| status / progress | `queued/running/success/failed/canceled` + 0-100 |
| metrics_json | 目前记录输出文件大小，可扩展 |
| error_msg | 失败原因 |

### audit_logs
记录每次 `create/update/delete` 的动作、实体、详情 JSON 与时间戳，便于后续审计。

## 配置与运行
- 配置：`config/default.mjs` 提供 server/paths/ffmpeg 默认值，可通过环境变量覆盖。
- 启动：`pnpm start` 调用 `scripts/boot-app.mjs`，若缺少 `vef.db` 会先执行迁移。
- 依赖安装：`pnpm install`；迁移：`pnpm migrate`。

该架构可以在不引入额外队列/worker 的情况下完成“提交 → 排队 → 编码 → 回填”的完整闭环，同时保留扩展空间（多 profile、多封装、监控等）。***
