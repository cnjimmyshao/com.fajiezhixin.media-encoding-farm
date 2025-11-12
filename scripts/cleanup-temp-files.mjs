/**
 * @file 临时文件清理工具
 * @description 清理视频转码过程中产生的临时文件（场景片段、VMAF报告等）
 */

import { readdir, rm, stat } from 'node:fs/promises';
import { dirname, join, basename, extname } from 'node:path';
import { db } from '../src/db/sql.mjs';

/**
 * @description 清理指定任务的临时文件
 * @param {string} jobId 任务ID
 * @param {string} outputPath 输出文件路径
 */
export async function cleanupJobTempFiles(jobId, outputPath) {
  try {
    const outputDir = dirname(outputPath);
    const fileName = basename(outputPath, extname(outputPath));

    // 1. 清理场景片段文件夹（scene-*）
    const scenesDir = join(outputDir, `${fileName}-scenes`);
    try {
      await rm(scenesDir, { recursive: true, force: true });
      console.info(`[cleanup] 清理场景片段: ${scenesDir}`);
    } catch (error) {
      // 目录不存在是正常现象
    }

    // 2. 清理 VMAF 报告文件
    const vmafReport = `${outputPath}.vmaf.json`;
    try {
      await rm(vmafReport, { force: true });
      console.info(`[cleanup] 清理 VMAF 报告: ${vmafReport}`);
    } catch (error) {
      // 文件不存在是正常现象
    }

    // 3. 清理临时 VMAF 报告（场景编码时产生的）
    try {
      const files = await readdir(outputDir);
      const vmafTempFiles = files.filter(file =>
        file.startsWith(`${fileName}-scenes-`) && file.endsWith('.vmaf.json')
      );
      for (const file of vmafTempFiles) {
        await rm(join(outputDir, file), { force: true });
        console.info(`[cleanup] 清理临时 VMAF: ${file}`);
      }
    } catch (error) {
      // 读取目录失败可以忽略
    }
  } catch (error) {
    console.warn(`[cleanup] 清理任务 ${jobId} 的临时文件失败:`, error.message);
  }
}

/**
 * @description 扫描并清理所有孤立的临时文件
 * 孤立的临时文件指：文件存在但对应任务已不存在或已完成/失败
 */
export async function cleanupOrphanedTempFiles() {
  console.info('[cleanup] 开始扫描孤立的临时文件...');

  try {
    // 获取所有任务的输出路径
    const jobs = await db.all(
      `SELECT id, output_path, status FROM jobs`
    );

    const outputDirs = new Set();
    const activeScenesDirs = new Set();
    const activeVmafFiles = new Set();

    // 收集所有有效的临时文件路径
    for (const job of jobs) {
      if (!job.output_path) continue;

      const outputDir = dirname(job.output_path);
      outputDirs.add(outputDir);

      const fileName = basename(job.output_path, extname(job.output_path));

      // 如果任务正在运行，保留临时文件
      if (job.status === 'running') {
        activeScenesDirs.add(join(outputDir, `${fileName}-scenes`));
        activeVmafFiles.add(`${job.output_path}.vmaf.json`);
      }
    }

    let cleanedCount = 0;

    // 扫描每个输出目录
    for (const outputDir of outputDirs) {
      try {
        const files = await readdir(outputDir, { withFileTypes: true });

        for (const file of files) {
          const fullPath = join(outputDir, file.name);

          // 清理孤立的场景片段文件夹
          if (file.isDirectory() && file.name.endsWith('-scenes')) {
            if (!activeScenesDirs.has(fullPath)) {
              await rm(fullPath, { recursive: true, force: true });
              console.warn(`[cleanup] 清理孤立场景文件夹: ${fullPath}`);
              cleanedCount++;
            }
          }

          // 清理孤立的 VMAF 报告文件
          if (file.isFile() && file.name.endsWith('.vmaf.json')) {
            if (!activeVmafFiles.has(fullPath)) {
              await rm(fullPath, { force: true });
              console.warn(`[cleanup] 清理孤立 VMAF 文件: ${fullPath}`);
              cleanedCount++;
            }
          }
        }
      } catch (error) {
        // 目录不存在或无法读取时跳过
      }
    }

    if (cleanedCount === 0) {
      console.info('[cleanup] 未发现孤立的临时文件');
    } else {
      console.warn(`[cleanup] 共清理 ${cleanedCount} 个孤立的临时文件`);
    }
  } catch (error) {
    console.error('[cleanup] 扫描孤立临时文件失败:', error.message);
  }
}

// 如果是直接运行此脚本，执行清理
if (import.meta.url === `file://${process.argv[1]}`) {
  await cleanupOrphanedTempFiles();
  process.exit(0);
}
