import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HealthModule } from './modules/health/health.module';
import { ImportsModule } from './modules/imports/imports.module';
import { SyncModule } from './modules/sync/sync.module';
import { UserRecordsModule } from './modules/user-records/user-records.module';
import { WorksModule } from './modules/works/works.module';
import { ObservabilityModule } from './observability/observability.module';
import { PrismaModule } from './prisma/prisma.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: {
          ignore: (request) => request.url === '/health',
        },
        genReqId: (request) => {
          const headerRequestId = request.headers['x-request-id'];

          return Array.isArray(headerRequestId)
            ? (headerRequestId[0] ?? randomUUID())
            : (headerRequestId ?? randomUUID());
        },
        level: process.env.LOG_LEVEL?.trim() || 'info',
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
      },
    }),
    ObservabilityModule,
    PrismaModule,
    SecurityModule,
    AuthModule,
    HealthModule,
    CatalogModule,
    UserRecordsModule,
    ImportsModule,
    WorksModule,
    SyncModule,
  ],
})
export class AppModule {}
