/**
 * @file 日志服务
 * @description 提供一个简单的、基于环境的日志记录器
 */

const isDev = process.env.NODE_ENV === 'development';

const logger = {
  /**
   * @param {string} message 日志消息
   * @param  {...any} args 额外参数
   */
  info(message, ...args) {
    console.log(`[INFO] ${message}`, ...args);
  },

  /**
   * @param {string} message 日志消息
   * @param  {...any} args 额外参数
   */
  warn(message, ...args) {
    console.warn(`[WARN] ${message}`, ...args);
  },

  /**
   * @param {string} message 日志消息
   * @param  {...any} args 额外参数
   */
  error(message, ...args) {
    console.error(`[ERROR] ${message}`, ...args);
  },

  /**
   * @param {string} message 日志消息
   * @param  {...any} args 额外参数
   */
  debug(message, ...args) {
    if (isDev) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
};

export default logger;
