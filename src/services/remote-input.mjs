import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { logCommandError, pushCommand } from './job-log.mjs';

const HTTP_INPUT_PATTERN = /^https?:\/\//i;

function deriveRemoteInputName(job, urlString) {
  try {
    const url = new URL(urlString);
    const decoded = decodeURIComponent(url.pathname || '');
    const base = basename(decoded);
    if (base && base !== '/' && base !== '.' && base !== '..') {
      const trimmed = base.trim();
      if (!trimmed) {
        throw new Error('empty name');
      }
      if (extname(trimmed)) {
        return trimmed;
      }
      return `${trimmed}.mp4`;
    }
  } catch (error) {
    // ignore malformed URL and fall back to job based name
  }
  const fallbackBase = job?.id ? `${job.id}.mp4` : 'remote-input.mp4';
  return fallbackBase;
}

async function safeUnlink(targetPath) {
  if (!targetPath) return;
  try {
    await unlink(targetPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function prepareJobInput(job, config, jobLog = null) {
  if (!job || !job.input_path || !HTTP_INPUT_PATTERN.test(job.input_path)) {
    return { job, cleanup: async () => {} };
  }
  const workspace = config?.paths?.workspace ?? '/tmp/vef';
  const downloadsDir = join(workspace, 'downloads');
  await mkdir(downloadsDir, { recursive: true });
  const remoteName = deriveRemoteInputName(job, job.input_path);
  const localPath = join(downloadsDir, `${job.id ?? 'job'}-${remoteName}`);
  const commandEntry = pushCommand(jobLog, 'download', [job.input_path, localPath]);

  try {
    const response = await fetch(job.input_path);
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }
    await pipeline(response.body, createWriteStream(localPath));
  } catch (error) {
    logCommandError(jobLog, {
      command: commandEntry,
      message: error?.message ?? '下载输入文件失败',
      context: 'download_input'
    });
    await safeUnlink(localPath);
    throw error;
  }

  const preparedJob = {
    ...job,
    input_path: localPath,
    original_input_path: job.original_input_path ?? job.input_path
  };

  return {
    job: preparedJob,
    cleanup: async () => {
      await safeUnlink(localPath);
    }
  };
}
