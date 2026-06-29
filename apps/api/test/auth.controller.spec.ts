import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';

import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { REFRESH_TOKEN_COOKIE_NAME } from '../src/modules/auth/auth.cookies';
import { GoogleOAuthFlowStoreService } from '../src/modules/auth/google-oauth-flow-store.service';
import { SecurityAuditService } from '../src/security/security-audit.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    refresh: jest.MockedFunction<AuthService['refresh']>;
  };

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.WEB_BASE_URL = 'http://localhost:18730';

    authService = {
      refresh: jest.fn<AuthService['refresh']>(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: SecurityAuditService,
          useValue: {
            record: jest.fn<SecurityAuditService['record']>().mockResolvedValue(),
          },
        },
        {
          provide: GoogleOAuthFlowStoreService,
          useValue: {
            consume: jest
              .fn<GoogleOAuthFlowStoreService['consume']>()
              .mockResolvedValue(null),
            onModuleDestroy: jest
              .fn<GoogleOAuthFlowStoreService['onModuleDestroy']>()
              .mockResolvedValue(),
            store: jest
              .fn<GoogleOAuthFlowStoreService['store']>()
              .mockResolvedValue(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('clears the refresh cookie when refresh token validation fails', async () => {
    authService.refresh.mockRejectedValue(
      new UnauthorizedException('Invalid or expired refresh token.'),
    );

    const response = {
      clearCookie: jest.fn<Response['clearCookie']>(),
    } as unknown as Response;
    const request = {
      cookies: {
        [REFRESH_TOKEN_COOKIE_NAME]: 'expired-refresh-token',
      },
      headers: {
        'user-agent': 'UnitTest/1.0',
      },
      ip: '203.0.113.10',
    } as unknown as Request;

    await expect(controller.refresh(request, response)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(response.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE_NAME,
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
      }),
    );
    expect(authService.refresh).toHaveBeenCalledWith(
      'expired-refresh-token',
      expect.objectContaining({
        ipAddress: '203.0.113.10',
        userAgent: 'UnitTest/1.0',
      }),
    );
  });
});
