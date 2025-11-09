/**
 * @file 硬件能力检测
 * @description 通过 ffmpeg -encoders 输出检测可用的硬件编码器
 */
import { spawn } from 'node:child_process';

let cachedEncoders = null;

async function readEncoders(ffmpegBin) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBin, ['-hide_banner', '-encoders'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `ffmpeg encoders exit code ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * @description 检测 ffmpeg 可用编码器
 * @param {string} ffmpegBin ffmpeg 可执行文件
 * @returns {Promise<Set<string>>} 编码器名称集合
 */
export async function detectEncoderSupport(ffmpegBin) {
  if (cachedEncoders) {
    return cachedEncoders;
  }
  try {
    const output = await readEncoders(ffmpegBin);
    const set = new Set();
    output.split('\n').forEach((line) => {
      const match = /^\s*[A-Z.]*V[A-Z.]*\s+([^\s]+)\s+/i.exec(line);
      if (match) {
        set.add(match[1]);
      }
    });
    cachedEncoders = set;
    return cachedEncoders;
  } catch (error) {
    console.warn('无法检测硬件编码器支持，默认禁用：', error.message);
    cachedEncoders = new Set();
    return cachedEncoders;
  }
}

export default detectEncoderSupport;
