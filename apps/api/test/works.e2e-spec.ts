import { type AddressInfo } from 'node:net';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { readApiRuntimeConfig } from '../src/config/api-runtime-config';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

function createPrismaServiceMock() {
  const users: Array<Record<string, unknown>> = [];
  const catalogWorks: Array<Record<string, unknown>> = [];
  const userWorkRecords: Array<Record<string, unknown>> = [];

  function buildServerVersion(
    currentVersion: number,
    nextVersionInput: unknown,
  ) {
    if (
      typeof nextVersionInput === 'object' &&
      nextVersionInput !== null &&
      'increment' in nextVersionInput
    ) {
      return currentVersion + Number((nextVersionInput as { increment: number }).increment);
    }

    return typeof nextVersionInput === 'number' ? nextVersionInput : currentVersion;
  }

  function getCatalogWorkById(id: string) {
    return catalogWorks.find((catalogWork) => catalogWork.id === id) ?? null;
  }

  function joinRecord(record: Record<string, unknown>) {
    return {
      ...record,
      catalogWork: getCatalogWorkById(record.catalogWorkId as string),
    };
  }

  const prismaMock: Record<string, unknown> = {};

  prismaMock.$transaction = async <T>(
    input: Promise<T>[] | ((client: typeof prismaMock) => Promise<T>),
  ) => {
    if (typeof input === 'function') {
      return input(prismaMock);
    }

    return Promise.all(input);
  };

  prismaMock.user = {
      findUnique: async ({
        where,
      }: {
        where: {
          email?: string;
          id?: string;
        };
      }) =>
        users.find((user) => {
          if (where.id && user.id !== where.id) {
            return false;
          }

          if (where.email && user.email !== where.email) {
            return false;
          }

          return true;
        }) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date();
        const user = {
          id: data.id ?? crypto.randomUUID(),
          email: data.email,
          passwordHash: data.passwordHash,
          refreshTokenHash: data.refreshTokenHash ?? null,
          nickname: data.nickname ?? '',
          createdAt: now,
          updatedAt: now,
        };

        users.push(user);

        return user;
      },
      update: async ({
        where,
        data,
      }: {
        where: {
          id: string;
        };
        data: Record<string, unknown>;
      }) => {
        const index = users.findIndex((user) => user.id === where.id);

        if (index === -1) {
          throw new Error('user not found');
        }

        const updatedUser = {
          ...users[index],
          ...data,
          updatedAt: new Date(),
        };

        users[index] = updatedUser;

        return updatedUser;
      },
    };
  prismaMock.catalogWork = {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date();
        const catalogWork = {
          id: data.id ?? crypto.randomUUID(),
          type: data.type ?? WorkType.novel,
          title: data.title,
          author: data.author ?? '',
          genres: data.genres ?? [],
          description: data.description ?? '',
          thumbnailUrl: data.thumbnailUrl ?? '',
          createdAt: data.createdAt ?? now,
          updatedAt: data.updatedAt ?? now,
        };

        catalogWorks.push(catalogWork);

        return catalogWork;
      },
      update: async ({
        where,
        data,
      }: {
        where: {
          id: string;
        };
        data: Record<string, unknown>;
      }) => {
        const index = catalogWorks.findIndex(
          (catalogWork) => catalogWork.id === where.id,
        );

        if (index === -1) {
          throw new Error('catalog work not found');
        }

        const updatedCatalogWork = {
          ...catalogWorks[index],
          ...data,
          updatedAt: data.updatedAt ?? new Date(),
        };

        catalogWorks[index] = updatedCatalogWork;

        return updatedCatalogWork;
      },
    };
  prismaMock.userWorkRecord = {
      findMany: async ({
        where,
        orderBy,
      }: {
        where?: {
          deletedAt?: null;
          updatedAt?: {
            gt: Date;
          };
          userId?: string;
        };
        orderBy?: {
          updatedAt: 'asc' | 'desc';
        };
      } = {}) =>
        [...userWorkRecords]
          .filter((record) => {
            if (where?.userId && record.userId !== where.userId) {
              return false;
            }

            if (where?.deletedAt === null && record.deletedAt !== null) {
              return false;
            }

            if (
              where?.updatedAt?.gt &&
              new Date(record.updatedAt as Date).getTime() <=
                where.updatedAt.gt.getTime()
            ) {
              return false;
            }

            return true;
          })
          .sort((left, right) => {
            const delta =
              new Date(right.updatedAt as Date).getTime() -
              new Date(left.updatedAt as Date).getTime();

            return orderBy?.updatedAt === 'asc' ? -delta : delta;
          })
          .map((record) => joinRecord(record)),
      findUnique: async ({
        where,
      }: {
        where: {
          id: string;
        };
      }) => {
        const record = userWorkRecords.find((work) => work.id === where.id) ?? null;

        return record ? joinRecord(record) : null;
      },
      findFirst: async ({
        where,
      }: {
        where: {
          deletedAt?: null;
          id?: string;
          userId?: string;
        };
      }) => {
        const record =
          userWorkRecords.find((work) => {
            if (where.id && work.id !== where.id) {
              return false;
            }

            if (where.userId && work.userId !== where.userId) {
              return false;
            }

            if (where.deletedAt === null && work.deletedAt !== null) {
              return false;
            }

            return true;
          }) ?? null;

        return record ? joinRecord(record) : null;
      },
      create: async ({
        data,
      }: {
        data: Record<string, unknown>;
      }) => {
        const now = new Date();
        const record = {
          id: data.id ?? crypto.randomUUID(),
          userId: data.userId ?? null,
          catalogWorkId: data.catalogWorkId,
          status: data.status ?? WorkStatus.planned,
          rating: data.rating ?? null,
          shortReview: data.shortReview ?? '',
          review: data.review ?? '',
          tier: data.tier ?? null,
          favorite: data.favorite ?? false,
          createdAt: data.createdAt ?? now,
          updatedAt: data.updatedAt ?? now,
          deletedAt: data.deletedAt ?? null,
          syncStatus: data.syncStatus ?? WorkSyncStatus.synced,
          serverVersion: data.serverVersion ?? 1,
        };

        userWorkRecords.push(record);

        return joinRecord(record);
      },
      update: async ({
        where,
        data,
      }: {
        where: {
          id: string;
        };
        data: Record<string, unknown>;
      }) => {
        const index = userWorkRecords.findIndex((record) => record.id === where.id);

        if (index === -1) {
          throw new Error('user work record not found');
        }

        const current = userWorkRecords[index]!;
        const updatedRecord = {
          ...current,
          ...data,
          serverVersion: buildServerVersion(
            Number(current.serverVersion),
            data.serverVersion,
          ),
          updatedAt: data.updatedAt ?? new Date(),
        };

        userWorkRecords[index] = updatedRecord;

        return joinRecord(updatedRecord);
      },
    };

  return prismaMock;
}

describe('Auth, works, and sync API (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let cookieJar: string | null;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaServiceMock())
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app, readApiRuntimeConfig());
    await app.listen(0);
    cookieJar = null;

    const address = app.getHttpServer().address() as AddressInfo;

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await app.close();
  });

  async function requestJson(
    path: string,
    init?: RequestInit,
    accessToken?: string,
  ): Promise<{
    body: unknown;
    status: number;
  }> {
    const headers = new Headers(init?.headers);

    headers.set('content-type', 'application/json');

    if (!headers.has('cookie') && cookieJar) {
      headers.set('cookie', cookieJar);
    }

    if (accessToken) {
      headers.set('authorization', `Bearer ${accessToken}`);
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });
    const nextCookie = response.headers.get('set-cookie');

    if (nextCookie) {
      cookieJar = nextCookie.split(';')[0] ?? null;
    }

    const body = response.status === 204 ? null : await response.json();

    return {
      body,
      status: response.status,
    };
  }

  async function registerUser(email: string) {
    const response = await requestJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: 'strong-password-123',
      }),
    });

    expect(response.status).toBe(201);

    return response.body as {
      accessToken: string;
      user: {
        email: string;
        id: string;
      };
    };
  }

  it('keeps health public and supports register, login, refresh, and /auth/me', async () => {
    const healthResponse = await fetch(`${baseUrl}/health`);

    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toEqual({
      service: 'work-archive-api',
      status: 'ok',
    });

    const registerResponse = await registerUser('frieren@example.com');

    expect(registerResponse.user).toEqual(
      expect.objectContaining({
        email: 'frieren@example.com',
        id: expect.any(String),
      }),
    );
    expect(registerResponse.accessToken).toEqual(expect.any(String));

    const loginResponse = await requestJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'frieren@example.com',
        password: 'strong-password-123',
      }),
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        user: expect.objectContaining({
          email: 'frieren@example.com',
        }),
      }),
    );

    const session = loginResponse.body as {
      accessToken: string;
    };
    const staleRefreshCookie = cookieJar;
    const meResponse = await requestJson('/api/auth/me', undefined, session.accessToken);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body).toEqual(
      expect.objectContaining({
        email: 'frieren@example.com',
      }),
    );

    const refreshResponse = await requestJson('/api/auth/refresh', {
      method: 'POST',
    });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        user: expect.objectContaining({
          email: 'frieren@example.com',
        }),
      }),
    );

    const staleRefreshResponse = await requestJson('/api/auth/refresh', {
      method: 'POST',
      ...(staleRefreshCookie
        ? {
            headers: {
              cookie: staleRefreshCookie,
            },
          }
        : {}),
    });

    expect(staleRefreshResponse.status).toBe(401);
  });

  it('protects works and sync routes when no access token is provided', async () => {
    await expect(requestJson('/api/works')).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );

    await expect(
      requestJson('/api/works', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Dune',
        }),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );

    await expect(
      requestJson('/api/sync/pull', {
        method: 'POST',
        body: JSON.stringify({
          since: null,
        }),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );
  });

  it('returns only the current user records from works routes', async () => {
    const firstUser = await registerUser('frieren@example.com');
    const secondUser = await registerUser('fern@example.com');

    const createResponse = await requestJson(
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
          shortReview: ' Quiet and precise. ',
          favorite: true,
        }),
      },
      firstUser.accessToken,
    );

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: WorkType.anime,
        title: "Frieren: Beyond Journey's End",
        author: 'Kanehito Yamada',
        genres: ['Fantasy', 'Drama'],
        syncStatus: 'synced',
        serverVersion: 1,
      }),
    );

    const workId = (createResponse.body as { id: string }).id;
    const firstUserList = await requestJson('/api/works', undefined, firstUser.accessToken);
    const secondUserList = await requestJson('/api/works', undefined, secondUser.accessToken);

    expect(firstUserList.status).toBe(200);
    expect(firstUserList.body).toEqual([
      expect.objectContaining({
        id: workId,
      }),
    ]);
    expect(secondUserList.status).toBe(200);
    expect(secondUserList.body).toEqual([]);

    const secondUserDetail = await requestJson(
      `/api/works/${workId}`,
      undefined,
      secondUser.accessToken,
    );

    expect(secondUserDetail.status).toBe(404);

    const deleteResponse = await requestJson(
      `/api/works/${workId}`,
      {
        method: 'DELETE',
      },
      firstUser.accessToken,
    );

    expect(deleteResponse.status).toBe(204);

    const deletedDetail = await requestJson(
      `/api/works/${workId}`,
      undefined,
      firstUser.accessToken,
    );

    expect(deletedDetail.status).toBe(404);
  });

  it('supports authenticated push and pull sync with user scoping and conflicts', async () => {
    const firstUser = await registerUser('frieren@example.com');
    const secondUser = await registerUser('fern@example.com');
    const workId = '3f831224-abf9-44c3-b3f9-9ff4da2f7de8';

    const pushCreateResponse = await requestJson(
      '/api/sync/push',
      {
        method: 'POST',
        body: JSON.stringify({
          changes: [
            {
              queueId: '6a8f8eb6-8317-4e8a-b8e7-530c5cc1db4d',
              entityType: 'work',
              entityId: workId,
              operation: 'create',
              createdAt: '2026-04-18T00:00:00.000Z',
              payload: {
                id: workId,
                type: WorkType.novel,
                title: 'Dune',
                author: 'Frank Herbert',
                genres: ['Science Fiction'],
                description: '',
                thumbnailUrl: '',
                status: WorkStatus.completed,
                rating: 5,
                shortReview: '',
                review: '',
                tier: null,
                favorite: false,
                createdAt: '2026-04-18T00:00:00.000Z',
                updatedAt: '2026-04-18T00:00:00.000Z',
                deletedAt: null,
                syncStatus: 'local-only',
                serverVersion: 0,
              },
            },
          ],
        }),
      },
      firstUser.accessToken,
    );

    expect(pushCreateResponse.status).toBe(200);
    expect(pushCreateResponse.body).toEqual(
      expect.objectContaining({
        results: [
          expect.objectContaining({
            status: 'applied',
            entityId: workId,
            work: expect.objectContaining({
              title: 'Dune',
              syncStatus: 'synced',
              serverVersion: 1,
            }),
          }),
        ],
      }),
    );

    const secondUserPull = await requestJson(
      '/api/sync/pull',
      {
        method: 'POST',
        body: JSON.stringify({
          since: '2026-04-17T00:00:00.000Z',
        }),
      },
      secondUser.accessToken,
    );

    expect(secondUserPull.status).toBe(200);
    expect(secondUserPull.body).toEqual(
      expect.objectContaining({
        changes: [],
      }),
    );

    const serverUpdateResponse = await requestJson(
      `/api/works/${workId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Dune Messiah',
        }),
      },
      firstUser.accessToken,
    );

    expect(serverUpdateResponse.status).toBe(200);

    const pullResponse = await requestJson(
      '/api/sync/pull',
      {
        method: 'POST',
        body: JSON.stringify({
          since: '2026-04-17T00:00:00.000Z',
        }),
      },
      firstUser.accessToken,
    );

    expect(pullResponse.status).toBe(200);
    expect(pullResponse.body).toEqual(
      expect.objectContaining({
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

    const conflictResponse = await requestJson(
      '/api/sync/push',
      {
        method: 'POST',
        body: JSON.stringify({
          changes: [
            {
              queueId: 'd125b784-6d75-429f-bfa1-04f0f491de14',
              entityType: 'work',
              entityId: workId,
              operation: 'update',
              createdAt: '2026-04-18T00:05:00.000Z',
              payload: {
                id: workId,
                type: WorkType.novel,
                title: 'Children of Dune',
                author: 'Frank Herbert',
                genres: ['Science Fiction'],
                description: '',
                thumbnailUrl: '',
                status: WorkStatus.completed,
                rating: 5,
                shortReview: '',
                review: '',
                tier: null,
                favorite: false,
                createdAt: '2026-04-18T00:00:00.000Z',
                updatedAt: '2026-04-18T00:05:00.000Z',
                deletedAt: null,
                syncStatus: 'pending',
                serverVersion: 1,
              },
            },
          ],
        }),
      },
      firstUser.accessToken,
    );

    expect(conflictResponse.status).toBe(200);
    expect(conflictResponse.body).toEqual(
      expect.objectContaining({
        results: [
          expect.objectContaining({
            status: 'conflict',
            message: expect.stringContaining('server version 2'),
          }),
        ],
      }),
    );
  });

  it('validates auth and works payloads with DTO errors', async () => {
    const invalidRegisterResponse = await requestJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'short',
      }),
    });

    expect(invalidRegisterResponse.status).toBe(400);
    expect(
      (invalidRegisterResponse.body as { message: string[] }).message,
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('email'),
        expect.stringContaining('password'),
      ]),
    );

    const session = await registerUser('frieren@example.com');
    const minimalCreateResponse = await requestJson(
      '/api/works',
      {
        method: 'POST',
        body: JSON.stringify({
          title: '  Only Required Title  ',
        }),
      },
      session.accessToken,
    );

    expect(minimalCreateResponse.status).toBe(201);
    expect(minimalCreateResponse.body).toEqual(
      expect.objectContaining({
        title: 'Only Required Title',
        type: WorkType.novel,
        author: '',
        genres: [],
        status: WorkStatus.planned,
        rating: null,
        tier: null,
        favorite: false,
        syncStatus: 'synced',
      }),
    );

    const workId = (minimalCreateResponse.body as { id: string }).id;
    const invalidUpdateResponse = await requestJson(
      `/api/works/${workId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          rating: '4',
          tier: 'Z',
          genres: 'Drama',
        }),
      },
      session.accessToken,
    );

    expect(invalidUpdateResponse.status).toBe(400);
    expect(
      (invalidUpdateResponse.body as { message: string[] }).message,
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('rating'),
        expect.stringContaining('tier'),
        expect.stringContaining('genres'),
      ]),
    );
  });
});
