import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './modules/auth';
import { CatalogModule } from './modules/catalog';
import { HealthModule } from './modules/health';
import { ImportsModule } from './modules/imports';
import { SyncModule } from './modules/sync';
import { UserRecordsModule } from './modules/user-records';
import { WorksModule } from './modules/works';
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
