import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

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
        description: `Bearer raw-token code=inline-code state=inline-state id_token=inline-id-token ${'x'.repeat(220)}`,
        diagnostic:
          'oauth_code=inline-oauth-code errorCode=Timeout session=session-secret',
        errorCode: 'OAuthCallbackError',
        method: 'POST\nX-Leaked: yes',
        origin: 'https://evil.example/path?token=secret',
      },
      requestId: 'request-1',
      severity: 'warning',
    });

    expect(creates).toHaveLength(1);
    const metadata = creates[0]?.data.metadata as Record<string, unknown>;

    expect(metadata).toEqual({
      callbackUrl: '/api/auth/google/callback',
      description: expect.stringMatching(
        /^Bearer \[redacted\] code=\[redacted\] state=\[redacted\] id_token=\[redacted\] x+\.\.\.$/,
      ),
      diagnostic:
        'oauth_code=[redacted] errorCode=Timeout session=[redacted]',
      errorCode: 'OAuthCallbackError',
      method: 'POST X-Leaked: yes',
      origin: 'https://evil.example/path',
    });
    expect(String(metadata.description)).toHaveLength(160);
    expect(JSON.stringify(metadata)).not.toMatch(
      /raw-token|inline-code|inline-state|inline-id-token|inline-oauth-code|session-secret|secret/,
    );
  });

  it('drops sensitive OAuth and session metadata keys without dropping bounded error codes', async () => {
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
      metadata: {
        authorizationCode: 'oauth-code-secret',
        code: 'oauth-code-secret',
        credential: 'provider-credential-secret',
        errorCode: 'invalid_oauth_state',
        nonce: 'oauth-nonce-secret',
        oauth_code: 'oauth-code-secret',
        provider: 'google',
        providerAccountId: 'provider-account-id-secret',
        reason: 'invalid_oauth_state',
        session: 'session-secret',
        setCookie: 'cookie-secret',
        state: 'oauth-state-secret',
      },
      requestId: 'request-1',
      severity: 'warning',
    });

    expect(creates).toHaveLength(1);
    expect(creates[0]?.data.metadata).toEqual({
      errorCode: 'invalid_oauth_state',
      provider: 'google',
      reason: 'invalid_oauth_state',
    });
    expect(JSON.stringify(creates[0]?.data.metadata)).not.toMatch(
      /oauth-code-secret|oauth-state-secret|oauth-nonce-secret|session-secret|provider-account-id-secret|cookie-secret|provider-credential-secret/,
    );
  });

  it('logs security audit storage failures without raw database errors', async () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const prisma = {
      securityEvent: {
        create: async () => {
          throw new Error(
            'DATABASE_URL=postgresql://secret access_token raw audit payload',
          );
        },
      },
    } as unknown as PrismaService;
    const service = new SecurityAuditService(prisma);

    await service.record({
      eventType: 'auth.login.failure',
      requestId: 'request-audit-1',
      severity: 'warning',
    });

    const warning = String(warnSpy.mock.calls[0]?.[0] ?? '');

    expect(JSON.parse(warning)).toEqual(
      expect.objectContaining({
        errorCode: 'Error',
        event: 'security_audit.store_failed',
        eventType: 'auth.login.failure',
        requestId: 'request-audit-1',
      }),
    );
    expect(warning).not.toMatch(
      /DATABASE_URL|postgresql:\/\/secret|access_token|raw audit payload/,
    );

    warnSpy.mockRestore();
  });
});
