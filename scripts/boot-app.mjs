/**
 * @file 服务启动入口
 * @description 启动前确保数据库存在，然后加载应用
 */
import { ensureDatabase } from './ensure-db.mjs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

await ensureDatabase();

const appEntryUrl = pathToFileURL(resolve('./app.mjs'));
await import(appEntryUrl);
