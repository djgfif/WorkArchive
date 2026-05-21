import { type AddressInfo } from 'node:net';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { readApiRuntimeConfig } from '../src/config/api-runtime-config';
import { configureApp } from '../src/configure-app';
import { SecurityAuditService } from '../src/security/security-audit.service';

describe('auth profile API (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let authService: {
    updateProfile: jest.MockedFunction<AuthService['updateProfile']>;
    validateAccessToken: jest.MockedFunction<AuthService['validateAccessToken']>;
  };

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.WEB_BASE_URL = 'http://127.0.0.1:53173';

    authService = {
      updateProfile: jest.fn<AuthService['updateProfile']>().mockResolvedValue({
        authAccounts: [],
        avatarUrl: 'https://example.com/avatar.jpg',
        email: 'frieren@example.com',
        handle: 'mage_frieren',
        id: 'user-1',
        nickname: 'Mage Frieren',
        role: 'user',
      }),
      validateAccessToken: jest
        .fn<AuthService['validateAccessToken']>()
        .mockResolvedValue({
          email: 'frieren@example.com',
          role: 'user',
          sessionId: 'session-1',
          userId: 'user-1',
        }),
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
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await configureApp(app, readApiRuntimeConfig());
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  it('updates the authenticated profile', async () => {
    const response = await fetch(`${baseUrl}/api/auth/profile`, {
      body: JSON.stringify({
        avatarUrl: 'https://example.com/avatar.jpg',
        handle: 'mage_frieren',
        nickname: 'Mage Frieren',
      }),
      headers: {
        authorization: 'Bearer access-token',
        'content-type': 'application/json',
      },
      method: 'PATCH',
    });

    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        email: 'frieren@example.com',
        avatarUrl: 'https://example.com/avatar.jpg',
        handle: 'mage_frieren',
        nickname: 'Mage Frieren',
      }),
    );
    expect(response.status).toBe(200);
    expect(authService.updateProfile).toHaveBeenCalledWith('user-1', {
      handle: 'mage_frieren',
      nickname: 'Mage Frieren',
      avatarUrl: 'https://example.com/avatar.jpg',
    });
  });

  it('requires a bearer token and rejects invalid handles', async () => {
    const missingAuthResponse = await fetch(`${baseUrl}/api/auth/profile`, {
      body: JSON.stringify({
        avatarUrl: '',
        handle: 'mage_frieren',
        nickname: 'Mage Frieren',
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'PATCH',
    });

    expect(missingAuthResponse.status).toBe(401);

    const invalidHandleResponse = await fetch(`${baseUrl}/api/auth/profile`, {
      body: JSON.stringify({
        avatarUrl: '',
        handle: 'Mage',
        nickname: 'Mage Frieren',
      }),
      headers: {
        authorization: 'Bearer access-token',
        'content-type': 'application/json',
      },
      method: 'PATCH',
    });

    expect(invalidHandleResponse.status).toBe(400);
    expect(authService.updateProfile).toHaveBeenCalledTimes(0);
  });
});
