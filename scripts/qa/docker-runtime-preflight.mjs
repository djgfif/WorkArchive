#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const reportDir = resolve(
  rootDir,
  process.env.DOCKER_RUNTIME_REPORT_DIR ?? 'tmp/docker-runtime',
);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const reportPath = resolve(reportDir, `docker-runtime-preflight-${stamp}.md`);
const jsonReportPath = resolve(reportDir, `docker-runtime-preflight-${stamp}.json`);
const composeFile = resolve(
  rootDir,
  process.env.COMPOSE_FILE ?? 'compose.prod.yml',
);
const envFile = resolve(rootDir, process.env.ENV_FILE ?? '.env.prod');
const runBuild = readBooleanEnv('DOCKER_RUNTIME_BUILD', false);
const homeDir = process.env.HOME ? resolve(process.env.HOME) : '';

const sensitiveUrlParamPattern =
  /access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token/i;
const sensitiveInlineValuePattern =
  /\b((?:access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token)=)[^\s&;,]+/gi;

function readBooleanEnv(name, fallback) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  if (rawValue !== 'true' && rawValue !== 'false') {
    throw new Error(`${name} must be true or false when set.`);
  }

  return rawValue === 'true';
}

function redact(value) {
  let text = String(value ?? '');

  text = text.replace(new RegExp(rootDir, 'g'), '[workspace]');
  if (homeDir) {
    text = text.replace(new RegExp(escapeRegExp(homeDir), 'g'), '[home]');
  }
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
  text = text.replace(/Basic\s+[A-Za-z0-9._~+/=-]+/gi, 'Basic [REDACTED]');
  text = text.replace(sensitiveInlineValuePattern, '$1[REDACTED]');
  text = text.replace(
    /([A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|API_KEY|COOKIE|OAUTH|DATABASE_URL|REDIS_URL)[A-Za-z0-9_]*=)[^\s&;,]+/gi,
    '$1[REDACTED]',
  );
  text = text.replace(/(postgresql:\/\/)[^\s@]+@/gi, '$1[REDACTED]@');
  text = text.replace(/(rediss?:\/\/)[^\s@]+@/gi, '$1[REDACTED]@');

  return redactUrlSecrets(text);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactUrlSecrets(value) {
  return value.replace(/https?:\/\/[^\s<>"')]+/gi, (match) => {
    try {
      const url = new URL(match);

      if (url.username) {
        url.username = 'redacted';
      }

      if (url.password) {
        url.password = 'redacted';
      }

      for (const key of [...url.searchParams.keys()]) {
        if (sensitiveUrlParamPattern.test(key)) {
          url.searchParams.set(key, '[REDACTED]');
        }
      }

      return url.toString();
    } catch {
      return match;
    }
  });
}

function relativePath(path) {
  return path.startsWith(`${rootDir}/`)
    ? path.slice(rootDir.length + 1)
    : '[outside-workspace]';
}

function runCommand(name, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 120_000,
  });
  const combinedOutput = redact(
    `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim(),
  );

  return {
    command: [command, ...args].join(' '),
    durationMs: null,
    exitCode: result.status,
    name,
    outputSummary: summarizeOutput(combinedOutput),
    signal: result.signal,
    status: result.status === 0 ? 'PASS' : 'FAIL',
  };
}

function summarizeOutput(output) {
  if (!output) {
    return '';
  }

  return output.split(/\r?\n/).filter(Boolean).slice(-8).join(' ');
}

function escapeMarkdownTableCell(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\r?\n/g, '<br>');
}

function buildReport() {
  const checks = [];
  const dockerPath = runCommand('docker CLI path', 'bash', [
    '-lc',
    'command -v docker',
  ]);

  checks.push(dockerPath);

  if (dockerPath.status !== 'PASS') {
    checks.push({
      command: 'docker --version',
      exitCode: null,
      name: 'docker CLI version',
      outputSummary: 'Docker CLI is not installed or not on PATH.',
      signal: null,
      status: 'BLOCKED',
    });
    return finishReport(checks);
  }

  const dockerVersion = runCommand('docker CLI version', 'docker', ['--version']);
  if (dockerVersion.status !== 'PASS') {
    dockerVersion.status = 'BLOCKED';
  }
  checks.push(dockerVersion);

  if (dockerVersion.status !== 'PASS') {
    checks.push({
      command: 'docker compose version',
      exitCode: null,
      name: 'docker compose plugin',
      outputSummary:
        'Docker CLI is present, but docker --version failed in this environment.',
      signal: null,
      status: 'BLOCKED',
    });
    return finishReport(checks);
  }

  const composeVersion = runCommand('docker compose plugin', 'docker', [
    'compose',
    'version',
  ]);
  if (composeVersion.status !== 'PASS') {
    composeVersion.status = 'BLOCKED';
  }
  checks.push(composeVersion);

  if (composeVersion.status !== 'PASS') {
    checks.push({
      command: `docker compose -f ${relativePath(composeFile)} --env-file ${relativePath(envFile)} config`,
      exitCode: null,
      name: 'production compose config',
      outputSummary: 'Docker Compose is unavailable, so compose config cannot run.',
      signal: null,
      status: 'BLOCKED',
    });
    return finishReport(checks);
  }

  if (!existsSync(composeFile)) {
    checks.push({
      command: `test -f ${relativePath(composeFile)}`,
      exitCode: null,
      name: 'production compose file',
      outputSummary: `${relativePath(composeFile)} is missing.`,
      signal: null,
      status: 'FAIL',
    });
    return finishReport(checks);
  }

  if (!existsSync(envFile)) {
    checks.push({
      command: `test -f ${relativePath(envFile)}`,
      exitCode: null,
      name: 'production env file',
      outputSummary: `${relativePath(envFile)} is not present in this environment.`,
      signal: null,
      status: 'BLOCKED',
    });
    return finishReport(checks);
  }

  checks.push(
    runCommand('production compose config', 'docker', [
      'compose',
      '-f',
      composeFile,
      '--env-file',
      envFile,
      'config',
    ]),
  );

  if (runBuild) {
    checks.push(
      runCommand(
        'production image build',
        'docker',
        ['compose', '-f', composeFile, '--env-file', envFile, 'build'],
        { timeoutMs: 900_000 },
      ),
    );
  } else {
    checks.push({
      command: 'DOCKER_RUNTIME_BUILD=true npm run qa:docker-runtime',
      exitCode: null,
      name: 'production image build',
      outputSummary:
        'Not run. Set DOCKER_RUNTIME_BUILD=true on a Docker-enabled release runner to build production images.',
      signal: null,
      status: 'NOT_RUN',
    });
  }

  return finishReport(checks);
}

function finishReport(checks) {
  const status = checks.some((check) => check.status === 'FAIL')
    ? 'FAIL'
    : checks.some((check) => check.status === 'BLOCKED')
      ? 'BLOCKED'
      : 'PASS';

  return {
    checks,
    composeFile: relativePath(composeFile),
    envFile: relativePath(envFile),
    gitCommit: gitValue(['rev-parse', 'HEAD']),
    mode: runBuild ? 'config-and-build' : 'config-only',
    reportStatus: status,
    timestamp: new Date().toISOString(),
    workingTree: gitValue(['status', '--short']) ? 'dirty' : 'clean',
  };
}

function gitValue(args, fallback = 'unknown') {
  const result = spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
  });

  return result.status === 0 ? result.stdout.trim() : fallback;
}

function writeReports(report) {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    '# Docker Runtime Preflight Report',
    '',
    `- Timestamp UTC: ${report.timestamp}`,
    `- Mode: ${report.mode}`,
    `- Git commit: ${report.gitCommit}`,
    `- Working tree: ${report.workingTree}`,
    `- Overall status: ${report.reportStatus}`,
    `- Compose file: ${report.composeFile}`,
    `- Env file: ${report.envFile}`,
    '',
    '| Check | Status | Command | Summary |',
    '| --- | --- | --- | --- |',
    ...report.checks.map(
      (check) =>
        `| ${check.name} | ${check.status} | \`${escapeMarkdownTableCell(check.command)}\` | ${escapeMarkdownTableCell(check.outputSummary)} |`,
    ),
    '',
  ];

  if (report.reportStatus === 'BLOCKED') {
    lines.push(
      'This report records an environment blocker, not a product failure. Re-run on a Docker-enabled release runner with `.env.prod` to collect production compose config and image build evidence.',
      '',
    );
  }

  writeFileSync(reportPath, `${lines.join('\n')}\n`);
}

const report = buildReport();

writeReports(report);
console.log(`Docker runtime preflight report: ${relativePath(reportPath)}`);

if (report.reportStatus === 'FAIL') {
  process.exit(1);
}
