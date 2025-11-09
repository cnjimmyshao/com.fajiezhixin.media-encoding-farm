/**
 * @file 可选加载 .env 后再运行指定入口
 * @description 通过 process.loadEnvFile 在存在 .env 时注入环境变量
 */
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [entry, ...argvRest] = process.argv.slice(2);

if (!entry) {
  console.error('缺少入口文件参数。例如：node scripts/run-with-env.mjs app.mjs');
  process.exit(1);
}

try {
  await access('.env');
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

process.argv = [process.argv[0], entry, ...argvRest];

const entryUrl = pathToFileURL(resolve(entry));
await import(entryUrl);
