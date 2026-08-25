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
import { ApiExceptionFilter } from './security/api-exception-filter';
import {
  createApiContentTypeGuard,
  createApiNoStoreMiddleware,
  createBodyParserErrorHandler,
  createProductionClientHeaderGuard,
  createProductionFetchMetadataGuard,
  createProductionOriginGuard,
  createRequestIdMiddleware,
  createRequestTargetLengthGuard,
  createSecurityRateLimiters,
} from './security/security-middleware';
import { SecurityAuditService } from './security/security-audit.service';

const API_CORS_ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'X-Request-Id',
  'X-Work-Archive-Client',
];
const API_CORS_EXPOSED_HEADERS = ['X-Request-Id'];
const API_CORS_METHODS = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
];
const API_CORS_PREFLIGHT_MAX_AGE_SECONDS = 600;

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
  app.use(createBodyParserErrorHandler(securityAudit));
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
  app.use(createApiNoStoreMiddleware());
  app.use(createMetricsMiddleware(metricsService));
  app.use(createRequestTargetLengthGuard(securityAudit));
  app.use(createApiContentTypeGuard(securityAudit));
  app.use(createProductionFetchMetadataGuard(config, securityAudit));
  app.use(createProductionOriginGuard(config, securityAudit));
  app.use(
    createProductionClientHeaderGuard(config, securityAudit, metricsService),
  );

  const rateLimiters = await createSecurityRateLimiters(
    config,
    securityAudit,
    metricsService,
  );
  app.use('/api', rateLimiters.global);
  app.use('/api/catalog', rateLimiters.catalog);
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
  app.use(
    ['/api/auth/data-export', '/api/auth/account'],
    rateLimiters.authSensitive,
  );
  app.use(['/api/sync/push', '/api/sync/pull'], rateLimiters.sync);
  app.use('/api/image-proxy', rateLimiters.imageProxy);
  app.use(
    [
      '/api/community',
      '/api/works',
      '/api/user-records',
      '/api/user-release-records',
    ],
    rateLimiters.mutations,
  );
  app.use('/api/imports/search', rateLimiters.importsGuest);
  app.use('/api/imports/search', rateLimiters.importsAuthenticated);
  app.use('/api/imports/resolve', rateLimiters.importsProtected);
  app.use('/api/notion', rateLimiters.notion);

  app.enableCors({
    allowedHeaders: API_CORS_ALLOWED_HEADERS,
    credentials: true,
    exposedHeaders: API_CORS_EXPOSED_HEADERS,
    maxAge: API_CORS_PREFLIGHT_MAX_AGE_SECONDS,
    methods: API_CORS_METHODS,
    origin: config.corsOrigin,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      validationError: {
        target: false,
        value: false,
      },
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

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
      recordClientHeaderGuard: () => undefined,
      recordRateLimitExceeded: () => undefined,
      recordRequest: () => undefined,
    };
  }
}
