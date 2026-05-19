import { Logger, ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';

import type { ApiRuntimeConfig } from './config/api-runtime-config';

export function configureApp(app: INestApplication, config: ApiRuntimeConfig) {
  const requestLogger = new Logger('HttpRequest');

  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });
  app.use(cookieParser());
  app.use(helmet());
  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const headerRequestId = request.header('x-request-id');
    const requestId = headerRequestId?.trim() || randomUUID();

    response.setHeader('x-request-id', requestId);
    response.on('finish', () => {
      if (request.path === '/health') {
        return;
      }

      requestLogger.log(
        `requestId=${requestId} method=${request.method} path=${request.path} status=${response.statusCode} durationMs=${Date.now() - startedAt}`,
      );
    });
    next();
  });

  if (config.rateLimitStore === 'memory') {
    app.use(
      [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/refresh',
        '/api/auth/password-reset/request',
        '/api/auth/password-reset/confirm',
      ],
      rateLimit({
        legacyHeaders: false,
        max: 10,
        standardHeaders: true,
        windowMs: 60_000,
      }),
    );
    app.use(
      ['/api/sync/push', '/api/sync/pull'],
      rateLimit({
        legacyHeaders: false,
        max: 30,
        standardHeaders: true,
        windowMs: 60_000,
      }),
    );
  }

  app.enableCors({
    origin: config.corsOrigin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  if (!config.swaggerEnabled) {
    return;
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Work Archive API')
    .setDescription(
      'Milestone 5 production-ready API for a local-first work archive with NestJS, Prisma, and PostgreSQL.',
    )
    .setVersion('0.5.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, swaggerDocument, {
    jsonDocumentUrl: 'docs/openapi.json',
  });
}
