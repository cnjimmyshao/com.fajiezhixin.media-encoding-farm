/**
 * @file 任务控制器
 * @description 提供创建、查询、更新与审计日志写入能力
 */
import { randomUUID } from 'node:crypto';
import { dirname, basename, extname, join } from 'node:path';
import { db } from '../db/sql.mjs';

/**
 * @description 解析数据库行到业务对象
 * @param {Record<string, any>} row 原始行
 * @returns {Record<string, any>} 任务对象
 */
function mapJob(row) {
  if (!row) return null;
  return {
    ...row,
    params: row.params_json ? JSON.parse(row.params_json) : {},
    metrics: row.metrics_json ? JSON.parse(row.metrics_json) : null
  };
}

/**
 * @description 写入审计日志
 * @param {string} action 动作
 * @param {string} entityId 实体标识
 * @param {Record<string, any>} detail 详情
 */
async function writeAudit(action, entityId, detail) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  await db.run(
    `INSERT INTO audit_logs (id, action, entity, entity_id, detail_json, created_at) VALUES (?, ?, 'jobs', ?, ?, ?)`,
    id,
    action,
    entityId,
    JSON.stringify(detail ?? {}),
    createdAt
  );
}

/**
 * @description 创建新任务
 * @param {object} payload 任务参数
 * @returns {Promise<object>} 创建的任务
 */
export async function createJob(payload) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const paramsJson = payload.params ? JSON.stringify(payload.params) : null;

  const { outputPath } = payload;
  const dir = dirname(outputPath);
  const ext = extname(outputPath);
  const name = basename(outputPath, ext);
  const newOutputPath = join(dir, `${name}-${id}${ext}`);

  await db.run(
    `INSERT INTO jobs (id, input_path, output_path, codec, impl, params_json, status, progress, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?)`
      ,
    id,
    payload.inputPath,
    newOutputPath,
    payload.codec,
    payload.impl,
    paramsJson,
    now,
    now
  );
  await writeAudit('create', id, { ...payload, id, outputPath: newOutputPath });
  return getJobById(id);
}

/**
 * @description 根据筛选条件获取任务列表
 * @param {object} [filter] 筛选条件
 * @returns {Promise<object[]>} 任务数组
 */
export async function listJobs(filter = {}) {
  const where = [];
  const params = [];
  if (filter.status) {
    where.push('status = ?');
    params.push(filter.status);
  }
  const rows = await db.all(
    `SELECT * FROM jobs ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC`,
    ...params
  );
  return rows.map(mapJob);
}

/**
 * @description 获取单个任务
 * @param {string} id 任务标识
 * @returns {Promise<object|null>} 任务
 */
export async function getJobById(id) {
  const row = await db.get(`SELECT * FROM jobs WHERE id = ?`, id);
  return mapJob(row);
}

/**
 * @description 更新任务字段
 * @param {string} id 任务标识
 * @param {Record<string, any>} fields 更新字段
 * @returns {Promise<object>} 更新后的任务
 */
export async function updateJob(id, fields) {
  const allowedFields = ['status', 'progress', 'error_msg', 'metrics_json'];
  const keys = Object.keys(fields).filter(key => allowedFields.includes(key));
  if (!keys.length) {
    return getJobById(id);
  }
  const assignments = keys.map((key) => `${key} = ?`).join(', ');
  const params = keys.map((key) =>
    key.endsWith('_json') && typeof fields[key] !== 'string'
      ? JSON.stringify(fields[key])
      : fields[key]
  );
  const now = new Date().toISOString();
  await db.run(
    `UPDATE jobs SET ${assignments}, updated_at = ? WHERE id = ?`,
    ...params,
    now,
    id
  );
  await writeAudit('update', id, fields);
  return getJobById(id);
}

/**
 * @description 删除任务
 * @param {string} id 任务标识
 */
export async function deleteJob(id) {
  await db.run(`DELETE FROM jobs WHERE id = ?`, id);
  await writeAudit('delete', id, {});
}

/**
 * @description 获取第一条排队任务
 * @returns {Promise<object|null>} 任务
 */
export async function getNextQueuedJob() {
  const row = await db.get(
    `SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1`
  );
  return mapJob(row);
}

/**
 * @description 检查是否存在运行中的任务
 * @returns {Promise<boolean>} 是否存在
 */
export async function hasRunningJob() {
  const row = await db.get(`SELECT COUNT(1) AS cnt FROM jobs WHERE status = 'running'`);
  return row?.cnt > 0;
}
