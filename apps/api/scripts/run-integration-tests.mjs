import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const appRoot = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const jestBin = fileURLToPath(
  new URL('node_modules/jest/bin/jest.js', `file://${repoRoot}/`),
);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function isIntegrationDatabaseUrl(value) {
  return /(test|integration)/iu.test(value);
}

function buildLocalIntegrationDatabaseUrl() {
  const port = process.env.POSTGRES_PORT?.trim() || '18732';
  return `postgresql://postgres:postgres@127.0.0.1:${port}/work_archive_integration?schema=public`;
}

function resolveDatabaseUrl() {
  const configuredUrl = process.env.DATABASE_URL?.trim();

  if (configuredUrl && isIntegrationDatabaseUrl(configuredUrl)) {
    return configuredUrl;
  }

  return buildLocalIntegrationDatabaseUrl();
}

function getDatabaseName(databaseUrl) {
  const parsedUrl = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//u, ''));

  if (!/^[a-zA-Z0-9_]+$/u.test(databaseName)) {
    throw new Error(
      `Integration database name must contain only letters, numbers, and underscores: ${databaseName}`,
    );
  }

  return databaseName;
}

function createMaintenanceUrl(databaseUrl) {
  const parsedUrl = new URL(databaseUrl);
  parsedUrl.pathname = '/postgres';
  parsedUrl.search = '';
  return parsedUrl.toString();
}

async function ensureDatabase(databaseUrl) {
  const databaseName = getDatabaseName(databaseUrl);
  const maintenanceUrl = createMaintenanceUrl(databaseUrl);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: maintenanceUrl,
    }),
  });

  try {
    const existingDatabases = await prisma.$queryRawUnsafe(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      databaseName,
    );

    if (existingDatabases.length === 0) {
      await prisma.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not prepare PostgreSQL integration database "${databaseName}". Start Docker Compose or set DATABASE_URL to an existing test/integration database. ${message}`,
      { cause: error },
    );
  } finally {
    await prisma.$disconnect();
  }
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: appRoot,
      env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `${command} ${args.join(' ')} exited with signal ${signal}`
            : `${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`,
        ),
      );
    });
  });
}

const databaseUrl = resolveDatabaseUrl();
const env = {
  ...process.env,
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:18730',
  DATABASE_URL: databaseUrl,
  EXTERNAL_API_KEY_ENCRYPTION_SECRET:
    process.env.EXTERNAL_API_KEY_ENCRYPTION_SECRET ??
    'integration-external-api-key-secret-minimum-32-chars',
  JWT_ACCESS_SECRET:
    process.env.JWT_ACCESS_SECRET ?? 'integration-access-secret-minimum-32-chars',
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ??
    'integration-refresh-secret-minimum-32-chars',
  NODE_ENV: 'test',
  SECURITY_EVENT_HASH_SECRET:
    process.env.SECURITY_EVENT_HASH_SECRET ??
    'integration-security-event-secret-minimum-32-chars',
  SWAGGER_ENABLED: process.env.SWAGGER_ENABLED ?? 'false',
  WEB_BASE_URL: process.env.WEB_BASE_URL ?? 'http://localhost:18730',
};

await ensureDatabase(databaseUrl);
await run(npmCommand, ['run', 'prisma:migrate:deploy'], env);
await run(process.execPath, [jestBin, '--config', 'jest.integration.config.mjs', '--runInBand'], env);
