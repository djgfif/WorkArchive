import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import type { ApiRuntimeConfig } from './config/api-runtime-config';

export function configureApp(app: INestApplication, config: ApiRuntimeConfig) {
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });
  app.use(cookieParser());
  app.use(helmet());
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
