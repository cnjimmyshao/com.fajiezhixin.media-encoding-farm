# 视频编码农场（单机原型）

## 先决条件
- Node.js 22 或更高版本（需支持 `--env-file` 与 ESM）。
- 本机已安装 `ffmpeg` 与 `ffprobe`，并已加入 `PATH`。
- 推荐准备 10-30 秒的测试样片（mp4）。

## 安装依赖
```bash
pnpm install
```

## 初始化数据库
```bash
pnpm migrate
```

## 启动服务
```bash
pnpm start
```

服务默认运行在 `http://localhost:3000`。

## 环境变量
可通过 `.env` 或启动参数设置下列变量：
- `PORT`：HTTP 端口，默认 3000。
- `WORKSPACE_PATH`：工作区目录，默认 `/tmp/vef`。
- `FFMPEG_BIN`：自定义 ffmpeg 可执行文件路径。
- `FFPROBE_BIN`：自定义 ffprobe 可执行文件路径。
- `FFMPEG_TIMEOUT_FACTOR`：超时系数，默认 5。

## 使用流程
1. 访问 `http://localhost:3000/jobs/new`，填入输入/输出文件绝对路径，并选择转码预设。
2. 提交后浏览器将跳转到任务详情页，可看到进度条每秒刷新。
3. 列表页 `/jobs` 提供所有任务的状态概览。
4. 失败或取消的任务可在详情页点击“重试任务”。

### 冒烟测试示例
假设存在样片 `/home/user/sample.mp4`，创建任务时可将输出填写为 `/home/user/sample-av1.mp4`。

## 审计日志
所有任务的创建、更新、删除都会写入 `audit_logs` 表，可按需自行查询。
