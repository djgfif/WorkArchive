#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(new URL('../..', import.meta.url).pathname);
const composePath = resolve(rootDir, 'compose.prod.yml');
const composeText = readFileSync(composePath, 'utf8');
const findings = [];

const serviceBlocks = parseTopLevelServices(composeText);

const applicationServices = {
  api: {
    requiredStrings: [
      "cpus: '1.00'",
      'mem_limit: 512m',
      'pids_limit: 256',
      'read_only: true',
      'cap_drop:',
      '- ALL',
      'security_opt:',
      '- no-new-privileges:true',
      'tmpfs:',
      '/tmp:size=64m,mode=1777',
      'healthcheck:',
    ],
    forbiddenStrings: ['\n    ports:'],
  },
  'api-migrate': {
    requiredStrings: [
      "cpus: '1.00'",
      'mem_limit: 512m',
      'pids_limit: 256',
      'read_only: true',
      "restart: 'no'",
      'cap_drop:',
      '- ALL',
      'security_opt:',
      '- no-new-privileges:true',
      'tmpfs:',
      '/tmp:size=64m,mode=1777',
    ],
    forbiddenStrings: ['\n    ports:'],
  },
  'retention-cleanup': {
    requiredStrings: [
      "cpus: '0.50'",
      'mem_limit: 256m',
      'pids_limit: 128',
      'read_only: true',
      "restart: 'no'",
      'cap_drop:',
      '- ALL',
      'security_opt:',
      '- no-new-privileges:true',
      'tmpfs:',
      '/tmp:size=64m,mode=1777',
      'RETENTION_CLEANUP_DRY_RUN: ${RETENTION_CLEANUP_DRY_RUN:-true}',
    ],
    forbiddenStrings: ['\n    ports:'],
  },
  web: {
    requiredStrings: [
      "cpus: '0.50'",
      'mem_limit: 128m',
      'pids_limit: 128',
      'read_only: true',
      'cap_drop:',
      '- ALL',
      'security_opt:',
      '- no-new-privileges:true',
      'tmpfs:',
      '/tmp:size=64m,mode=1777',
      '/var/cache/nginx:size=64m,mode=1777',
      '/var/run:size=8m,mode=1777',
      'healthcheck:',
    ],
    forbiddenStrings: [],
  },
};

for (const [serviceName, checks] of Object.entries(applicationServices)) {
  const block = serviceBlocks.get(serviceName);

  if (!block) {
    findings.push(`${composePath}: missing service "${serviceName}".`);
    continue;
  }

  for (const required of checks.requiredStrings) {
    if (!block.includes(required)) {
      findings.push(
        `${composePath}: service "${serviceName}" is missing "${required}".`,
      );
    }
  }

  for (const forbidden of checks.forbiddenStrings) {
    if (block.includes(forbidden)) {
      findings.push(
        `${composePath}: service "${serviceName}" must not include "${forbidden.trim()}".`,
      );
    }
  }
}

const statefulServices = {
  postgres: {
    requiredStrings: [
      "cpus: '1.00'",
      'mem_limit: 1g',
      'pids_limit: 256',
      'healthcheck:',
    ],
  },
  redis: {
    requiredStrings: [
      "cpus: '0.50'",
      'mem_limit: 256m',
      'pids_limit: 128',
      'healthcheck:',
    ],
  },
};

for (const [statefulService, checks] of Object.entries(statefulServices)) {
  const block = serviceBlocks.get(statefulService);

  if (!block) {
    findings.push(`${composePath}: missing stateful service "${statefulService}".`);
    continue;
  }

  for (const required of checks.requiredStrings) {
    if (!block.includes(required)) {
      findings.push(
        `${composePath}: stateful service "${statefulService}" is missing "${required}".`,
      );
    }
  }

  if (block.includes('\n    ports:')) {
    findings.push(
      `${composePath}: stateful service "${statefulService}" must not expose host ports in production compose.`,
    );
  }
}

if (findings.length > 0) {
  console.error('Production compose hardening check failed:');
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    'Production compose hardening check passed: application services are read-only and capability-dropped, all production services are resource-bounded, and stateful services remain internal.',
  );
}

function parseTopLevelServices(text) {
  const services = new Map();
  const lines = text.split(/\r?\n/);
  let inServices = false;
  let currentName = null;
  let currentLines = [];

  for (const line of lines) {
    if (line === 'services:') {
      inServices = true;
      continue;
    }

    if (!inServices) {
      continue;
    }

    if (/^[A-Za-z0-9_-]+:/.test(line)) {
      break;
    }

    const serviceMatch = /^  ([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (serviceMatch) {
      flushService();
      currentName = serviceMatch[1];
      currentLines = [line];
      continue;
    }

    if (currentName) {
      currentLines.push(line);
    }
  }

  flushService();

  return services;

  function flushService() {
    if (currentName) {
      services.set(currentName, currentLines.join('\n'));
    }
  }
}
