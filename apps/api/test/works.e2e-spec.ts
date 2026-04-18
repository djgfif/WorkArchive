import { type AddressInfo } from 'node:net';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

function createPrismaServiceMock() {
  const works: Array<Record<string, unknown>> = [];

  return {
    work: {
      findMany: async ({
        where,
        orderBy,
      }: {
        where?: {
          deletedAt?: null;
          updatedAt?: {
            gt: Date;
          };
        };
        orderBy?: {
          updatedAt: 'asc' | 'desc';
        };
      } = {}) =>
        [...works]
          .filter((work) => {
            if (where?.deletedAt === null && work.deletedAt !== null) {
              return false;
            }

            if (
              where?.updatedAt?.gt &&
              new Date(work.updatedAt as Date).getTime() <=
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
          }),
      findUnique: async ({
        where,
      }: {
        where: {
          id: string;
        };
      }) => works.find((work) => work.id === where.id) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date();
        const work = {
          id: data.id ?? crypto.randomUUID(),
          type: data.type,
          title: data.title,
          author: data.author,
          genres: data.genres,
          description: data.description,
          thumbnailUrl: data.thumbnailUrl,
          status: data.status,
          rating: data.rating ?? null,
          shortReview: data.shortReview,
          review: data.review,
          tier: data.tier ?? null,
          favorite: data.favorite ?? false,
          createdAt: data.createdAt ?? now,
          updatedAt: now,
          deletedAt: data.deletedAt ?? null,
          syncStatus: data.syncStatus ?? WorkSyncStatus.synced,
          serverVersion: data.serverVersion,
        };

        works.push(work);

        return work;
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
        const index = works.findIndex((work) => work.id === where.id);

        if (index === -1) {
          throw new Error('work not found');
        }

        const current = works[index]!;
        const nextVersion =
          typeof data.serverVersion === 'object' &&
          data.serverVersion !== null &&
          'increment' in data.serverVersion
            ? Number(current.serverVersion) +
              Number(
                (
                  data.serverVersion as {
                    increment: number;
                  }
                ).increment,
              )
            : Number(current.serverVersion);

        const updatedWork = {
          ...current,
          ...data,
          serverVersion: nextVersion,
          updatedAt: new Date(),
        };

        works[index] = updatedWork;

        return updatedWork;
      },
    },
  };
}

describe('Works API (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaServiceMock())
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await app.close();
  });

  async function requestJson(
    path: string,
    init?: RequestInit,
  ): Promise<{
    body: unknown;
    status: number;
  }> {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const body = response.status === 204 ? null : await response.json();

    return {
      body,
      status: response.status,
    };
  }

  it('keeps health working outside the /api prefix', async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: 'work-archive-api',
      status: 'ok',
    });
  });

  it('supports create, read, update, list, and soft delete for works', async () => {
    const createResponse = await requestJson('/api/works', {
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
    });

    expect(createResponse.status).toBe(201);

    const createdWork = createResponse.body as Record<string, unknown>;

    expect(createdWork).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: WorkType.anime,
        title: "Frieren: Beyond Journey's End",
        author: 'Kanehito Yamada',
        genres: ['Fantasy', 'Drama'],
        status: WorkStatus.completed,
        rating: 4.5,
        shortReview: 'Quiet and precise.',
        favorite: true,
        syncStatus: 'synced',
        serverVersion: 1,
        deletedAt: null,
      }),
    );

    const workId = createdWork.id as string;

    const listResponse = await requestJson('/api/works');

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual([
      expect.objectContaining({
        id: workId,
      }),
    ]);

    const detailResponse = await requestJson(`/api/works/${workId}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body).toEqual(
      expect.objectContaining({
        id: workId,
      }),
    );

    const updateResponse = await requestJson(`/api/works/${workId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: WorkStatus.paused,
        tier: 'A',
      }),
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toEqual(
      expect.objectContaining({
        status: WorkStatus.paused,
        tier: 'A',
        serverVersion: 2,
      }),
    );

    const deleteResponse = await requestJson(`/api/works/${workId}`, {
      method: 'DELETE',
    });

    expect(deleteResponse.status).toBe(204);

    const emptyListResponse = await requestJson('/api/works');

    expect(emptyListResponse.status).toBe(200);
    expect(emptyListResponse.body).toEqual([]);

    const deletedDetailResponse = await requestJson(`/api/works/${workId}`);

    expect(deletedDetailResponse.status).toBe(404);
  });

  it('supports manual push and pull sync endpoints with visible conflicts', async () => {
    const pushCreateResponse = await requestJson('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({
        changes: [
          {
            queueId: '6a8f8eb6-8317-4e8a-b8e7-530c5cc1db4d',
            entityType: 'work',
            entityId: '3f831224-abf9-44c3-b3f9-9ff4da2f7de8',
            operation: 'create',
            createdAt: '2026-04-18T00:00:00.000Z',
            payload: {
              id: '3f831224-abf9-44c3-b3f9-9ff4da2f7de8',
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
    });

    expect(pushCreateResponse.status).toBe(200);
    expect(pushCreateResponse.body).toEqual(
      expect.objectContaining({
        results: [
          expect.objectContaining({
            status: 'applied',
            entityId: '3f831224-abf9-44c3-b3f9-9ff4da2f7de8',
            work: expect.objectContaining({
              title: 'Dune',
              syncStatus: 'synced',
              serverVersion: 1,
            }),
          }),
        ],
      }),
    );

    const serverUpdateResponse = await requestJson(
      '/api/works/3f831224-abf9-44c3-b3f9-9ff4da2f7de8',
      {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Dune Messiah',
        }),
      },
    );

    expect(serverUpdateResponse.status).toBe(200);

    const pullResponse = await requestJson('/api/sync/pull', {
      method: 'POST',
      body: JSON.stringify({
        since: '2026-04-17T00:00:00.000Z',
      }),
    });

    expect(pullResponse.status).toBe(200);
    expect(pullResponse.body).toEqual(
      expect.objectContaining({
        changes: expect.arrayContaining([
          expect.objectContaining({
            entityId: '3f831224-abf9-44c3-b3f9-9ff4da2f7de8',
            operation: 'upsert',
            work: expect.objectContaining({
              title: 'Dune Messiah',
              serverVersion: 2,
            }),
          }),
        ]),
      }),
    );

    const conflictResponse = await requestJson('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({
        changes: [
          {
            queueId: 'd125b784-6d75-429f-bfa1-04f0f491de14',
            entityType: 'work',
            entityId: '3f831224-abf9-44c3-b3f9-9ff4da2f7de8',
            operation: 'update',
            createdAt: '2026-04-18T00:05:00.000Z',
            payload: {
              id: '3f831224-abf9-44c3-b3f9-9ff4da2f7de8',
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
    });

    expect(conflictResponse.status).toBe(200);
    expect(conflictResponse.body).toEqual(
      expect.objectContaining({
        results: [
          expect.objectContaining({
            status: 'conflict',
            message: expect.stringContaining('server version 2'),
            work: expect.objectContaining({
              title: 'Dune Messiah',
              serverVersion: 2,
            }),
          }),
        ],
      }),
    );
  });

  it('surfaces a conflict when deleting a previously synced record that is already missing remotely', async () => {
    const conflictResponse = await requestJson('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({
        changes: [
          {
            queueId: 'd125b784-6d75-429f-bfa1-04f0f491de14',
            entityType: 'work',
            entityId: '3f831224-abf9-44c3-b3f9-9ff4da2f7de8',
            operation: 'delete',
            createdAt: '2026-04-18T00:05:00.000Z',
            payload: {
              id: '3f831224-abf9-44c3-b3f9-9ff4da2f7de8',
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
              deletedAt: '2026-04-18T00:05:00.000Z',
              syncStatus: 'pending',
              serverVersion: 2,
            },
          },
        ],
      }),
    });

    expect(conflictResponse.status).toBe(200);
    expect(conflictResponse.body).toEqual(
      expect.objectContaining({
        results: [
          expect.objectContaining({
            status: 'conflict',
            message: expect.stringContaining('already missing remotely'),
            work: null,
          }),
        ],
      }),
    );
  });

  it('returns 404 for missing works across detail, update, and delete', async () => {
    const missingId = crypto.randomUUID();

    await expect(requestJson(`/api/works/${missingId}`)).resolves.toEqual(
      expect.objectContaining({
        status: 404,
      }),
    );

    await expect(
      requestJson(`/api/works/${missingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: WorkStatus.completed,
        }),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 404,
      }),
    );

    await expect(
      requestJson(`/api/works/${missingId}`, {
        method: 'DELETE',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 404,
      }),
    );
  });

  it('validates create and update payloads while allowing omitted optional fields', async () => {
    const minimalCreateResponse = await requestJson('/api/works', {
      method: 'POST',
      body: JSON.stringify({
        title: '  Only Required Title  ',
      }),
    });

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

    const workId = (minimalCreateResponse.body as Record<string, unknown>)
      .id as string;

    const invalidCreateResponse = await requestJson('/api/works', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Invalid work',
        type: 'bad-type',
        status: 'bad-status',
        rating: 7,
        genres: 'Drama',
      }),
    });

    expect(invalidCreateResponse.status).toBe(400);
    expect(invalidCreateResponse.body).toEqual(
      expect.objectContaining({
        statusCode: 400,
      }),
    );
    expect(
      (invalidCreateResponse.body as { message: string[] }).message,
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('type'),
        expect.stringContaining('status'),
        expect.stringContaining('rating'),
        expect.stringContaining('genres'),
      ]),
    );

    const invalidUpdateResponse = await requestJson(`/api/works/${workId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        rating: '4',
        tier: 'Z',
        genres: 'Drama',
      }),
    });

    expect(invalidUpdateResponse.status).toBe(400);
    expect(invalidUpdateResponse.body).toEqual(
      expect.objectContaining({
        statusCode: 400,
      }),
    );
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

  it('validates sync payloads for push and pull', async () => {
    const invalidPushResponse = await requestJson('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({
        changes: [],
      }),
    });

    expect(invalidPushResponse.status).toBe(400);
    expect((invalidPushResponse.body as { message: string[] }).message).toEqual(
      expect.arrayContaining([expect.stringContaining('changes')]),
    );

    const invalidPullResponse = await requestJson('/api/sync/pull', {
      method: 'POST',
      body: JSON.stringify({
        since: 'not-a-date',
      }),
    });

    expect(invalidPullResponse.status).toBe(400);
    expect((invalidPullResponse.body as { message: string[] }).message).toEqual(
      expect.arrayContaining([expect.stringContaining('since')]),
    );
  });
});
