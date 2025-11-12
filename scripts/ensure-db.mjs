/**
 * @file 启动前的数据库检查
 * @description 如缺失 vef.db 则触发迁移脚本，同时处理断电后的僵尸任务
 */
import { access, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import envConfig from '../config/env.mjs';

const { dbPath } = envConfig;

export async function ensureDatabase() {
  await mkdir(dirname(dbPath), { recursive: true });

  // 检查数据库文件是否存在
  let dbExists = false;
  try {
    await access(dbPath);
    dbExists = true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  // 如果数据库不存在，执行迁移
  if (!dbExists) {
    console.info('[boot] 未检测到数据库文件，正在执行迁移...');
    await import('../src/db/migrate.mjs');
    return;
  }

  // 数据库已存在，检查并清理僵尸任务 (断电重启后的恢复逻辑)
  console.info('[boot] 检测到数据库文件，检查僵尸任务...');
  await recoverFromCrash();
}

// 如果是直接运行此脚本，执行 ensureDatabase
if (import.meta.url === `file://${process.argv[1]}`) {
  await ensureDatabase();
}

/**
 * @description 恢复因断电/崩溃导致的僵尸任务
 * 将所有 status='running' 的任务重置为 'failed' 状态
 */
async function recoverFromCrash() {
  try {
    // 动态导入 db 模块，避免循环依赖
    const { db } = await import('../src/db/sql.mjs');

    // 查询所有 running 状态的任务
    const runningJobs = await db.all(
      `SELECT id, input_path, output_path, progress FROM jobs WHERE status = 'running'`
    );

    if (runningJobs.length === 0) {
      console.info('[boot] 未发现僵尸任务，系统正常启动');
      return;
    }

    console.warn(`[boot] 发现 ${runningJobs.length} 个僵尸任务，正在恢复...`);

    // 将所有 running 任务重置为 failed
    const now = new Date().toISOString();
    await db.run(
      `UPDATE jobs
       SET status = 'failed',
           error_msg = '系统重启导致任务中断',
           updated_at = ?
       WHERE status = 'running'`,
      now
    );

    // 写入审计日志
    for (const job of runningJobs) {
      const auditId = randomUUID();
      await db.run(
        `INSERT INTO audit_logs (id, action, entity, entity_id, detail_json, created_at)
         VALUES (?, 'recover', 'jobs', ?, ?, ?)`,
        auditId,
        job.id,
        JSON.stringify({
          recoveredFrom: 'running',
          recoveredTo: 'failed',
          recoveredAt: now,
          previousProgress: job.progress,
          reason: 'system_restart'
        }),
        now
      );
    }

    console.warn(`[boot] 已恢复 ${runningJobs.length} 个僵尸任务:`);
    for (const job of runningJobs) {
      console.warn(`  - 任务 ${job.id}: ${job.input_path} → ${job.output_path} (进度: ${job.progress}%)`);
    }
  } catch (error) {
    console.error('[boot] 僵尸任务恢复失败:', error.message);
    // 不阻止系统启动，继续运行
  }
}
