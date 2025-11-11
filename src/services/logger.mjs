/**
 * @file 日志服务
 * @description 提供一个简单的、基于环境的日志记录器
 */

import { createWriteStream } from 'node:fs';
import { format } from 'node:util';

const isDev = process.env.NODE_ENV === 'development';
const logStream = createWriteStream('vef-app.txt', { flags: 'a' });

function writeLog(level, message, ...args) {
  const formattedMessage = format(`[${level}] ${message}`, ...args);
  logStream.write(`${formattedMessage}\n`);
  if (level === 'ERROR') {
    console.error(formattedMessage);
  } else if (level === 'WARN') {
    console.warn(formattedMessage);
  } else {
    console.log(formattedMessage);
  }
}

const logger = {
  /**
   * @param {string} message 日志消息
   * @param  {...any} args 额外参数
   */
  info(message, ...args) {
    writeLog('INFO', message, ...args);
  },

  /**
   * @param {string} message 日志消息
   * @param  {...any} args 额外参数
   */
  warn(message, ...args) {
    writeLog('WARN', message, ...args);
  },

  /**
   * @param {string} message 日志消息
   * @param  {...any} args 额外参数
   */
  error(message, ...args) {
    writeLog('ERROR', message, ...args);
  },

  /**
   * @param {string} message 日志消息
   * @param  {...any} args 额外参数
   */
  debug(message, ...args) {
    if (isDev) {
      writeLog('DEBUG', message, ...args);
    }
  }
};

export default logger;
