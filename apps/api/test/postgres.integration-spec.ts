import { type AddressInfo } from 'node:net';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';

import { AppModule } from '../src/app.module';
import { readApiRuntimeConfig } from '../src/config/api-runtime-config';
import { configureApp } from '../src/configure-app';
import { AuthService } from '../src/modules/auth/auth.service';
import { SYNC_SCHEMA_VERSION } from '../src/modules/sync/sync.constants';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetIntegrationDatabase } from './integration-db';
import { createTestSession } from './test-auth-session';

interface JsonResponse<TBody = unknown> {
  body: TBody | null;
  setCookie: string | null;
  status: number;
}

interface AuthSessionBody {
  accessToken: string;
}

let app: INestApplication;
let authService: AuthService;
let baseUrl: string;
let prisma: PrismaService;

function configureIntegrationEnvironment() {
  process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN ??= 'http://localhost:18730';
  process.env.EXTERNAL_API_KEY_ENCRYPTION_SECRET ??=
    'integration-external-api-key-secret-minimum-32-chars';
  process.env.JWT_ACCESS_SECRET ??=
    'integration-access-secret-minimum-32-chars';
  process.env.JWT_REFRESH_SECRET ??=
    'integration-refresh-secret-minimum-32-chars';
  process.env.SWAGGER_ENABLED ??= 'false';
process.env.WEB_BASE_URL ??= 'http://localhost:18730';

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set for API integration tests.');
  }
}

function extractCookieHeader(setCookie: string | null) {
  if (!setCookie) {
    throw new Error('Expected response to include a Set-Cookie header.');
  }

  return setCookie.split(';')[0]!;
}

async function requestJson<TBody = unknown>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
  cookie?: string,
): Promise<JsonResponse<TBody>> {
  const headers = new Headers(init.headers);

  if (typeof init.body === 'string' && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  if (cookie) {
    headers.set('cookie', cookie);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });
  const setCookie =
    (response.headers as Headers & { getSetCookie?: () => string[] })
      .getSetCookie?.()[0] ??
    response.headers.get('set-cookie');
  const text = await response.text();

  return {
    body: text ? (JSON.parse(text) as TBody) : null,
    setCookie,
    status: response.status,
  };
}

async function createAuthenticatedUser(email: string, rememberMe = true) {
  const session = await createTestSession({
    authService,
    email,
    prisma,
    rememberMe,
  });

  return {
    accessToken: session.accessToken,
    cookie: session.cookie,
    userId: session.userId,
  };
}

function buildSyncWorkPayload(
  id: string,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id,
    catalogTitleId: null,
    importDraft: null,
    type: WorkType.novel,
    title: 'Dune',
    author: 'Frank Herbert',
    genres: ['SF'],
    personalTags: [],
    description: '',
    thumbnailUrl: '',
    status: WorkStatus.in_progress,
    rating: 4.5,
    shortReview: '',
    review: '',
    favorite: false,
    progressCurrent: null,
    progressTotal: null,
    progressUnit: null,
    lastConsumedLabel: null,
    startedAt: null,
    completedAt: null,
    droppedAt: null,
    lastConsumedAt: null,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

describe('API PostgreSQL integration', () => {
  beforeAll(async () => {
    configureIntegrationEnvironment();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await configureApp(app, readApiRuntimeConfig());
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    authService = app.get(AuthService);
    prisma = app.get(PrismaService);
    await prisma.$queryRaw`SELECT 1`;
  });

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('runs auth session persistence and refresh rotation against real users', async () => {
    const registered = await createAuthenticatedUser('auth-db@example.com');
    const createdUser = await prisma.user.findUnique({
      where: {
        id: registered.userId,
      },
    });
    const createdSessions = await prisma.userRefreshSession.findMany({
      where: {
        userId: registered.userId,
      },
    });

    expect(createdUser?.refreshTokenHash).toBeNull();
    expect(createdSessions).toHaveLength(1);
    expect(createdSessions[0]?.tokenHash).toEqual(expect.any(String));

    const meResponse = await requestJson('/api/auth/me', undefined, registered.accessToken);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body).toEqual(
      expect.objectContaining({
        id: registered.userId,
        email: 'auth-db@example.com',
      }),
    );

    const refreshResponse = await requestJson<AuthSessionBody>(
      '/api/auth/refresh',
      {
        method: 'POST',
      },
      undefined,
      registered.cookie,
    );

    expect(refreshResponse.status).toBe(200);

    const refreshedCookie = extractCookieHeader(refreshResponse.setCookie);
    const refreshedSession = await prisma.userRefreshSession.findUniqueOrThrow({
      where: {
        id: createdSessions[0]!.id,
      },
    });

    expect(refreshedSession.tokenHash).toEqual(expect.any(String));
    expect(refreshedSession.tokenHash).not.toBe(createdSessions[0]?.tokenHash);
    expect(refreshedSession.rotatedAt).toBeInstanceOf(Date);

    const sessionsResponse = await requestJson(
      '/api/auth/sessions',
      undefined,
      refreshResponse.body!.accessToken,
    );

    expect(sessionsResponse.status).toBe(200);
    expect(sessionsResponse.body).toEqual({
      sessions: [
        expect.objectContaining({
          id: createdSessions[0]!.id,
          current: true,
          rememberMe: true,
        }),
      ],
    });

    const logoutResponse = await requestJson(
      '/api/auth/logout',
      {
        method: 'POST',
      },
      undefined,
      refreshedCookie,
    );

    expect(logoutResponse.status).toBe(204);

    const loggedOutSession = await prisma.userRefreshSession.findUniqueOrThrow({
      where: {
        id: createdSessions[0]!.id,
      },
    });

    expect(loggedOutSession.revokedAt).toBeInstanceOf(Date);

    const refreshAfterLogoutResponse = await requestJson(
      '/api/auth/refresh',
      {
        method: 'POST',
      },
      undefined,
      refreshedCookie,
    );

    expect(refreshAfterLogoutResponse.status).toBe(401);
  });

  it('manages multiple refresh sessions and revokes all on token reuse', async () => {
    const firstSession = await createAuthenticatedUser('session-db@example.com');
    const secondSession = await createAuthenticatedUser(
      'session-db@example.com',
      false,
    );
    const secondCookie = secondSession.cookie;
    const activeSessions = await prisma.userRefreshSession.findMany({
      where: {
        userId: firstSession.userId,
        revokedAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    expect(activeSessions).toHaveLength(2);

    const listResponse = await requestJson(
      '/api/auth/sessions',
      undefined,
      secondSession.accessToken,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      sessions: expect.arrayContaining([
        expect.objectContaining({
          id: activeSessions[0]!.id,
          current: false,
        }),
        expect.objectContaining({
          id: activeSessions[1]!.id,
          current: true,
        }),
      ]),
    });

    const revokeOtherResponse = await requestJson(
      `/api/auth/sessions/${activeSessions[0]!.id}`,
      {
        method: 'DELETE',
      },
      secondSession.accessToken,
    );

    expect(revokeOtherResponse.status).toBe(204);

    const firstSessionAfterRevoke =
      await prisma.userRefreshSession.findUniqueOrThrow({
        where: {
          id: activeSessions[0]!.id,
        },
      });
    const secondSessionAfterRevoke =
      await prisma.userRefreshSession.findUniqueOrThrow({
        where: {
          id: activeSessions[1]!.id,
        },
      });

    expect(firstSessionAfterRevoke.revokedAt).toBeInstanceOf(Date);
    expect(secondSessionAfterRevoke.revokedAt).toBeNull();

    const refreshResponse = await requestJson<AuthSessionBody>(
      '/api/auth/refresh',
      {
        method: 'POST',
      },
      undefined,
      secondCookie,
    );

    expect(refreshResponse.status).toBe(200);

    const staleReuseResponse = await requestJson(
      '/api/auth/refresh',
      {
        method: 'POST',
      },
      undefined,
      secondCookie,
    );

    expect(staleReuseResponse.status).toBe(401);
    await expect(
      prisma.userRefreshSession.count({
        where: {
          userId: firstSession.userId,
          revokedAt: null,
        },
      }),
    ).resolves.toBe(0);
  });

  it('persists works with user isolation and ownership protection', async () => {
    const firstUser = await createAuthenticatedUser('works-owner@example.com');
    const secondUser = await createAuthenticatedUser('works-other@example.com');

    const createResponse = await requestJson<{ id: string }>(
      '/api/works',
      {
        method: 'POST',
        body: JSON.stringify({
          type: WorkType.anime,
          title: "  Frieren: Beyond Journey's End  ",
          author: ' Kanehito Yamada ',
          genres: [' Fantasy ', 'Drama', 'Fantasy'],
          status: WorkStatus.completed,
          rating: 4.5,
          favorite: true,
        }),
      },
      firstUser.accessToken,
    );

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: "Frieren: Beyond Journey's End",
      }),
    );

    const workId = createResponse.body!.id;

    await expect(prisma.catalogWork.count()).resolves.toBe(1);
    await expect(
      prisma.userWorkRecord.count({
        where: {
          id: workId,
          userId: firstUser.userId,
        },
      }),
    ).resolves.toBe(1);

    const secondUserList = await requestJson(
      '/api/works',
      undefined,
      secondUser.accessToken,
    );
    const secondUserDetail = await requestJson(
      `/api/works/${workId}`,
      undefined,
      secondUser.accessToken,
    );
    const secondUserUpdate = await requestJson(
      `/api/works/${workId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Fern edition',
        }),
      },
      secondUser.accessToken,
    );
    const secondUserDelete = await requestJson(
      `/api/works/${workId}`,
      {
        method: 'DELETE',
      },
      secondUser.accessToken,
    );

    expect(secondUserList.status).toBe(200);
    expect(secondUserList.body).toEqual([]);
    expect(secondUserDetail.status).toBe(404);
    expect(secondUserUpdate.status).toBe(404);
    expect(secondUserDelete.status).toBe(404);
  });

  it('round-trips sync create, update, conflict, delete, and pull cursor in PostgreSQL', async () => {
    const user = await createAuthenticatedUser('sync-db@example.com');
    const workId = '3f831224-abf9-44c3-b3f9-9ff4da2f7de8';

    const createResponse = await requestJson(
      '/api/sync/push',
      {
        method: 'POST',
        body: JSON.stringify({
          schemaVersion: SYNC_SCHEMA_VERSION,
          changes: [
            {
              queueId: '6a8f8eb6-8317-4e8a-b8e7-530c5cc1db4d',
              entityType: 'work',
              entityId: workId,
              operation: 'create',
              createdAt: '2026-04-18T00:00:00.000Z',
              payload: buildSyncWorkPayload(workId),
            },
          ],
        }),
      },
      user.accessToken,
    );

    expect(createResponse.status).toBe(200);
    expect(createResponse.body).toEqual(
      expect.objectContaining({
        results: [
          expect.objectContaining({
            status: 'applied',
            work: expect.objectContaining({
              id: workId,
              serverVersion: 1,
              syncStatus: 'synced',
            }),
          }),
        ],
      }),
    );

    const createdRecord = await prisma.userWorkRecord.findUniqueOrThrow({
      where: {
        id: workId,
      },
    });

    expect(createdRecord.userId).toBe(user.userId);
    expect(createdRecord.serverVersion).toBe(1);

    const updateResponse = await requestJson(
      '/api/sync/push',
      {
        method: 'POST',
        body: JSON.stringify({
          schemaVersion: SYNC_SCHEMA_VERSION,
          changes: [
            {
              queueId: 'ea483856-fafc-4aa9-ac6f-925f9c34d5ea',
              entityType: 'work',
              entityId: workId,
              operation: 'update',
              createdAt: '2026-04-18T00:02:00.000Z',
              payload: buildSyncWorkPayload(workId, {
                title: 'Dune Messiah',
                updatedAt: '2026-04-18T00:02:00.000Z',
                serverVersion: 1,
              }),
            },
          ],
        }),
      },
      user.accessToken,
    );

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toEqual(
      expect.objectContaining({
        results: [
          expect.objectContaining({
            status: 'applied',
            work: expect.objectContaining({
              title: 'Dune Messiah',
              serverVersion: 2,
            }),
          }),
        ],
      }),
    );

    const staleVersionUpdateResponse = await requestJson(
      '/api/sync/push',
      {
        method: 'POST',
        body: JSON.stringify({
          schemaVersion: SYNC_SCHEMA_VERSION,
          changes: [
            {
              queueId: 'd125b784-6d75-429f-bfa1-04f0f491de14',
              entityType: 'work',
              entityId: workId,
              operation: 'update',
              createdAt: '2026-04-18T00:03:00.000Z',
              payload: buildSyncWorkPayload(workId, {
                title: 'Children of Dune',
                updatedAt: '2026-04-18T00:01:30.000Z',
                serverVersion: 1,
              }),
            },
          ],
        }),
      },
      user.accessToken,
    );

    expect(staleVersionUpdateResponse.status).toBe(200);
    expect(staleVersionUpdateResponse.body).toEqual(
      expect.objectContaining({
        results: [
          expect.objectContaining({
            status: 'conflict',
            code: 'conflict_remote_newer',
            work: expect.objectContaining({
              title: 'Dune Messiah',
              serverVersion: 2,
            }),
          }),
        ],
      }),
    );

    const pullResponse = await requestJson<{ nextSince: string }>(
      '/api/sync/pull',
      {
        method: 'POST',
        body: JSON.stringify({
          schemaVersion: SYNC_SCHEMA_VERSION,
          since: '2026-04-17T00:00:00.000Z',
        }),
      },
      user.accessToken,
    );

    expect(pullResponse.status).toBe(200);
    expect(pullResponse.body).toEqual(
      expect.objectContaining({
        nextSince: expect.any(String),
        changes: expect.arrayContaining([
          expect.objectContaining({
            entityId: workId,
            operation: 'upsert',
            work: expect.objectContaining({
              title: 'Dune Messiah',
              serverVersion: 2,
            }),
          }),
        ]),
      }),
    );

    const deleteResponse = await requestJson(
      '/api/sync/push',
      {
        method: 'POST',
        body: JSON.stringify({
          schemaVersion: SYNC_SCHEMA_VERSION,
          changes: [
            {
              queueId: '5188f5b1-1c80-49fd-ba6d-6848b8f0f6a3',
              entityType: 'work',
              entityId: workId,
              operation: 'delete',
              createdAt: '2026-04-18T00:04:00.000Z',
              payload: buildSyncWorkPayload(workId, {
                title: 'Dune Messiah',
                updatedAt: '2026-04-18T00:04:00.000Z',
                deletedAt: '2026-04-18T00:04:00.000Z',
                syncStatus: WorkSyncStatus.pending,
                serverVersion: 2,
              }),
            },
          ],
        }),
      },
      user.accessToken,
    );

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual(
      expect.objectContaining({
        results: [
          expect.objectContaining({
            status: 'applied',
            work: expect.objectContaining({
              deletedAt: '2026-04-18T00:04:00.000Z',
              serverVersion: 3,
            }),
          }),
        ],
      }),
    );

    const deletedRecord = await prisma.userWorkRecord.findUniqueOrThrow({
      where: {
        id: workId,
      },
    });

    expect(deletedRecord.deletedAt?.toISOString()).toBe(
      '2026-04-18T00:04:00.000Z',
    );
    expect(deletedRecord.serverVersion).toBe(3);

    const pullDeletedResponse = await requestJson(
      '/api/sync/pull',
      {
        method: 'POST',
        body: JSON.stringify({
          schemaVersion: SYNC_SCHEMA_VERSION,
          since: pullResponse.body!.nextSince,
        }),
      },
      user.accessToken,
    );

    expect(pullDeletedResponse.status).toBe(200);
    expect(pullDeletedResponse.body).toEqual(
      expect.objectContaining({
        changes: [
          expect.objectContaining({
            entityId: workId,
            operation: 'delete',
            work: expect.objectContaining({
              serverVersion: 3,
            }),
          }),
        ],
      }),
    );
  });

  it('encrypts provider credentials and restores readiness after delete', async () => {
    const user = await createAuthenticatedUser('credential-db@example.com');

    const saveResponse = await requestJson(
      '/api/imports/providers/aladin/key',
      {
        method: 'PUT',
        body: JSON.stringify({
          ttbKey: 'raw-aladin-ttb-key',
        }),
      },
      user.accessToken,
    );

    expect(saveResponse.status).toBe(200);
    expect(saveResponse.body).toEqual(
      expect.objectContaining({
        provider: 'aladin',
        configured: true,
      }),
    );

    const credential = await prisma.externalApiCredential.findUniqueOrThrow({
      where: {
        userId_provider: {
          userId: user.userId,
          provider: 'aladin',
        },
      },
    });

    expect(credential.encryptedKey).not.toContain('raw-aladin-ttb-key');

    const readinessResponse = await requestJson(
      '/api/imports/providers',
      undefined,
      user.accessToken,
    );

    expect(readinessResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'aladin',
          configured: true,
        }),
      ]),
    );

    const deleteResponse = await requestJson(
      '/api/imports/providers/aladin/key',
      {
        method: 'DELETE',
      },
      user.accessToken,
    );

    expect(deleteResponse.status).toBe(204);

    await expect(
      prisma.externalApiCredential.findUnique({
        where: {
          userId_provider: {
            userId: user.userId,
            provider: 'aladin',
          },
        },
      }),
    ).resolves.toBeNull();

    const readinessAfterDeleteResponse = await requestJson(
      '/api/imports/providers',
      undefined,
      user.accessToken,
    );

    expect(readinessAfterDeleteResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'aladin',
          configured: false,
        }),
      ]),
    );
  });
});
