import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import {
  getPublicApiHost,
  readApiRuntimeConfig,
} from './config/api-runtime-config';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const config = readApiRuntimeConfig();
    const app = await NestFactory.create(AppModule);

    configureApp(app, config);
    await app.listen(config.port, config.host);

    const publicHost = getPublicApiHost(config.host);
    const baseUrl = `http://${publicHost}:${config.port}`;

    logger.log(`API listening on ${baseUrl}`);
    logger.log(`Health check available at ${baseUrl}/health`);
    logger.log(`Swagger UI available at ${baseUrl}/docs`);
  } catch (error) {
    logger.error(
      'API failed to start. Check PORT, HOST, DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, and PostgreSQL availability.',
      error instanceof Error ? error.stack : undefined,
    );
    process.exit(1);
  }
}

void bootstrap();
