import { Logger, ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import type { ApiRuntimeConfig } from './config/api-runtime-config';
import {
  createProductionOriginGuard,
  createRequestIdMiddleware,
  createSecurityRateLimiters,
} from './security/security-middleware';
import {
  getRequestId,
  SecurityAuditService,
} from './security/security-audit.service';

interface ExpressInstance {
  disable(name: string): void;
  set(name: string, value: unknown): void;
}

export async function configureApp(
  app: INestApplication,
  config: ApiRuntimeConfig,
) {
  const requestLogger = new Logger('HttpRequest');
  const expressInstance = app.getHttpAdapter().getInstance() as ExpressInstance;
  const securityAudit = app.get(SecurityAuditService, { strict: false });

  expressInstance.disable('x-powered-by');

  if (config.trustProxyHops !== null) {
    expressInstance.set('trust proxy', config.trustProxyHops);
  }

  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hidePoweredBy: true,
    }),
  );
  app.use(createRequestIdMiddleware());
  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = Date.now();

    response.on('finish', () => {
      if (request.path === '/health') {
        return;
      }

      requestLogger.log(
        `requestId=${getRequestId(request)} method=${request.method} path=${request.path} status=${response.statusCode} durationMs=${Date.now() - startedAt}`,
      );
    });
    next();
  });
  app.use(createProductionOriginGuard(config, securityAudit));

  const rateLimiters = await createSecurityRateLimiters(config, securityAudit);
  app.use(
    [
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/register',
      '/api/auth/refresh',
      '/api/auth/password-reset/request',
      '/api/auth/password-reset/confirm',
    ],
    rateLimiters.auth,
  );
  app.use(['/api/sync/push', '/api/sync/pull'], rateLimiters.sync);

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
