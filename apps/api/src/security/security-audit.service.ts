import { createHmac } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';

import { readApiRuntimeConfig } from '../config/api-runtime-config';
import { PrismaService } from '../prisma/prisma.service';

export type SecurityEventSeverity = 'info' | 'warning' | 'critical';

export type SecurityEventType =
  | 'auth.login.failure'
  | 'auth.login.success'
  | 'auth.logout'
  | 'auth.refresh.failure'
  | 'auth.refresh.reuse_detected'
  | 'auth.session.revoke'
  | 'auth.session.revoke_all'
  | 'http.origin_blocked'
  | 'http.rate_limit_exceeded';

export interface SecurityAuditContext {
  ipAddress?: string | null;
  request?: Request;
  requestId?: string | null;
  sessionId?: string | null;
  userAgent?: string | null;
  userId?: string | null;
}

export interface SecurityAuditEvent extends SecurityAuditContext {
  eventType: SecurityEventType;
  metadata?: Record<string, unknown>;
  severity: SecurityEventSeverity;
}

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(event: SecurityAuditEvent) {
    try {
      const context = this.normalizeContext(event);

      await this.prisma.securityEvent.create({
        data: {
          eventType: event.eventType,
          ipHash: this.hashNullable(context.ipAddress),
          metadata: this.sanitizeMetadata(
            event.metadata,
          ) as Prisma.InputJsonValue,
          requestId: context.requestId,
          sessionId: event.sessionId ?? null,
          severity: event.severity,
          userAgentHash: this.hashNullable(context.userAgent),
          userId: event.userId ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Security audit event was not stored eventType=${event.eventType} reason=${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  hashForTest(value: string | null | undefined) {
    return this.hashNullable(value);
  }

  private normalizeContext(event: SecurityAuditEvent) {
    const request = event.request;
    const rawUserAgent = request?.headers['user-agent'];

    return {
      ipAddress: event.ipAddress ?? request?.ip ?? null,
      requestId: event.requestId ?? getRequestId(request) ?? null,
      userAgent:
        event.userAgent ??
        (Array.isArray(rawUserAgent)
          ? rawUserAgent.join(' ')
          : (rawUserAgent ?? null)),
    };
  }

  private hashNullable(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    return createHmac('sha256', readApiRuntimeConfig().securityEventHashSecret)
      .update(value, 'utf8')
      .digest('hex');
  }

  private sanitizeMetadata(metadata: Record<string, unknown> = {}) {
    return Object.fromEntries(
      Object.entries(metadata).filter(
        ([key, value]) =>
          isJsonSafePrimitive(value) && !isSensitiveMetadataKey(key),
      ),
    ) as Record<string, JsonPrimitive>;
  }
}

type JsonPrimitive = string | number | boolean | null;

export function getRequestId(request: Request | undefined) {
  const requestWithId = request as
    | (Request & {
        requestId?: string;
      })
    | undefined;

  return requestWithId?.requestId ?? null;
}

export function setRequestId(request: Request, requestId: string) {
  const requestWithId = request as Request & {
    requestId?: string;
  };

  requestWithId.requestId = requestId;
}

function isJsonSafePrimitive(value: unknown) {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function isSensitiveMetadataKey(key: string) {
  return /authorization|api[-_]?key|cookie|email|password|secret|token/i.test(
    key,
  );
}
