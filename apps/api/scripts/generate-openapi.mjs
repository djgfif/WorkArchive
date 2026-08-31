import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@127.0.0.1:18732/work_archive_openapi?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'openapi-access-secret-minimum-32-characters';
process.env.JWT_REFRESH_SECRET ??=
  'openapi-refresh-secret-minimum-32-characters';
process.env.EXTERNAL_API_KEY_ENCRYPTION_SECRET ??=
  'openapi-encryption-secret-minimum-32-characters';
process.env.SECURITY_EVENT_HASH_SECRET ??=
  'openapi-security-event-secret-minimum-32-characters';

const outputPath = resolve(
  process.cwd(),
  process.argv[2] ?? 'openapi/work-archive-api.json',
);

const [{ NestFactory }, { AppModule }, { createOpenApiDocument }] =
  await Promise.all([
    import('@nestjs/core'),
    import('../dist/app.module.js'),
    import('../dist/configure-app.js'),
  ]);

const app = await NestFactory.create(AppModule, {
  abortOnError: false,
  logger: false,
});

try {
  app.setGlobalPrefix('api', {
    exclude: ['health', 'livez', 'readyz', 'metrics'],
  });
  const document = createOpenApiDocument(app);

  await mkdir(resolve(outputPath, '..'), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  process.stdout.write(`Generated ${outputPath}\n`);
} finally {
  await app.close();
}
