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

import { readApiRuntimeConfig } from '../src/config/api-runtime-config';
import { configureApp } from '../src/configure-app';
import { AuthService } from '../src/modules/auth/auth.service';
import type { ImportProvider } from '../src/modules/imports/imports.constants';
import { ImportsController } from '../src/modules/imports/imports.controller';
import { ImportsService } from '../src/modules/imports/imports.service';
import { SecurityAuditService } from '../src/security/security-audit.service';

describe('imports provider key test API (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let importsService: {
    saveProviderKey: jest.MockedFunction<ImportsService['saveProviderKey']>;
    testProviderKey: jest.MockedFunction<ImportsService['testProviderKey']>;
  };

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.WEB_BASE_URL = 'http://localhost:18730';

    importsService = {
      saveProviderKey: jest
        .fn<ImportsService['saveProviderKey']>()
        .mockImplementation(async (_userId, provider) => ({
          configured: true,
          credentialMode: 'user',
          label: provider,
          provider: provider as ImportProvider,
        })),
      testProviderKey: jest
        .fn<ImportsService['testProviderKey']>()
        .mockResolvedValue({
          checkedAt: '2026-05-20T00:00:00.000Z',
          message: 'TMDB API key connection test succeeded.',
          ok: true,
          provider: 'tmdb',
          reason: null,
        }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            validateAccessToken: jest.fn<AuthService['validateAccessToken']>(
              async () => ({
                email: 'frieren@example.com',
                role: 'user',
                sessionId: 'session-1',
                userId: 'user-1',
              }),
            ),
          },
        },
        {
          provide: ImportsService,
          useValue: importsService,
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

  it('requires auth and tests the requested provider key', async () => {
    const missingAuthResponse = await fetch(
      `${baseUrl}/api/imports/providers/tmdb/test`,
      {
        method: 'POST',
      },
    );

    expect(missingAuthResponse.status).toBe(401);

    const response = await fetch(`${baseUrl}/api/imports/providers/tmdb/test`, {
      headers: {
        authorization: 'Bearer access-token',
      },
      method: 'POST',
    });

    await expect(response.json()).resolves.toEqual({
      checkedAt: '2026-05-20T00:00:00.000Z',
      message: 'TMDB API key connection test succeeded.',
      ok: true,
      provider: 'tmdb',
      reason: null,
    });
    expect(response.status).toBe(200);
    expect(importsService.testProviderKey).toHaveBeenCalledWith(
      'user-1',
      'tmdb',
    );
  });

  it('normalizes wrapped and flat provider key payloads before saving', async () => {
    const wrappedResponse = await fetch(
      `${baseUrl}/api/imports/providers/tmdb/key`,
      {
        body: JSON.stringify({
          values: {
            readToken: ' tmdb-read-token ',
          },
        }),
        headers: {
          authorization: 'Bearer access-token',
          'content-type': 'application/json',
        },
        method: 'PUT',
      },
    );

    expect(wrappedResponse.status).toBe(200);
    expect(importsService.saveProviderKey).toHaveBeenCalledWith(
      'user-1',
      'tmdb',
      {
        readToken: 'tmdb-read-token',
      },
    );

    const flatResponse = await fetch(
      `${baseUrl}/api/imports/providers/brave_search/key`,
      {
        body: JSON.stringify({
          apiKey: ' brave-user-key ',
        }),
        headers: {
          authorization: 'Bearer access-token',
          'content-type': 'application/json',
        },
        method: 'PUT',
      },
    );

    expect(flatResponse.status).toBe(200);
    expect(importsService.saveProviderKey).toHaveBeenCalledWith(
      'user-1',
      'brave_search',
      {
        apiKey: 'brave-user-key',
      },
    );
  });
});
