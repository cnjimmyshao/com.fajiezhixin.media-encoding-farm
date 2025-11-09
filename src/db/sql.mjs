/**
 * @file SQLite 打开工具
 * @description 使用 node:sqlite 提供数据库连接实例
 */
import { openDB } from 'node:sqlite';
import { sqlite3 } from 'node:sqlite/sqlite3';
import { resolve } from 'node:path';

const dbPath = resolve('./vef.db');

/**
 * @description 打开或创建 SQLite 数据库
 */
export const db = await openDB({
  filename: dbPath,
  driver: sqlite3.Database
});

export default db;
