/**
 * @file output generators
 * @description HLS/DASH多码率生成
 */

import { spawn } from 'node:child_process';
import { dirname, basename, extname, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { runExternalFfmpeg } from './ffmpeg-utils.mjs';

async function generateHlsOutputs(ffmpegBin, sourcePath) {
  const outputDir = dirname(sourcePath);
  const baseName = basename(sourcePath, extname(sourcePath)) || "output";
  const hlsDir = join(outputDir, `${baseName}-hls`);
  await mkdir(hlsDir, { recursive: true });
  const segmentPattern = join(hlsDir, `${baseName}-segment-%03d.ts`);
  const playlistPath = join(hlsDir, `${baseName}.m3u8`);
  const args = [
    "-y",
    "-i",
    sourcePath,
    "-codec",
    "copy",
    "-start_number",
    "0",
    "-hls_time",
    "4",
    "-hls_playlist_type",
    "vod",
    "-hls_segment_filename",
    segmentPattern,
    playlistPath,
  ];
  await runExternalFfmpeg(ffmpegBin, args);
  return { playlist: playlistPath };
}


async function generateDashOutputs(ffmpegBin, sourcePath) {
  const outputDir = dirname(sourcePath);
  const baseName = basename(sourcePath, extname(sourcePath)) || "output";
  const dashDir = join(outputDir, `${baseName}-dash`);
  await mkdir(dashDir, { recursive: true });
  const manifestPath = join(dashDir, `${baseName}.mpd`);
  const args = [
    "-y",
    "-i",
    sourcePath,
    "-c",
    "copy",
    "-map",
    "0",
    "-f",
    "dash",
    "-seg_duration",
    "4",
    "-init_seg_name",
    `${baseName}-init-\$RepresentationID\$.m4s`,
    "-media_seg_name",
    `${baseName}-\$RepresentationID\$-\$Number%05d\$.m4s`,
    manifestPath,
  ];
  await runExternalFfmpeg(ffmpegBin, args);
  return { manifest: manifestPath };
}


export {
  generateHlsOutputs,
  generateDashOutputs
};
