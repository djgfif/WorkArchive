import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Request } from 'express';

import { AuthController } from '../src/modules/auth/auth.controller';
import type { AuthService } from '../src/modules/auth/auth.service';
import type { SecurityAuditService } from '../src/security/security-audit.service';

describe('auth structured logs', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs auth.google.failed without OAuth codes, cookies, API keys, or tokens', () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const controller = new AuthController(
      {} as AuthService,
      {} as SecurityAuditService,
    );
    const request = {
      headers: {
        authorization: 'Bearer access_token',
        cookie: 'refresh_token=secret',
      },
      requestId: 'req-auth-redaction',
    } as unknown as Request;

    (controller as unknown as {
      logAuthGoogleFailed(request: Request, errorCode: string): void;
    }).logAuthGoogleFailed(request, 'Error');

    const logPayload = String(warnSpy.mock.calls.at(-1)?.[0] ?? '');

    expect(JSON.parse(logPayload)).toEqual(
      expect.objectContaining({
        durationMs: expect.any(Number),
        errorCode: 'Error',
        event: 'auth.google.failed',
        provider: 'google',
        requestId: 'req-auth-redaction',
      }),
    );
    expect(logPayload).not.toMatch(
      /authorization|cookie|set-cookie|refresh_token|access_token|oauth_code|api_key|raw_image_data/i,
    );
  });
});
