import type { PrismaService } from '../src/prisma/prisma.service';

const RESET_TABLES = [
  'catalog_audit_logs',
  'catalog_submissions',
  'external_api_credentials',
  'password_reset_tokens',
  'user_refresh_sessions',
  'user_release_records',
  'user_timeline_entries',
  'user_work_records',
  'catalog_external_refs',
  'catalog_relations',
  'catalog_title_contributors',
  'catalog_releases',
  'catalog_titles',
  'contributors',
  'franchises',
  'catalog_works',
  'users',
] as const;

function assertSafeIntegrationDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL ?? '';

  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Integration DB reset requires NODE_ENV=test.');
  }

  if (!/(test|integration)/i.test(databaseUrl)) {
    throw new Error(
      'Integration DB reset requires DATABASE_URL to include "test" or "integration".',
    );
  }
}

export async function resetIntegrationDatabase(prisma: PrismaService) {
  assertSafeIntegrationDatabaseUrl();

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${RESET_TABLES.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}
