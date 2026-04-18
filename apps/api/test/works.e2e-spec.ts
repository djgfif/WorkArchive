import { type AddressInfo } from 'node:net';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WorkStatus, WorkType } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

function createPrismaServiceMock() {
  const works: Array<Record<string, unknown>> = [];

  return {
    work: {
      findMany: async () =>
        [...works]
          .filter((work) => work.deletedAt === null)
          .sort(
            (left, right) =>
              new Date(right.updatedAt as Date).getTime() -
              new Date(left.updatedAt as Date).getTime(),
          ),
      findUnique: async ({
        where,
      }: {
        where: {
          id: string;
        };
      }) => works.find((work) => work.id === where.id) ?? null,
      create: async ({
        data,
      }: {
        data: Record<string, unknown>;
      }) => {
        const now = new Date();
        const work = {
          id: crypto.randomUUID(),
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
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          syncStatus: data.syncStatus,
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

  it('keeps health working outside the /api prefix', async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: 'work-archive-api',
      status: 'ok',
    });
  });

  it('supports create, read, update, list, and soft delete for works', async () => {
    const createResponse = await fetch(`${baseUrl}/api/works`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: WorkType.anime,
        title: '  Frieren: Beyond Journey\'s End  ',
        author: ' Kanehito Yamada ',
        genres: [' Fantasy ', 'Drama', 'Fantasy'],
        status: WorkStatus.completed,
        rating: 4.5,
        shortReview: ' Quiet and precise. ',
        favorite: true,
      }),
    });

    expect(createResponse.status).toBe(201);

    const createdWork = (await createResponse.json()) as Record<string, unknown>;

    expect(createdWork).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: WorkType.anime,
        title: 'Frieren: Beyond Journey\'s End',
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

    const listResponse = await fetch(`${baseUrl}/api/works`);

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual([
      expect.objectContaining({
        id: workId,
      }),
    ]);

    const detailResponse = await fetch(`${baseUrl}/api/works/${workId}`);

    expect(detailResponse.status).toBe(200);
    await expect(detailResponse.json()).resolves.toEqual(
      expect.objectContaining({
        id: workId,
      }),
    );

    const updateResponse = await fetch(`${baseUrl}/api/works/${workId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        status: WorkStatus.paused,
        tier: 'A',
      }),
    });

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toEqual(
      expect.objectContaining({
        status: WorkStatus.paused,
        tier: 'A',
        serverVersion: 2,
      }),
    );

    const deleteResponse = await fetch(`${baseUrl}/api/works/${workId}`, {
      method: 'DELETE',
    });

    expect(deleteResponse.status).toBe(204);

    const emptyListResponse = await fetch(`${baseUrl}/api/works`);

    expect(emptyListResponse.status).toBe(200);
    await expect(emptyListResponse.json()).resolves.toEqual([]);

    const deletedDetailResponse = await fetch(`${baseUrl}/api/works/${workId}`);

    expect(deletedDetailResponse.status).toBe(404);
  });
});
