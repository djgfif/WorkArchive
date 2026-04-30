import { type AddressInfo } from 'node:net';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { readApiRuntimeConfig } from '../src/config/api-runtime-config';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

function createPrismaServiceMock() {
  const users: Array<Record<string, unknown>> = [];
  const catalogWorks: Array<Record<string, unknown>> = [];
  const catalogTitles: Array<Record<string, unknown>> = [];
  const catalogExternalRefs: Array<Record<string, unknown>> = [];
  const userWorkRecords: Array<Record<string, unknown>> = [];
  const userReleaseRecords: Array<Record<string, unknown>> = [];
  const externalApiCredentials: Array<Record<string, unknown>> = [];

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

  function getCatalogTitleById(id: string | null | undefined) {
    if (!id) {
      return null;
    }

    return catalogTitles.find((catalogTitle) => catalogTitle.id === id) ?? null;
  }

  function getSortDirections(orderBy: unknown) {
    let updatedAtDirection: 'asc' | 'desc' = 'desc';
    let idDirection: 'asc' | 'desc' = 'desc';

    if (Array.isArray(orderBy)) {
      for (const entry of orderBy) {
        if (
          entry &&
          typeof entry === 'object' &&
          'updatedAt' in entry &&
          (entry.updatedAt === 'asc' || entry.updatedAt === 'desc')
        ) {
          updatedAtDirection = entry.updatedAt;
        }

        if (
          entry &&
          typeof entry === 'object' &&
          'id' in entry &&
          (entry.id === 'asc' || entry.id === 'desc')
        ) {
          idDirection = entry.id;
        }
      }

      return {
        idDirection,
        updatedAtDirection,
      };
    }

    if (
      orderBy &&
      typeof orderBy === 'object' &&
      'updatedAt' in orderBy &&
      (orderBy.updatedAt === 'asc' || orderBy.updatedAt === 'desc')
    ) {
      updatedAtDirection = orderBy.updatedAt;
    }

    if (
      orderBy &&
      typeof orderBy === 'object' &&
      'id' in orderBy &&
      (orderBy.id === 'asc' || orderBy.id === 'desc')
    ) {
      idDirection = orderBy.id;
    }

    return {
      idDirection,
      updatedAtDirection,
    };
  }

  function joinRecord(record: Record<string, unknown>) {
    return {
      ...record,
      catalogWork: getCatalogWorkById(record.catalogWorkId as string),
      catalogTitle: getCatalogTitleById(record.catalogTitleId as string | null),
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
  prismaMock.catalogTitle = {
      upsert: async ({
        create,
        update,
        where,
      }: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
        where: {
          id: string;
        };
      }) => {
        const index = catalogTitles.findIndex((title) => title.id === where.id);
        const now = new Date();

        if (index >= 0) {
          const updatedTitle = {
            ...catalogTitles[index],
            ...update,
            updatedAt: update.updatedAt ?? now,
          };

          catalogTitles[index] = updatedTitle;

          return updatedTitle;
        }

        const title = {
          id: create.id ?? where.id,
          franchiseId: create.franchiseId ?? null,
          mediumType: create.mediumType ?? WorkType.other,
          subType: create.subType ?? null,
          canonicalTitle: create.canonicalTitle,
          displayTitle: create.displayTitle,
          originalTitle: create.originalTitle ?? null,
          aliases: create.aliases ?? [],
          releaseYear: create.releaseYear ?? null,
          startDate: create.startDate ?? null,
          endDate: create.endDate ?? null,
          country: create.country ?? null,
          status: create.status ?? 'unknown',
          summary: create.summary ?? '',
          thumbnailUrl: create.thumbnailUrl ?? '',
          verificationStatus: create.verificationStatus ?? 'draft',
          createdAt: create.createdAt ?? now,
          updatedAt: create.updatedAt ?? now,
          franchise: null,
          contributors: [],
          outgoingRelations: [],
          externalRefs: [],
        };

        catalogTitles.push(title);

        return title;
      },
      findFirst: async ({
        where,
        select,
      }: {
        where?: {
          displayTitle?: {
            equals: string;
            mode?: string;
          };
          mediumType?: WorkType;
        };
        select?: Record<string, boolean>;
      } = {}) => {
        const title =
          catalogTitles.find((catalogTitle) => {
            if (
              where?.mediumType &&
              catalogTitle.mediumType !== where.mediumType
            ) {
              return false;
            }

            if (where?.displayTitle?.equals) {
              const expected = where.displayTitle.equals.toLowerCase();
              const actual = String(catalogTitle.displayTitle).toLowerCase();

              if (actual !== expected) {
                return false;
              }
            }

            return true;
          }) ?? null;

        if (!title || !select) {
          return title;
        }

        return Object.fromEntries(
          Object.entries(select)
            .filter(([, enabled]) => enabled)
            .map(([key]) => [key, title[key]]),
        );
      },
      findMany: async ({
        where,
      }: {
        where?: {
          franchiseId?: string;
          mediumType?: WorkType;
          verificationStatus?: {
            not?: string;
          };
        };
      } = {}) =>
        catalogTitles.filter((catalogTitle) => {
          if (where?.franchiseId && catalogTitle.franchiseId !== where.franchiseId) {
            return false;
          }

          if (where?.mediumType && catalogTitle.mediumType !== where.mediumType) {
            return false;
          }

          if (
            where?.verificationStatus?.not &&
            catalogTitle.verificationStatus === where.verificationStatus.not
          ) {
            return false;
          }

          return true;
        }),
      findUnique: async ({
        where,
      }: {
        where: {
          id: string;
        };
      }) => getCatalogTitleById(where.id),
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
        orderBy?:
          | {
              id?: 'asc' | 'desc';
              updatedAt?: 'asc' | 'desc';
            }
          | Array<{
              id?: 'asc' | 'desc';
              updatedAt?: 'asc' | 'desc';
            }>;
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
            const { idDirection, updatedAtDirection } = getSortDirections(orderBy);
            const updatedAtDelta =
              new Date(left.updatedAt as Date).getTime() -
              new Date(right.updatedAt as Date).getTime();

            if (updatedAtDelta !== 0) {
              return updatedAtDirection === 'asc' ? updatedAtDelta : -updatedAtDelta;
            }

            const idDelta = String(left.id).localeCompare(String(right.id));

            return idDirection === 'asc' ? idDelta : -idDelta;
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
          catalogTitleId: data.catalogTitleId ?? null,
          status: data.status ?? WorkStatus.planned,
          rating: data.rating ?? null,
          shortReview: data.shortReview ?? '',
          review: data.review ?? '',
          tier: data.tier ?? null,
          favorite: data.favorite ?? false,
          progressCurrent: data.progressCurrent ?? null,
          progressTotal: data.progressTotal ?? null,
          progressUnit: data.progressUnit ?? null,
          lastConsumedLabel: data.lastConsumedLabel ?? null,
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
  prismaMock.catalogExternalRef = {
      findUnique: async ({
        include,
        where,
      }: {
        include?: {
          catalogTitle?: boolean;
        };
        where: {
          provider_rawType_externalId: {
            externalId: string;
            provider: string;
            rawType: string;
          };
        };
      }) => {
        const ref =
          catalogExternalRefs.find(
            (externalRef) =>
              externalRef.externalId ===
                where.provider_rawType_externalId.externalId &&
              externalRef.provider ===
                where.provider_rawType_externalId.provider &&
              externalRef.rawType ===
                where.provider_rawType_externalId.rawType,
          ) ?? null;

        if (!ref || !include?.catalogTitle) {
          return ref;
        }

        return {
          ...ref,
          catalogTitle: getCatalogTitleById(ref.catalogTitleId as string | null),
        };
      },
      upsert: async ({
        create,
        update,
        where,
      }: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
        where: {
          provider_rawType_externalId: {
            externalId: string;
            provider: string;
            rawType: string;
          };
        };
      }) => {
        const index = catalogExternalRefs.findIndex(
          (externalRef) =>
            externalRef.externalId ===
              where.provider_rawType_externalId.externalId &&
            externalRef.provider === where.provider_rawType_externalId.provider &&
            externalRef.rawType === where.provider_rawType_externalId.rawType,
        );
        const now = new Date();

        if (index >= 0) {
          const updatedRef = {
            ...catalogExternalRefs[index],
            ...update,
            updatedAt: now,
          };

          catalogExternalRefs[index] = updatedRef;

          return updatedRef;
        }

        const ref = {
          id: create.id ?? crypto.randomUUID(),
          catalogTitleId: create.catalogTitleId ?? null,
          catalogReleaseId: create.catalogReleaseId ?? null,
          franchiseId: create.franchiseId ?? null,
          contributorId: create.contributorId ?? null,
          provider: create.provider,
          externalId: create.externalId,
          url: create.url ?? '',
          rawType: create.rawType ?? '',
          language: create.language ?? null,
          country: create.country ?? null,
          confidence: create.confidence ?? null,
          lastFetchedAt: create.lastFetchedAt ?? null,
          createdAt: now,
          updatedAt: now,
        };

        catalogExternalRefs.push(ref);

        return ref;
      },
    };
  prismaMock.userReleaseRecord = {
      findMany: async ({
        where,
      }: {
        where?: {
          updatedAt?: {
            gt: Date;
          };
          userWorkRecord?: {
            userId?: string;
          };
        };
      } = {}) =>
        userReleaseRecords.filter((record) => {
          if (where?.userWorkRecord?.userId) {
            const parent = userWorkRecords.find(
              (workRecord) => workRecord.id === record.userWorkRecordId,
            );

            if (parent?.userId !== where.userWorkRecord.userId) {
              return false;
            }
          }

          if (
            where?.updatedAt?.gt &&
            new Date(record.updatedAt as Date).getTime() <=
              where.updatedAt.gt.getTime()
          ) {
            return false;
          }

          return true;
        }),
    };
  prismaMock.externalApiCredential = {
      findUnique: async ({
        where,
      }: {
        where: {
          userId_provider: {
            provider: string;
            userId: string;
          };
        };
      }) =>
        externalApiCredentials.find(
          (credential) =>
            credential.userId === where.userId_provider.userId &&
            credential.provider === where.userId_provider.provider,
        ) ?? null,
      upsert: async ({
        create,
        update,
        where,
      }: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
        where: {
          userId_provider: {
            provider: string;
            userId: string;
          };
        };
      }) => {
        const index = externalApiCredentials.findIndex(
          (credential) =>
            credential.userId === where.userId_provider.userId &&
            credential.provider === where.userId_provider.provider,
        );
        const now = new Date();

        if (index >= 0) {
          const updatedCredential = {
            ...externalApiCredentials[index],
            ...update,
            updatedAt: now,
          };

          externalApiCredentials[index] = updatedCredential;

          return updatedCredential;
        }

        const credential = {
          id: create.id ?? crypto.randomUUID(),
          userId: create.userId,
          provider: create.provider,
          encryptedKey: create.encryptedKey,
          iv: create.iv,
          authTag: create.authTag,
          createdAt: now,
          updatedAt: now,
        };

        externalApiCredentials.push(credential);

        return credential;
      },
      deleteMany: async ({
        where,
      }: {
        where: {
          provider: string;
          userId: string;
        };
      }) => {
        const nextCredentials = externalApiCredentials.filter(
          (credential) =>
            credential.userId !== where.userId ||
            credential.provider !== where.provider,
        );
        const count = externalApiCredentials.length - nextCredentials.length;

        externalApiCredentials.splice(
          0,
          externalApiCredentials.length,
          ...nextCredentials,
        );

        return {
          count,
        };
      },
    };

  return prismaMock;
}

describe('Auth, works, and sync API (e2e)', () => {
  const REFRESH_TOKEN_COOKIE_NAME = 'work_archive_refresh_token';
  let app: INestApplication;
  let baseUrl: string;
  let cookieJar: string | null;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.EXTERNAL_API_KEY_ENCRYPTION_SECRET =
      'test-external-api-key-encryption-secret';

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
    jest.restoreAllMocks();
    await app.close();
  });

  async function requestJson(
    path: string,
    init?: RequestInit,
    accessToken?: string,
  ): Promise<{
    body: unknown;
    setCookie: string | null;
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
      setCookie: nextCookie,
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

  function getFetchInputUrl(input: Parameters<typeof fetch>[0]) {
    if (typeof input === 'string') {
      return input;
    }

    if (input instanceof URL) {
      return input.toString();
    }

    return input.url;
  }

  function mockAladinResponse(body: unknown, status = 200) {
    const realFetch = globalThis.fetch.bind(globalThis);

    jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (getFetchInputUrl(input).includes('aladin.co.kr')) {
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status,
            headers: {
              'content-type': 'application/json',
            },
          }),
        );
      }

      return realFetch(input, init);
    });
  }

  function buildSyncPayload(
    workId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
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
      syncStatus: 'pending',
      serverVersion: 1,
      ...overrides,
    };
  }

  it('keeps health public and supports register, login, refresh, stale refresh rejection, and /auth/me', async () => {
    const healthResponse = await fetch(`${baseUrl}/health`);

    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toEqual({
      service: 'work-archive-api',
      status: 'ok',
    });

    const registerResponse = await requestJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'frieren@example.com',
        password: 'strong-password-123',
      }),
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.setCookie).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=`);
    expect(registerResponse.body).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        user: expect.objectContaining({
          email: 'frieren@example.com',
          id: expect.any(String),
        }),
      }),
    );

    const loginResponse = await requestJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'frieren@example.com',
        password: 'strong-password-123',
      }),
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.setCookie).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=`);
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
    const meResponse = await requestJson(
      '/api/auth/me',
      undefined,
      session.accessToken,
    );

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
    expect(refreshResponse.setCookie).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=`);
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

    const missingRefreshResponse = await requestJson('/api/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: '',
      },
    });

    expect(missingRefreshResponse.status).toBe(401);
  });

  it('logs out cleanly and rejects refresh attempts after logout', async () => {
    const session = await registerUser('logout@example.com');

    const logoutResponse = await requestJson(
      '/api/auth/logout',
      {
        method: 'POST',
      },
      session.accessToken,
    );

    expect(logoutResponse.status).toBe(204);
    expect(logoutResponse.setCookie).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=;`);

    const refreshAfterLogoutResponse = await requestJson('/api/auth/refresh', {
      method: 'POST',
    });

    expect(refreshAfterLogoutResponse.status).toBe(401);
  });

  it('protects auth, works, and sync routes when authentication is missing', async () => {
    await expect(requestJson('/api/auth/me')).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );

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

    await expect(requestJson('/api/imports/providers/aladin/status')).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );

    await expect(
      requestJson('/api/imports/providers/aladin/key', {
        method: 'PUT',
        body: JSON.stringify({
          ttbKey: 'test-ttb-key',
        }),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );

    await expect(
      requestJson('/api/imports/providers/aladin/key', {
        method: 'DELETE',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );
  });

  it('supports authenticated Aladin key settings and import search without creating works', async () => {
    const session = await registerUser('imports@example.com');
    const statusBeforeSave = await requestJson(
      '/api/imports/providers/aladin/status',
      undefined,
      session.accessToken,
    );

    expect(statusBeforeSave.status).toBe(200);
    expect(statusBeforeSave.body).toEqual({
      provider: 'aladin',
      configured: false,
    });

    const blankKeyResponse = await requestJson(
      '/api/imports/providers/aladin/key',
      {
        method: 'PUT',
        body: JSON.stringify({
          ttbKey: '   ',
        }),
      },
      session.accessToken,
    );

    expect(blankKeyResponse.status).toBe(400);

    const saveKeyResponse = await requestJson(
      '/api/imports/providers/aladin/key',
      {
        method: 'PUT',
        body: JSON.stringify({
          ttbKey: '  test-ttb-key  ',
        }),
      },
      session.accessToken,
    );

    expect(saveKeyResponse.status).toBe(200);
    expect(saveKeyResponse.body).toEqual({
      provider: 'aladin',
      configured: true,
    });

    const providerReadinessResponse = await requestJson(
      '/api/imports/providers',
      undefined,
      session.accessToken,
    );

    expect(providerReadinessResponse.status).toBe(200);
    expect(providerReadinessResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'aladin',
          credentialMode: 'user',
          configured: true,
        }),
        expect.objectContaining({
          provider: 'manual',
          credentialMode: 'none',
          configured: true,
        }),
      ]),
    );

    mockAladinResponse({
      item: [
        {
          itemId: 123,
          title: '듄',
          author: '프랭크 허버트',
          description: '사막 행성을 둘러싼 이야기',
          cover: 'https://image.aladin.co.kr/cover.jpg',
          categoryName: '국내도서>소설/시/희곡>영미소설',
          publisher: '황금가지',
          pubDate: '2026-04-18',
          link: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=123',
        },
      ],
    });

    const searchResponse = await requestJson(
      '/api/imports/search?provider=aladin&query=%EB%93%84&type=novel&limit=10',
      undefined,
      session.accessToken,
    );

    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body).toEqual({
      provider: 'aladin',
      providers: ['aladin'],
      query: '듄',
      candidates: [
        expect.objectContaining({
          id: 'aladin:123',
          externalId: '123',
          sourceId: 'aladin',
          sourceLabel: 'Aladin Book',
          title: '듄',
          author: '프랭크 허버트',
          type: 'novel',
          thumbnailUrl: 'https://image.aladin.co.kr/cover.jpg',
          note: '도서 DB 제공: 알라딘 인터넷서점(www.aladin.co.kr)',
          sourceUrl: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=123',
        }),
      ],
    });

    const deleteKeyResponse = await requestJson(
      '/api/imports/providers/aladin/key',
      {
        method: 'DELETE',
      },
      session.accessToken,
    );

    expect(deleteKeyResponse.status).toBe(204);

    const searchAfterDeleteResponse = await requestJson(
      '/api/imports/search?provider=aladin&query=Dune&type=novel',
      undefined,
      session.accessToken,
    );

    expect(searchAfterDeleteResponse.status).toBe(403);
  });

  it('allows guest import search only for no-user-key providers', async () => {
    const providersResponse = await requestJson('/api/imports/providers');

    expect(providersResponse.status).toBe(200);
    expect(providersResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'manual',
          credentialMode: 'none',
          configured: true,
        }),
        expect.objectContaining({
          provider: 'aladin',
          credentialMode: 'user',
          configured: false,
        }),
        expect.objectContaining({
          provider: 'tmdb',
          credentialMode: 'user',
          configured: false,
        }),
      ]),
    );

    const manualSearchResponse = await requestJson(
      '/api/imports/search?provider=manual&query=Dune&type=novel&limit=5',
    );

    expect(manualSearchResponse.status).toBe(200);
    expect(manualSearchResponse.body).toEqual(
      expect.objectContaining({
        provider: 'manual',
        providers: ['manual'],
        query: 'Dune',
        candidates: [
          expect.objectContaining({
            sourceId: 'manual',
            title: 'Dune',
            type: 'novel',
            catalogMatch: null,
            existingRecord: null,
          }),
        ],
      }),
    );

    const aladinGuestResponse = await requestJson(
      '/api/imports/search?provider=aladin&query=Dune&type=novel',
    );

    expect(aladinGuestResponse.status).toBe(401);

    const tmdbGuestResponse = await requestJson(
      '/api/imports/search?provider=tmdb&query=Dune&type=movie',
    );

    expect(tmdbGuestResponse.status).toBe(403);
  });

  it('rejects malformed optional import authorization headers', async () => {
    const providersResponse = await requestJson('/api/imports/providers', {
      headers: {
        authorization: 'Basic invalid-token',
      },
    });

    expect(providersResponse.status).toBe(401);

    const searchResponse = await requestJson(
      '/api/imports/search?provider=manual&query=Dune&type=novel',
      {
        headers: {
          authorization: 'Bearer',
        },
      },
    );

    expect(searchResponse.status).toBe(401);
  });

  it('supports works CRUD with user scoping, soft delete, and ownership protection', async () => {
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
    const ownerDetail = await requestJson(
      `/api/works/${workId}`,
      undefined,
      firstUser.accessToken,
    );

    expect(ownerDetail.status).toBe(200);
    expect(ownerDetail.body).toEqual(
      expect.objectContaining({
        id: workId,
        title: "Frieren: Beyond Journey's End",
      }),
    );

    const updateResponse = await requestJson(
      `/api/works/${workId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Frieren',
          favorite: false,
        }),
      },
      firstUser.accessToken,
    );

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toEqual(
      expect.objectContaining({
        id: workId,
        title: 'Frieren',
        favorite: false,
        serverVersion: 2,
      }),
    );

    const firstUserList = await requestJson(
      '/api/works',
      undefined,
      firstUser.accessToken,
    );
    const secondUserList = await requestJson(
      '/api/works',
      undefined,
      secondUser.accessToken,
    );

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

    expect(secondUserDetail.status).toBe(404);
    expect(secondUserUpdate.status).toBe(404);
    expect(secondUserDelete.status).toBe(404);

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
    const listAfterDelete = await requestJson(
      '/api/works',
      undefined,
      firstUser.accessToken,
    );

    expect(deletedDetail.status).toBe(404);
    expect(listAfterDelete.status).toBe(200);
    expect(listAfterDelete.body).toEqual([]);
  });

  it('supports authenticated push and pull sync with create, update, delete, duplicate no-op, and conflict handling', async () => {
    const firstUser = await registerUser('sync-owner@example.com');
    const secondUser = await registerUser('sync-other@example.com');
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
              payload: buildSyncPayload(workId, {
                syncStatus: 'local-only',
                serverVersion: 0,
              }),
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

    const duplicateCreateResponse = await requestJson(
      '/api/sync/push',
      {
        method: 'POST',
        body: JSON.stringify({
          changes: [
            {
              queueId: '8bde1974-11bb-4b66-b2f7-273a4e0a3575',
              entityType: 'work',
              entityId: workId,
              operation: 'create',
              createdAt: '2026-04-18T00:01:00.000Z',
              payload: buildSyncPayload(workId, {
                syncStatus: 'local-only',
                serverVersion: 0,
              }),
            },
          ],
        }),
      },
      firstUser.accessToken,
    );

    expect(duplicateCreateResponse.status).toBe(200);
    expect(duplicateCreateResponse.body).toEqual(
      expect.objectContaining({
        results: [
          expect.objectContaining({
            status: 'applied',
            message: 'Remote record already matches the queued change.',
            work: expect.objectContaining({
              serverVersion: 1,
            }),
          }),
        ],
      }),
    );

    const pushUpdateResponse = await requestJson(
      '/api/sync/push',
      {
        method: 'POST',
        body: JSON.stringify({
          changes: [
            {
              queueId: 'ea483856-fafc-4aa9-ac6f-925f9c34d5ea',
              entityType: 'work',
              entityId: workId,
              operation: 'update',
              createdAt: '2026-04-18T00:02:00.000Z',
              payload: buildSyncPayload(workId, {
                title: 'Dune Messiah',
                updatedAt: '2026-04-18T00:02:00.000Z',
                serverVersion: 1,
              }),
            },
          ],
        }),
      },
      firstUser.accessToken,
    );

    expect(pushUpdateResponse.status).toBe(200);
    expect(pushUpdateResponse.body).toEqual(
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
              createdAt: '2026-04-18T00:03:00.000Z',
              payload: buildSyncPayload(workId, {
                title: 'Children of Dune',
                updatedAt: '2026-04-18T00:01:30.000Z',
                serverVersion: 1,
              }),
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

    const firstPullNextSince = (
      pullResponse.body as {
        nextSince: string;
      }
    ).nextSince;

    const pushDeleteResponse = await requestJson(
      '/api/sync/push',
      {
        method: 'POST',
        body: JSON.stringify({
          changes: [
            {
              queueId: '5188f5b1-1c80-49fd-ba6d-6848b8f0f6a3',
              entityType: 'work',
              entityId: workId,
              operation: 'delete',
              createdAt: '2026-04-18T00:04:00.000Z',
              payload: buildSyncPayload(workId, {
                title: 'Dune Messiah',
                updatedAt: '2026-04-18T00:04:00.000Z',
                deletedAt: '2026-04-18T00:04:00.000Z',
                serverVersion: 2,
              }),
            },
          ],
        }),
      },
      firstUser.accessToken,
    );

    expect(pushDeleteResponse.status).toBe(200);
    expect(pushDeleteResponse.body).toEqual(
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

    const pullDeletedResponse = await requestJson(
      '/api/sync/pull',
      {
        method: 'POST',
        body: JSON.stringify({
          since: firstPullNextSince,
        }),
      },
      firstUser.accessToken,
    );

    expect(pullDeletedResponse.status).toBe(200);
    expect(pullDeletedResponse.body).toEqual(
      expect.objectContaining({
        changes: [
          expect.objectContaining({
            entityId: workId,
            operation: 'delete',
            work: expect.objectContaining({
              deletedAt: '2026-04-18T00:04:00.000Z',
              serverVersion: 3,
            }),
          }),
        ],
      }),
    );
  });

  it('validates auth and works payloads, including blank titles', async () => {
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

    const session = await registerUser('validation@example.com');
    const blankTitleCreateResponse = await requestJson(
      '/api/works',
      {
        method: 'POST',
        body: JSON.stringify({
          title: '   ',
        }),
      },
      session.accessToken,
    );

    expect(blankTitleCreateResponse.status).toBe(400);
    expect(
      (blankTitleCreateResponse.body as { message: string[] }).message,
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('title'),
      ]),
    );

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
    const blankTitleUpdateResponse = await requestJson(
      `/api/works/${workId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          title: '   ',
        }),
      },
      session.accessToken,
    );

    expect(blankTitleUpdateResponse.status).toBe(400);

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
