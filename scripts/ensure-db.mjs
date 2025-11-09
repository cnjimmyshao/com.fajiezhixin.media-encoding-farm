/**
 * @file 启动前的数据库检查
 * @description 如缺失 vef.db 则触发迁移脚本
 */
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const dbPath = resolve('./vef.db');

export async function ensureDatabase() {
  try {
    await access(dbPath);
    return;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  console.info('[boot] 未检测到数据库文件，正在执行迁移...');
  await import('../src/db/migrate.mjs');
}
