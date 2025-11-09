/**
 * @file 启动前的数据库检查
 * @description 如缺失 vef.db 则触发迁移脚本
 */
import { access, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import envConfig from '../config/env.mjs';

const { dbPath } = envConfig;

export async function ensureDatabase() {
  await mkdir(dirname(dbPath), { recursive: true });
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
