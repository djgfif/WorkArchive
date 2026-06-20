import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { SecurityAuditService } from '../src/security/security-audit.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const ORIGINAL_ENV = { ...process.env };

describe('SecurityAuditService', () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_URL: 'postgresql://work:archive@localhost:5432/work_archive',
      JWT_ACCESS_SECRET: 'test-access-secret-minimum-32-chars',
      JWT_REFRESH_SECRET: 'test-refresh-secret-minimum-32-chars',
      SECURITY_EVENT_HASH_SECRET: 'test-security-event-hash-secret',
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('hashes IP and user-agent values without storing originals', async () => {
    const creates: Array<{ data: Record<string, unknown> }> = [];
    const prisma = {
      securityEvent: {
        create: async (input: { data: Record<string, unknown> }) => {
          creates.push(input);

          return {
            id: 'security-event-1',
            ...input.data,
          };
        },
      },
    } as unknown as PrismaService;
    const service = new SecurityAuditService(prisma);

    await service.record({
      eventType: 'auth.login.failure',
      ipAddress: '203.0.113.10',
      metadata: {
        email: 'frieren@example.com',
        password: 'raw-password',
        reason: 'invalid_credentials',
        token: 'raw-token',
      },
      requestId: 'request-1',
      severity: 'warning',
      userAgent: 'UnitTest/1.0',
    });

    expect(creates).toHaveLength(1);
    const data = creates[0]?.data ?? {};

    expect(data.ipHash).toEqual(service.hashForTest('203.0.113.10'));
    expect(data.userAgentHash).toEqual(service.hashForTest('UnitTest/1.0'));
    expect(data.ipHash).not.toBe('203.0.113.10');
    expect(data.userAgentHash).not.toBe('UnitTest/1.0');
    expect(data.metadata).toEqual({
      reason: 'invalid_credentials',
    });
  });

  it('sanitizes metadata string values before storing security events', async () => {
    const creates: Array<{ data: Record<string, unknown> }> = [];
    const prisma = {
      securityEvent: {
        create: async (input: { data: Record<string, unknown> }) => {
          creates.push(input);

          return {
            id: 'security-event-1',
            ...input.data,
          };
        },
      },
    } as unknown as PrismaService;
    const service = new SecurityAuditService(prisma);

    await service.record({
      eventType: 'http.origin_blocked',
      metadata: {
        callbackUrl: '/api/auth/google/callback?code=oauth-code#fragment',
        description: `Bearer raw-token ${'x'.repeat(220)}`,
        method: 'POST\nX-Leaked: yes',
        origin: 'https://evil.example/path?token=secret',
      },
      requestId: 'request-1',
      severity: 'warning',
    });

    expect(creates).toHaveLength(1);
    expect(creates[0]?.data.metadata).toEqual({
      callbackUrl: '/api/auth/google/callback',
      description: `Bearer [redacted] ${'x'.repeat(139)}...`,
      method: 'POST X-Leaked: yes',
      origin: 'https://evil.example/path',
    });
  });
});
