import { dirname } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

function normalizeJobLog(jobLog = null, outputPath = null) {
  if (!jobLog) {
    return {
      outputPath: outputPath ?? null,
      commands: [],
      errors: [],
      vmafResults: [],
      inputs: []
    };
  }
  if (Array.isArray(jobLog)) {
    return {
      outputPath: outputPath ?? null,
      commands: jobLog,
      errors: [],
      vmafResults: [],
      inputs: []
    };
  }
  if (!Array.isArray(jobLog.commands)) {
    jobLog.commands = [];
  }
  if (!Array.isArray(jobLog.errors)) {
    jobLog.errors = [];
  }
  if (!Array.isArray(jobLog.vmafResults)) {
    jobLog.vmafResults = [];
  }
  if (!Array.isArray(jobLog.inputs)) {
    jobLog.inputs = [];
  }
  if (outputPath && !jobLog.outputPath) {
    jobLog.outputPath = outputPath;
  }
  return jobLog;
}

export function createJobLog(outputPath = null) {
  return normalizeJobLog(null, outputPath);
}

export { normalizeJobLog };

function logVmafResult(jobLog, payload) {
  if (!jobLog) return;
  const target = normalizeJobLog(jobLog);
  target.vmafResults.push({
    timestamp: new Date().toISOString(),
    ...payload
  });
}

export { logVmafResult };

function buildVmafContext(timeSlice = null, label = 'segment') {
  if (!timeSlice) {
    return { type: label };
  }
  return {
    type: label,
    index: timeSlice.index ?? null,
    start: timeSlice.start ?? null,
    end: timeSlice.end ?? null,
    duration: timeSlice.duration ?? null
  };
}

export { buildVmafContext };

function formatCommand(bin, args = []) {
  const escapeArg = (arg) => {
    if (arg === undefined || arg === null) return '';
    if (/^[A-Za-z0-9-_./:@%+=,]+$/.test(arg)) {
      return arg;
    }
    return `'${String(arg).replace(/'/g, `'\\''`)}'`;
  };
  return [bin, ...args].map(escapeArg).join(' ').trim();
}

function pushCommand(jobLog, bin, args) {
  const entry = formatCommand(bin, args);
  if (!jobLog) return entry;
  if (Array.isArray(jobLog)) {
    jobLog.push(entry);
    return entry;
  }
  const target = normalizeJobLog(jobLog);
  target.commands.push(entry);
  return entry;
}

export { pushCommand };

function logCommandError(jobLog, payload) {
  if (!jobLog) return;
  const target = normalizeJobLog(jobLog);
  target.errors.push({
    timestamp: new Date().toISOString(),
    ...payload
  });
}

export { logCommandError };

function cloneJobParams(params = {}) {
  if (!params || typeof params !== 'object') {
    return {};
  }
  try {
    return JSON.parse(JSON.stringify(params));
  } catch (error) {
    const cloned = {};
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      cloned[key] = value;
    }
    return cloned;
  }
}

function sanitizeJobInputPayload(job) {
  if (!job || typeof job !== 'object') {
    return null;
  }
  const params = cloneJobParams(job.params);
  const payload = {
    jobId: job.id ?? null,
    inputPath: job.input_path ?? job.inputPath ?? null,
    outputPath: job.output_path ?? job.outputPath ?? null,
    codec: job.codec ?? null,
    impl: job.impl ?? null,
    params
  };
  return payload;
}

export function logJobInput(jobLog, job, options = {}) {
  if (!jobLog) return;
  const payload = sanitizeJobInputPayload(job);
  if (!payload) {
    return;
  }
  const target = normalizeJobLog(jobLog);
  target.inputs.push({
    timestamp: new Date().toISOString(),
    source: options.source ?? 'request',
    payload
  });
}

export async function persistJobLog(jobLog, fallbackOutputPath = null) {
  if (!jobLog) return;
  const normalized = normalizeJobLog(jobLog, fallbackOutputPath);
  const outputPath = normalized.outputPath ?? fallbackOutputPath;
  if (!outputPath) {
    return;
  }
  try {
    await mkdir(dirname(outputPath), { recursive: true });
  } catch (error) {
    if (error?.code !== 'EEXIST') {
      throw error;
    }
  }
  const commands = Array.isArray(normalized.commands) ? normalized.commands : [];
  const errors = Array.isArray(normalized.errors) ? normalized.errors : [];
  const vmafResults = Array.isArray(normalized.vmafResults) ? normalized.vmafResults : [];
  const inputs = Array.isArray(normalized.inputs) ? normalized.inputs : [];

  if (commands.length) {
    const commandLogPath = `${outputPath}.commands.log`;
    await writeFile(commandLogPath, commands.join('\n'), 'utf8');
  }

  if (!commands.length && !vmafResults.length && !errors.length && !inputs.length) {
    return;
  }

  const lines = [];
  lines.push('# Job Execution Log');
  lines.push(`generated_at: ${new Date().toISOString()}`);
  lines.push('');

  if (inputs.length) {
    lines.push('## User Inputs');
    for (const entry of inputs) {
      const parts = [];
      if (entry.source) parts.push(`source=${entry.source}`);
      if (entry.payload?.jobId) parts.push(`job_id=${entry.payload.jobId}`);
      const detail = parts.length ? ` ${parts.join(', ')}` : '';
      lines.push(`- [${entry.timestamp}]${detail}`);
      const serialized = JSON.stringify(entry.payload ?? {}, null, 2);
      const serializedLines = serialized.split('\n');
      for (const line of serializedLines) {
        lines.push(`  ${line}`);
      }
    }
    lines.push('');
  }

  if (commands.length) {
    lines.push('## Commands');
    for (const command of commands) {
      lines.push(command);
    }
    lines.push('');
  }

  if (errors.length) {
    lines.push('## Errors');
    for (const entry of errors) {
      const parts = [];
      if (entry.command) parts.push(`command=${entry.command}`);
      if (entry.message) parts.push(`message=${entry.message}`);
      if (entry.stderr) {
        const sanitizedStderr = String(entry.stderr).replace(/\s+/g, ' ').trim();
        if (sanitizedStderr) {
          parts.push(`stderr=${sanitizedStderr}`);
        }
      }
      if (entry.exitCode !== undefined && entry.exitCode !== null) {
        parts.push(`exit_code=${entry.exitCode}`);
      }
      if (entry.signal) parts.push(`signal=${entry.signal}`);
      if (entry.context) parts.push(`context=${entry.context}`);
      const detail = parts.length ? ` ${parts.join(', ')}` : '';
      lines.push(`- [${entry.timestamp}]${detail}`);
    }
    lines.push('');
  }

  if (vmafResults.length) {
    lines.push('## VMAF Results');
    for (const entry of vmafResults) {
      const parts = [];
      if (entry.targetPath) parts.push(`target=${entry.targetPath}`);
      if (entry.referencePath) parts.push(`reference=${entry.referencePath}`);
      if (entry.reportPath) parts.push(`report=${entry.reportPath}`);
      if (entry.context) {
        const contextItems = Object.entries(entry.context)
          .filter(([, value]) => value !== null && value !== undefined)
          .map(([key, value]) => `${key}=${value}`);
        if (contextItems.length) {
          parts.push(`context{${contextItems.join(', ')}}`);
        }
      }
      if (entry.error) {
        parts.push(`error=${entry.error}`);
      } else {
        if (Number.isFinite(entry.mean)) parts.push(`mean=${entry.mean}`);
        if (Number.isFinite(entry.min)) parts.push(`min=${entry.min}`);
        if (Number.isFinite(entry.max)) parts.push(`max=${entry.max}`);
      }
      const detail = parts.length ? ` ${parts.join(', ')}` : '';
      lines.push(`- [${entry.timestamp}]${detail}`);
    }
    lines.push('');
  }

  const summaryPath = `${outputPath}.log`;
  await writeFile(summaryPath, lines.join('\n'), 'utf8');
}
