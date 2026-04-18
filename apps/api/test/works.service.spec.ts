import { NotFoundException } from '@nestjs/common';
import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { WorksService } from '../src/modules/works/works.service';
import { type PrismaService } from '../src/prisma/prisma.service';

const USER_ID = '2c92b57e-e529-4344-bd62-0cff4de5dfe2';

function createWorkFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    userId: USER_ID,
    type: WorkType.novel,
    title: 'The Three-Body Problem',
    author: 'Liu Cixin',
    genres: ['Sci-Fi'],
    description: '',
    thumbnailUrl: '',
    status: WorkStatus.completed,
    rating: 5,
    shortReview: '',
    review: '',
    tier: null,
    favorite: false,
    createdAt: new Date('2026-04-18T00:00:00.000Z'),
    updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    deletedAt: null,
    syncStatus: WorkSyncStatus.synced,
    serverVersion: 1,
    ...overrides,
  };
}

describe('WorksService', () => {
  let service: WorksService;
  let prisma: jest.Mocked<Pick<PrismaService, 'work'>>;

  beforeEach(() => {
    prisma = {
      work: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<PrismaService, 'work'>>;

    service = new WorksService(prisma as unknown as PrismaService);
  });

  it('lists only active works for the current user ordered by updatedAt desc', async () => {
    prisma.work.findMany.mockResolvedValue([createWorkFixture()]);

    await service.findAll(USER_ID);

    expect(prisma.work.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        deletedAt: null,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  });

  it('creates a work with normalized fields, defaults, and ownership', async () => {
    prisma.work.create.mockResolvedValue(createWorkFixture());

    await service.create(USER_ID, {
      title: '  Dune  ',
      author: '  Frank Herbert ',
      genres: [' Sci-Fi ', 'Classic', 'Sci-Fi'],
    });

    expect(prisma.work.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER_ID,
        type: WorkType.novel,
        title: 'Dune',
        author: 'Frank Herbert',
        genres: ['Sci-Fi', 'Classic'],
        status: WorkStatus.planned,
        rating: null,
        tier: null,
        favorite: false,
        syncStatus: 'synced',
        serverVersion: 1,
      }),
    });
  });

  it('maps prisma sync status values back to the shared API domain', async () => {
    prisma.work.findFirst.mockResolvedValue(
      createWorkFixture({
        syncStatus: WorkSyncStatus.local_only,
      }),
    );

    await expect(
      service.findOne(USER_ID, '9fcbf92f-6347-4d79-bdf8-9d0d18439c28'),
    ).resolves.toEqual(
      expect.objectContaining({
        syncStatus: 'local-only',
      }),
    );
  });

  it('throws not found for missing or foreign works', async () => {
    prisma.work.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne(USER_ID, '9fcbf92f-6347-4d79-bdf8-9d0d18439c28'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft deletes a work by setting deletedAt and incrementing serverVersion', async () => {
    prisma.work.findFirst.mockResolvedValue(createWorkFixture());
    prisma.work.update.mockResolvedValue(
      createWorkFixture({
        deletedAt: new Date('2026-04-18T01:00:00.000Z'),
        serverVersion: 2,
      }),
    );

    await service.remove(USER_ID, '9fcbf92f-6347-4d79-bdf8-9d0d18439c28');

    expect(prisma.work.update).toHaveBeenCalledWith({
      where: {
        id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      },
      data: {
        deletedAt: expect.any(Date),
        syncStatus: 'synced',
        serverVersion: {
          increment: 1,
        },
      },
    });
  });

  it('returns the current record when update payload is empty', async () => {
    prisma.work.findFirst.mockResolvedValue(createWorkFixture());

    const result = await service.update(
      USER_ID,
      '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      {},
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
        syncStatus: 'synced',
      }),
    );
    expect(prisma.work.update).not.toHaveBeenCalled();
  });
});
