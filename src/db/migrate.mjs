/**
 * @file 数据库初始化脚本
 * @description 创建 jobs 与 audit_logs 表结构
 */
import { db } from './sql.mjs';

await db.exec(`
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  input_path TEXT NOT NULL,
  output_path TEXT NOT NULL,
  codec TEXT NOT NULL CHECK(codec IN ('av1','hevc','h264','vp9')),
  impl TEXT NOT NULL CHECK(impl IN ('svt-av1','x265','x264','hevc_nvenc','hevc_amf','hevc_qsv','hevc_videotoolbox','h264_nvenc','h264_amf','h264_qsv','h264_videotoolbox','libvpx-vp9')),
  params_json TEXT,
  status TEXT NOT NULL CHECK(status IN ('queued','running','success','failed','canceled')),
  progress REAL DEFAULT 0,
  metrics_json TEXT,
  error_msg TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

await db.exec(`
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  detail_json TEXT,
  created_at TEXT NOT NULL
);
`);

console.log('migrate done');
