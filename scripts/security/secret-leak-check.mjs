#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const MAX_SCAN_BYTES = 2 * 1024 * 1024;
const SELF_PATH = 'scripts/security/secret-leak-check.mjs';
const CONTENT_SCAN_EXCLUDES = new Set(['package-lock.json', SELF_PATH]);

const highConfidenceDetectors = [
  {
    name: 'github-token',
    pattern:
      /\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  },
  {
    name: 'openai-api-key',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: 'google-api-key',
    pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  },
  {
    name: 'aws-access-key',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    name: 'slack-token',
    pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g,
  },
  {
    name: 'npm-token',
    pattern: /\bnpm_[A-Za-z0-9]{36}\b/g,
  },
  {
    name: 'discord-token',
    pattern:
      /\b(?:mfa\.[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,})\b/g,
  },
  {
    name: 'jwt',
    pattern:
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    name: 'private-key-pem',
    pattern:
      /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/g,
  },
];

const credentialUrlPattern =
  /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/([^:\s/@]+):([^@\s]+)@([^:/\s?#]+)/gi;

const sensitiveAssignmentPattern =
  /^\s*(?:-\s*)?(?:export\s+)?([A-Z0-9_]*(?:SECRET|TOKEN|API_KEY|ACCESS_KEY|PRIVATE_KEY|PASSWORD|PASS|CLIENT_SECRET|TTB_KEY|READ_TOKEN|JWT_SECRET|COOKIE_SECRET|SESSION_SECRET|ENCRYPTION_SECRET)[A-Z0-9_]*)\s*[:=]\s*(.+?)\s*$/;

const findings = [];
const repoRoot = runGit(['rev-parse', '--show-toplevel']).trim();
process.chdir(repoRoot);

const trackedPaths = new Set(runGitList(['ls-files', '-z']));
const stagedPaths = new Set(
  runGitList(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']),
);

for (const filePath of trackedPaths) {
  checkEnvTracking(filePath, 'tracked');
  scanWorktreeFile(filePath, 'tracked');
}

for (const filePath of stagedPaths) {
  checkEnvTracking(filePath, 'staged');
  scanStagedFile(filePath);
}

if (findings.length > 0) {
  console.error('Secret leak check failed. Redacted findings:');
  for (const finding of findings) {
    const location = finding.line
      ? `${finding.file}:${finding.line}`
      : finding.file;
    const key = finding.key ? ` key=${finding.key}` : '';
    console.error(`- ${location} ${finding.source} ${finding.detector}${key}`);
  }
  process.exit(1);
}

console.log('Secret leak check passed.');

function scanWorktreeFile(filePath, source) {
  if (shouldSkipContent(filePath) || !existsSync(filePath)) {
    return;
  }

  const buffer = readFileSync(filePath);
  scanBuffer(filePath, source, buffer);
}

function scanStagedFile(filePath) {
  if (shouldSkipContent(filePath)) {
    return;
  }

  let buffer;
  try {
    buffer = runGit(['show', `:${filePath}`], {
      encoding: 'buffer',
      maxBuffer: MAX_SCAN_BYTES + 1024,
    });
  } catch {
    return;
  }

  scanBuffer(filePath, 'staged', buffer);
}

function scanBuffer(filePath, source, buffer) {
  if (buffer.length > MAX_SCAN_BYTES || buffer.includes(0)) {
    return;
  }

  const lines = buffer.toString('utf8').split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    for (const detector of highConfidenceDetectors) {
      detector.pattern.lastIndex = 0;
      if (detector.pattern.test(line)) {
        addFinding(filePath, lineNumber, source, detector.name);
      }
    }

    credentialUrlPattern.lastIndex = 0;
    let credentialUrlMatch;
    while ((credentialUrlMatch = credentialUrlPattern.exec(line)) !== null) {
      const [, , password, host] = credentialUrlMatch;
      if (isCredentialUrlRisk(password, host)) {
        addFinding(filePath, lineNumber, source, 'credential-url');
      }
    }

    if (shouldScanSensitiveAssignments(filePath)) {
      const assignmentMatch = line.match(sensitiveAssignmentPattern);
      if (assignmentMatch) {
        const [, key, rawValue] = assignmentMatch;
        if (!isAllowedSensitiveValue(rawValue)) {
          addFinding(filePath, lineNumber, source, 'sensitive-assignment', key);
        }
      }
    }
  }
}

function checkEnvTracking(filePath, source) {
  if (isEnvFile(filePath) && !isEnvExample(filePath)) {
    addFinding(filePath, undefined, source, 'non-example-env-file');
  }
}

function shouldSkipContent(filePath) {
  return CONTENT_SCAN_EXCLUDES.has(filePath);
}

function shouldScanSensitiveAssignments(filePath) {
  return (
    isEnvFile(filePath) ||
    filePath.endsWith('.yml') ||
    filePath.endsWith('.yaml') ||
    filePath.endsWith('.sh') ||
    filePath.endsWith('.bash') ||
    filePath.endsWith('.conf') ||
    filePath.endsWith('.ini') ||
    filePath.endsWith('.toml')
  );
}

function addFinding(file, line, source, detector, key) {
  const duplicateKey = `${file}:${line ?? ''}:${source}:${detector}:${key ?? ''}`;
  if (findings.some((finding) => finding.duplicateKey === duplicateKey)) {
    return;
  }

  findings.push({ duplicateKey, file, line, source, detector, key });
}

function isEnvFile(filePath) {
  return filePath.split('/').some((segment) => segment === '.env' || segment.startsWith('.env.'));
}

function isEnvExample(filePath) {
  return filePath.split('/').some((segment) => {
    if (!segment.startsWith('.env.')) {
      return false;
    }

    const parts = segment.split('.');

    return parts.length >= 3 && parts[parts.length - 1] === 'example';
  });
}

function isAllowedSensitiveValue(rawValue) {
  const value = normalizeValue(rawValue);
  if (isPlaceholderCredential(value)) {
    return true;
  }

  if (value.length < 16) {
    return true;
  }

  return false;
}

function isCredentialUrlRisk(rawPassword, rawHost) {
  const password = normalizeValue(rawPassword);
  const host = normalizeValue(rawHost).toLowerCase();
  if (isPlaceholderCredential(password)) {
    return false;
  }

  if (/^(localhost|127\.0\.0\.1|postgres|redis)$/.test(host) && password.length < 24) {
    return false;
  }

  return password.length >= 12;
}

function isPlaceholderCredential(rawValue) {
  const value = normalizeValue(rawValue);
  if (value.length === 0) {
    return true;
  }

  if (/^\$\{[A-Z0-9_]+(?::[?=-][^}]*)?\}$/i.test(value)) {
    return true;
  }

  if (/^<[^>]+>$/.test(value)) {
    return true;
  }

  return /^(?:your[-_ ].*|change[-_ ]?me.*|example.*|sample.*|dummy.*|placeholder.*|demo.*|test(?:ing)?.*|dev(?:elopment)?.*|local(?:host)?.*|ci[-_ ].*|integration[-_ ].*|generated.*|minimum[-_ ].*|not[-_ ]?set|none|null|undefined|password|postgres|secret|token|key|xxx+|abc123)$/i.test(
    value,
  );
}

function normalizeValue(rawValue) {
  return rawValue
    .trim()
    .replace(/\s+#.*$/, '')
    .replace(/[,;]$/, '')
    .replace(/^['"`]/, '')
    .replace(/['"`]$/, '')
    .trim();
}

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: options.encoding ?? 'utf8',
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
  });

  if (result.status === 0) {
    return result.stdout;
  }

  const stderr =
    typeof result.stderr === 'string'
      ? result.stderr.trim()
      : result.stderr?.toString('utf8').trim();
  throw new Error(
    `git ${args.join(' ')} failed: ${stderr || result.error?.message || 'unknown error'}`,
  );
}

function runGitList(args) {
  const output = runGit(args);
  if (output.length === 0) {
    return [];
  }

  return output
    .split('\0')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.posix.normalize(entry));
}
