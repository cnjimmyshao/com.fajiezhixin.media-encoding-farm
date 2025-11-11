/**
 * @file 硬件能力检测
 * @description 检测硬件编码器和CUDA支持
 */
import { spawn } from 'node:child_process';

let cachedEncoders = null;
let cachedCudaInfo = null;

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
 * @description 检测CUDA支持
 * @param {string} ffmpegBin ffmpeg可执行文件路径
 * @returns {Promise<Object>} CUDA支持信息
 */
async function detectCudaSupportInternal(ffmpegBin) {
  if (cachedCudaInfo) {
    return cachedCudaInfo;
  }
  
  const cudaInfo = {
    hasNvidiaGpu: false,
    hasCudaSupport: false,
    hasLibvmafCuda: false,
    gpuInfo: null,
    deviceId: 0,
    enabled: false
  };
  
  try {
    // 检测nvidia-smi
    const nvidiaSmi = spawn('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let gpuInfo = '';
    nvidiaSmi.stdout.on('data', (chunk) => {
      gpuInfo += chunk.toString();
    });
    
    nvidiaSmi.on('error', () => {
      // 进程启动失败，nvidia-smi不存在
    });
    
    const [code] = await once(nvidiaSmi, 'close');
    
    if (code === 0 && gpuInfo.trim()) {
      cudaInfo.hasNvidiaGpu = true;
      cudaInfo.gpuInfo = gpuInfo.trim();
    }
  } catch (error) {
    // nvidia-smi不存在，不是NVIDIA系统
  }
  
  try {
    // 检测ffmpeg的CUDA支持
    const ffmpeg = spawn(ffmpegBin, ['-hide_banner', '-hwaccels'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let hwAccels = '';
    ffmpeg.stdout.on('data', (chunk) => {
      hwAccels += chunk.toString();
    });
    
    ffmpeg.on('error', () => {
      // ffmpeg命令失败
    });
    
    const [code] = await once(ffmpeg, 'close');
    
    if (code === 0 && hwAccels.includes('cuda')) {
      cudaInfo.hasCudaSupport = true;
    }
  } catch (error) {
    // ffmpeg命令失败
  }
  
  try {
    // 检测libvmaf
    const ffmpegFilters = spawn(ffmpegBin, ['-hide_banner', '-filters'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let filters = '';
    ffmpegFilters.stdout.on('data', (chunk) => {
      filters += chunk.toString();
    });
    
    const [code] = await once(ffmpegFilters, 'close');
    
    if (code === 0 && filters.includes('libvmaf')) {
      // 如果系统有CUDA且ffmpeg支持CUDA，则启用CUDA加速
      if (cudaInfo.hasNvidiaGpu && cudaInfo.hasCudaSupport) {
        cudaInfo.hasLibvmafCuda = true;
        cudaInfo.enabled = true;
      }
    }
  } catch (error) {
    // ffmpeg命令失败
  }
  
  cachedCudaInfo = cudaInfo;
  return cudaInfo;
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

/**
 * @description 检测CUDA支持
 * @param {string} ffmpegBin ffmpeg可执行文件路径
 * @returns {Promise<Object>} CUDA支持信息
 */
export async function detectCudaSupport(ffmpegBin) {
  return detectCudaSupportInternal(ffmpegBin);
}

export default { detectEncoderSupport, detectCudaSupport };
