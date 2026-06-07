import {
  RequestMethod,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import type { ApiRuntimeConfig } from './config/api-runtime-config';
import { createMetricsMiddleware } from './observability/metrics.middleware';
import { MetricsService } from './observability/metrics.service';
import {
  createProductionClientHeaderGuard,
  createProductionFetchMetadataGuard,
  createProductionOriginGuard,
  createRequestIdMiddleware,
  createSecurityRateLimiters,
} from './security/security-middleware';
import { SecurityAuditService } from './security/security-audit.service';

interface ExpressInstance {
  disable(name: string): void;
  set(name: string, value: unknown): void;
}

export async function configureApp(
  app: INestApplication,
  config: ApiRuntimeConfig,
) {
  const expressInstance = app.getHttpAdapter().getInstance() as ExpressInstance;
  const securityAudit = app.get(SecurityAuditService, { strict: false });
  const metricsService = getOptionalMetricsService(app);

  expressInstance.disable('x-powered-by');

  if (config.trustProxyHops !== null) {
    expressInstance.set('trust proxy', config.trustProxyHops);
  }

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'livez', method: RequestMethod.GET },
      { path: 'readyz', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
    ],
  });
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          baseUri: ["'none'"],
          defaultSrc: ["'none'"],
          formAction: ["'none'"],
          frameAncestors: ["'none'"],
          imgSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          scriptSrc: config.isProduction
            ? ["'none'"]
            : ["'self'", "'unsafe-inline'"],
          styleSrc: config.isProduction
            ? ["'none'"]
            : ["'self'", "'unsafe-inline'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hidePoweredBy: true,
    }),
  );
  app.use(createRequestIdMiddleware());
  app.use(createMetricsMiddleware(metricsService));
  app.use(createProductionFetchMetadataGuard(config, securityAudit));
  app.use(createProductionOriginGuard(config, securityAudit));
  app.use(createProductionClientHeaderGuard(config, securityAudit));

  const rateLimiters = await createSecurityRateLimiters(config, securityAudit);
  app.use(
    [
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/register',
      '/api/auth/google/start',
      '/api/auth/google/callback',
      '/api/auth/refresh',
    ],
    rateLimiters.auth,
  );
  app.use(['/api/sync/push', '/api/sync/pull'], rateLimiters.sync);
  app.use('/api/imports/search', rateLimiters.importsGuest);
  app.use('/api/imports/search', rateLimiters.importsAuthenticated);
  app.use('/api/imports/resolve', rateLimiters.importsAuthenticated);

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

function getOptionalMetricsService(app: INestApplication) {
  try {
    return app.get(MetricsService, { strict: false });
  } catch {
    return {
      recordRequest: () => undefined,
    };
  }
}
