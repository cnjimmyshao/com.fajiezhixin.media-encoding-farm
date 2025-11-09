/**
 * @file 环境变量配置
 * @description 将运行期所需的常量通过环境变量集中输出
 */
import { resolve } from 'node:path';

export const envConfig = {
  dbPath: resolve(process.env.VEF_DB_PATH ?? './data/vef.db')
};

export default envConfig;
