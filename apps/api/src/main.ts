import 'reflect-metadata';

import { Logger as BootstrapLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';

import {
  getPublicApiHost,
  readApiRuntimeConfig,
} from './config/api-runtime-config';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { configureHttpServerTimeouts } from './configure-http-server-timeouts';

async function bootstrap() {
  const logger = new BootstrapLogger('Bootstrap');

  try {
    const config = readApiRuntimeConfig();
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      bufferLogs: true,
      bodyParser: false,
    });

    app.useBodyParser('json', { limit: config.jsonBodyLimit });
    app.useBodyParser('urlencoded', {
      extended: false,
      limit: config.urlencodedBodyLimit,
    });
    app.enableShutdownHooks(['SIGTERM', 'SIGINT']);
    app.useLogger(app.get(Logger));
    await configureApp(app, config);
    configureHttpServerTimeouts(app.getHttpServer(), config);
    await app.listen(config.port, config.host);

    const publicHost = getPublicApiHost(config.host);
    const baseUrl = `http://${publicHost}:${config.port}`;

    logger.log(`API listening on ${baseUrl}`);
    logger.log(`Health check available at ${baseUrl}/health`);

    if (config.swaggerEnabled) {
      logger.log(`Swagger UI available at ${baseUrl}/docs`);
    }
  } catch (error) {
    logger.error(
      JSON.stringify({
        errorCode: describeBootstrapError(error),
        event: 'api.bootstrap.failed',
      }),
    );
    process.exit(1);
  }
}

void bootstrap();

function describeBootstrapError(error: unknown) {
  return error instanceof Error ? error.name : 'UnknownError';
}
