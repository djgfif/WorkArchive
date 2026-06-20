#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const migrationsDir = path.join(rootDir, 'apps/api/prisma/migrations');
const riskRegisterPath = path.join(rootDir, 'docs/operations/MIGRATION_RISK_REGISTER.md');

const migrationDirPattern = /^\d{14}_[a-z0-9_]+$/;
const riskApprovalPattern = /approved-(historical|release)/;
const secretPattern =
  /\b(?:DATABASE_URL|JWT_SECRET|SESSION_SECRET|GOOGLE_CLIENT_SECRET|API_KEY|TOKEN|PASSWORD)\s*=\s*["']?[^"'\s]+/i;

const highRiskPatterns = [
  { id: 'drop-table', label: 'DROP TABLE', pattern: /\bDROP\s+TABLE\b/i },
  { id: 'drop-column', label: 'DROP COLUMN', pattern: /\bDROP\s+COLUMN\b/i },
  { id: 'drop-type', label: 'DROP TYPE', pattern: /\bDROP\s+TYPE\b/i },
  { id: 'truncate', label: 'TRUNCATE', pattern: /\bTRUNCATE\b/i },
  { id: 'delete-from', label: 'DELETE FROM', pattern: /\bDELETE\s+FROM\b/i },
  {
    id: 'enum-rewrite',
    label: 'ALTER TYPE ... RENAME TO',
    pattern: /\bALTER\s+TYPE\b[\s\S]{0,200}\bRENAME\s+TO\b/i,
  },
];

function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

function getLine(sql, index) {
  return sql.slice(0, index).split('\n').length;
}

function findPatternFindings(sql, definition) {
  const findings = [];
  const flags = definition.pattern.flags.includes('g') ? definition.pattern.flags : `${definition.pattern.flags}g`;
  const pattern = new RegExp(definition.pattern.source, flags);
  for (const match of sql.matchAll(pattern)) {
    findings.push({
      id: definition.id,
      label: definition.label,
      line: getLine(sql, match.index ?? 0),
    });
  }
  return findings;
}

function findUnsafeUpdates(sql) {
  const findings = [];
  const updatePattern =
    /(?:^|;)\s*UPDATE\s+(?:"[^"]+"|[a-z_][a-z0-9_]*)(?:\s+AS\s+(?:"[^"]+"|[a-z_][a-z0-9_]*))?[\s\S]*?;/gim;

  for (const match of sql.matchAll(updatePattern)) {
    const statement = match[0];
    if (!/\bWHERE\b/i.test(statement)) {
      findings.push({
        id: 'update-without-where',
        label: 'UPDATE without WHERE',
        line: getLine(sql, match.index ?? 0),
      });
    }
  }

  return findings;
}

function readRiskRegister() {
  let content;
  try {
    content = readFileSync(riskRegisterPath, 'utf8');
  } catch (error) {
    return {
      entries: new Map(),
      errors: [`Missing migration risk register: ${path.relative(rootDir, riskRegisterPath)}`],
    };
  }

  const entries = new Map();
  const errors = [];

  for (const line of content.split('\n')) {
    if (!line.startsWith('|')) {
      continue;
    }

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 4 || cells[0] === 'Migration' || cells[0].startsWith('---')) {
      continue;
    }

    const migration = cells[0].replaceAll('`', '');
    const approval = cells[2].replaceAll('`', '');
    if (!migrationDirPattern.test(migration)) {
      errors.push(`Invalid migration id in risk register: ${cells[0]}`);
      continue;
    }
    if (!riskApprovalPattern.test(approval)) {
      errors.push(`Risk register entry ${migration} must use approved-historical or approved-release.`);
      continue;
    }
    entries.set(migration, { approval });
  }

  return { entries, errors };
}

function collectMigrations() {
  return readdirSync(migrationsDir)
    .filter((entry) => {
      const fullPath = path.join(migrationsDir, entry);
      return statSync(fullPath).isDirectory();
    })
    .sort();
}

const errors = [];
const warnings = [];
const highRiskByMigration = new Map();
const { entries: registeredRisks, errors: riskRegisterErrors } = readRiskRegister();
errors.push(...riskRegisterErrors);

let migrations;
try {
  migrations = collectMigrations();
} catch (error) {
  console.error(`Cannot read Prisma migrations directory: ${error.message}`);
  process.exit(1);
}

for (const migration of migrations) {
  if (!migrationDirPattern.test(migration)) {
    errors.push(`Migration directory has invalid name: ${migration}`);
  }

  const migrationSqlPath = path.join(migrationsDir, migration, 'migration.sql');
  let sql;
  try {
    sql = readFileSync(migrationSqlPath, 'utf8');
  } catch (error) {
    errors.push(`${migration} is missing migration.sql.`);
    continue;
  }

  if (sql.length === 0 || sql.trim().length === 0) {
    errors.push(`${migration}/migration.sql is empty.`);
  }
  if (sql.includes('\r')) {
    errors.push(`${migration}/migration.sql must use LF line endings.`);
  }
  if (secretPattern.test(sql)) {
    errors.push(`${migration}/migration.sql appears to contain secret-like material.`);
  }

  const commentlessSql = stripComments(sql);
  const findings = [
    ...highRiskPatterns.flatMap((definition) => findPatternFindings(commentlessSql, definition)),
    ...findUnsafeUpdates(commentlessSql),
  ];

  if (findings.length > 0) {
    highRiskByMigration.set(migration, findings);
    if (!registeredRisks.has(migration)) {
      const findingSummary = findings.map((finding) => `${finding.label}:L${finding.line}`).join(', ');
      errors.push(
        `${migration} contains high-risk SQL but is missing from docs/operations/MIGRATION_RISK_REGISTER.md (${findingSummary}).`,
      );
    }
  }
}

for (const migration of registeredRisks.keys()) {
  if (!migrations.includes(migration)) {
    errors.push(`Risk register references unknown migration: ${migration}`);
    continue;
  }
  if (!highRiskByMigration.has(migration)) {
    warnings.push(`Risk register entry ${migration} no longer matches detected high-risk SQL.`);
  }
}

if (warnings.length > 0) {
  console.log('Prisma migration safety warnings:');
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
  console.log('');
}

if (errors.length > 0) {
  console.error('Prisma migration safety check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `Prisma migration safety check passed: ${migrations.length} migration(s), ${highRiskByMigration.size} registered high-risk migration(s).`,
);
