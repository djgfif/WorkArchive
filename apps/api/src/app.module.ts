import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

import { Module, RequestMethod } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './modules/auth';
import { CatalogModule } from './modules/catalog';
import { CommunityModule } from './modules/community';
import { HealthModule } from './modules/health';
import { ImageProxyModule } from './modules/image-proxy';
import { ImportsModule } from './modules/imports';
import { NotionModule } from './modules/notion';
import { ProductReleaseModule } from './modules/product-release';
import { SyncModule } from './modules/sync';
import { UserRecordsModule } from './modules/user-records';
import { WorksModule } from './modules/works';
import { ObservabilityModule } from './observability/observability.module';
import { PrismaModule } from './prisma/prisma.module';
import { readApiLogLevel } from './config/api-runtime-config';
import { normalizeRequestId } from './security/request-id';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: {
          ignore: (request) => request.url === '/health',
        },
        genReqId: (request) => {
          return (
            normalizeRequestId(request.headers['x-request-id']) ?? randomUUID()
          );
        },
        level: readApiLogLevel(),
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
        serializers: {
          req: serializeRequestForLog,
        },
      },
      forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
    }),
    ObservabilityModule,
    PrismaModule,
    SecurityModule,
    AuthModule,
    HealthModule,
    ImageProxyModule,
    CatalogModule,
    CommunityModule,
    ProductReleaseModule,
    UserRecordsModule,
    ImportsModule,
    NotionModule,
    WorksModule,
    SyncModule,
  ],
})
export class AppModule {}

interface LoggableRequest {
  headers?: IncomingHttpHeaders;
  id?: unknown;
  method?: string;
  originalUrl?: string;
  socket?: {
    remoteAddress?: string;
    remotePort?: number;
  };
  url?: string;
}

export function serializeRequestForLog(request: LoggableRequest) {
  return {
    headers: request.headers,
    id: request.id,
    method: request.method,
    remoteAddress: request.socket?.remoteAddress,
    remotePort: request.socket?.remotePort,
    url: sanitizeRequestUrlForLog(request.originalUrl ?? request.url),
  };
}

export function sanitizeRequestUrlForLog(value: string | undefined) {
  if (!value) {
    return value;
  }

  if (!value.includes('?') && !value.includes('#')) {
    return value;
  }

  try {
    return new URL(value).pathname;
  } catch {
    // Relative request targets are expected here; split defensively if parsing
    // fails for an unusual proxy-provided value.
  }

  try {
    return new URL(value, 'https://work-archive.local').pathname;
  } catch {
    return value.split(/[?#]/, 1)[0] || '/';
  }
}
