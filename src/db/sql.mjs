/**
 * @file SQLite 打开工具
 * @description 使用 node:sqlite 提供数据库连接实例
 */
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const dbPath = resolve('./vef.db');

/**
 * @description 基于 DatabaseSync 的最小异步包装，提供 run/get/all/exec
 */
class Database {
  constructor(filename) {
    this.instance = new DatabaseSync(filename);
  }

  async run(sql, ...params) {
    const stmt = this.instance.prepare(sql);
    const result = stmt.run(...params);
    return result;
  }

  async get(sql, ...params) {
    const stmt = this.instance.prepare(sql);
    return stmt.get(...params);
  }

  async all(sql, ...params) {
    const stmt = this.instance.prepare(sql);
    return stmt.all(...params);
  }

  async exec(sql) {
    return this.instance.exec(sql);
  }

  async close() {
    this.instance.close();
  }
}

export const db = new Database(dbPath);

process.on('exit', () => {
  try {
    db.instance?.close();
  } catch (error) {
    // ignore close errors on exit
  }
});

export default db;
