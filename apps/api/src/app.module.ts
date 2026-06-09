import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { Module, RequestMethod } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './modules/auth';
import { CatalogModule } from './modules/catalog';
import { HealthModule } from './modules/health';
import { ImageProxyModule } from './modules/image-proxy';
import { ImportsModule } from './modules/imports';
import { NotionModule } from './modules/notion';
import { SyncModule } from './modules/sync';
import { UserRecordsModule } from './modules/user-records';
import { WorksModule } from './modules/works';
import { ObservabilityModule } from './observability/observability.module';
import { PrismaModule } from './prisma/prisma.module';
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
        level: process.env.LOG_LEVEL?.trim() || 'info',
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
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
    UserRecordsModule,
    ImportsModule,
    NotionModule,
    WorksModule,
    SyncModule,
  ],
})
export class AppModule {}
