#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const packageJson = JSON.parse(
  readFileSync(join(rootDir, 'package.json'), 'utf8'),
);

function parseVersion(version) {
  const match = String(version).match(/^v?(\d+)\.(\d+)\.(\d+)/);

  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function parseMinimum(range) {
  const match = String(range).match(/>=\s*(\d+)\.(\d+)\.(\d+)/);

  if (!match) {
    throw new Error(`Unsupported engine range: ${range}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareVersions(left, right) {
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) {
      return left[key] - right[key];
    }
  }

  return 0;
}

function getNpmVersion() {
  const userAgent = process.env.npm_config_user_agent ?? '';
  const match = userAgent.match(/npm\/(\d+\.\d+\.\d+)/);

  return match?.[1] ?? null;
}

const requiredNode = parseMinimum(packageJson.engines.node);
const requiredNpm = parseMinimum(packageJson.engines.npm);
const currentNode = parseVersion(process.versions.node);
const currentNpmValue = getNpmVersion();
const currentNpm = currentNpmValue ? parseVersion(currentNpmValue) : null;
const failures = [];

if (!currentNode || compareVersions(currentNode, requiredNode) < 0) {
  failures.push(
    `Node ${process.versions.node} does not satisfy ${packageJson.engines.node}.`,
  );
}

if (currentNpm && compareVersions(currentNpm, requiredNpm) < 0) {
  failures.push(
    `npm ${currentNpmValue} does not satisfy ${packageJson.engines.npm}.`,
  );
}

if (failures.length > 0) {
  console.error('Work Archive requires the repository runtime before running this command.');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error('Run: source ~/.nvm/nvm.sh && nvm use');
  process.exit(1);
}

console.log(
  `Runtime OK: Node ${process.versions.node}, npm ${currentNpmValue ?? 'unknown'}`,
);
