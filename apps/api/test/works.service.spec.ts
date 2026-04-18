import { NotFoundException } from '@nestjs/common';
import { WorkStatus, WorkType } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { type PrismaService } from '../src/prisma/prisma.service';
import { WorksService } from '../src/modules/works/works.service';

function createWorkFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
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
    syncStatus: 'synced',
    serverVersion: 1,
    ...overrides,
  };
}

describe('WorksService', () => {
  let service: WorksService;
  let prisma: jest.Mocked<
    Pick<PrismaService, 'work'>
  >;

  beforeEach(() => {
    prisma = {
      work: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<PrismaService, 'work'>>;

    service = new WorksService(prisma as unknown as PrismaService);
  });

  it('lists only active works ordered by updatedAt desc', async () => {
    prisma.work.findMany.mockResolvedValue([createWorkFixture()]);

    await service.findAll();

    expect(prisma.work.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  });

  it('creates a work with normalized fields and defaults', async () => {
    prisma.work.create.mockResolvedValue(createWorkFixture());

    await service.create({
      title: '  Dune  ',
      author: '  Frank Herbert ',
      genres: [' Sci-Fi ', 'Classic', 'Sci-Fi'],
    });

    expect(prisma.work.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
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

  it('throws not found for deleted works', async () => {
    prisma.work.findUnique.mockResolvedValue(
      createWorkFixture({
        deletedAt: new Date('2026-04-18T01:00:00.000Z'),
      }),
    );

    await expect(
      service.findOne('9fcbf92f-6347-4d79-bdf8-9d0d18439c28'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft deletes a work by setting deletedAt and incrementing serverVersion', async () => {
    prisma.work.findUnique.mockResolvedValue(createWorkFixture());
    prisma.work.update.mockResolvedValue(
      createWorkFixture({
        deletedAt: new Date('2026-04-18T01:00:00.000Z'),
        serverVersion: 2,
      }),
    );

    await service.remove('9fcbf92f-6347-4d79-bdf8-9d0d18439c28');

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
});
