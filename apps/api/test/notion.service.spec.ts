import { WorkSyncStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { NotionService } from '../src/modules/notion/notion.service';
import type { ExternalApiKeyCryptoService } from '../src/modules/imports/credentials/external-api-key-crypto.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const USER_ID = '2c92b57e-e529-4344-bd62-0cff4de5dfe2';
const PREVIEW_ID = 'd55d8141-cc47-4586-8116-249f8949b6b2';
const WORK_ID = '9fcbf92f-6347-4d79-bdf8-9d0d18439c28';
const NOTION_PAGE_ID = 'notion-page-1';

interface MockNotionPrisma {
  $transaction: jest.MockedFunction<
    (callback: (client: MockNotionPrisma) => Promise<unknown>) => Promise<unknown>
  >;
  notionPullPreviewSnapshot: {
    deleteMany: jest.MockedFunction<
      (input?: unknown) => Promise<{ count: number }>
    >;
    findFirst: jest.MockedFunction<
      (input?: unknown) => Promise<ReturnType<typeof createSnapshot>>
    >;
  };
  notionSyncMapping: {
    updateMany: jest.MockedFunction<
      (input?: unknown) => Promise<{ count: number }>
    >;
  };
  userWorkRecord: {
    findMany: jest.MockedFunction<
      (input?: unknown) => Promise<Array<{ id: string }>>
    >;
    updateMany: jest.MockedFunction<
      (input?: unknown) => Promise<{ count: number }>
    >;
  };
}

function createSnapshot() {
  return {
    id: PREVIEW_ID,
    userId: USER_ID,
    notionDataSourceId: 'notion-source-1',
    changes: [
      {
        changes: [
          {
            field: 'favorite',
            localValue: false,
            notionValue: true,
          },
        ],
        lastNotionEditedAt: '2026-06-18T01:00:00.000Z',
        localServerVersion: 7,
        notionPageId: NOTION_PAGE_ID,
        title: 'Dune',
        workId: WORK_ID,
      },
    ],
    previewedAt: new Date('2026-06-18T01:05:00.000Z'),
    expiresAt: new Date('2026-06-18T01:20:00.000Z'),
    createdAt: new Date('2026-06-18T01:05:00.000Z'),
  };
}

describe('NotionService', () => {
  let prisma: MockNotionPrisma;
  let service: NotionService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(
        async (callback: (client: MockNotionPrisma) => Promise<unknown>) =>
          callback(prisma),
      ),
      notionPullPreviewSnapshot: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
        findFirst: jest.fn(async () => createSnapshot()),
      },
      notionSyncMapping: {
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      userWorkRecord: {
        findMany: jest.fn(async () => [{ id: WORK_ID }]),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
    };

    service = new NotionService(
      prisma as unknown as PrismaService,
      {} as ExternalApiKeyCryptoService,
    );
  });

  it('applies stored preview snapshot changes with a local serverVersion guard', async () => {
    const result = await service.applyPull(USER_ID, {
      previewId: PREVIEW_ID,
      workIds: [WORK_ID],
    });

    expect(prisma.notionPullPreviewSnapshot.findFirst).toHaveBeenCalledWith({
      where: {
        expiresAt: {
          gt: expect.any(Date),
        },
        id: PREVIEW_ID,
        userId: USER_ID,
      },
    });
    expect(prisma.userWorkRecord.updateMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        id: WORK_ID,
        serverVersion: 7,
        userId: USER_ID,
      },
      data: {
        favorite: true,
        serverVersion: {
          increment: 1,
        },
        syncStatus: WorkSyncStatus.synced,
      },
    });
    expect(prisma.notionSyncMapping.updateMany).toHaveBeenCalledWith({
      where: {
        notionPageId: NOTION_PAGE_ID,
        userId: USER_ID,
      },
      data: {
        lastNotionEditedAt: new Date('2026-06-18T01:00:00.000Z'),
        lastPulledAt: expect.any(Date),
      },
    });
    expect(result).toEqual({
      applied: 1,
      errors: [],
      previewedCount: 1,
      warnings: [],
    });
  });

  it('does not apply a preview when the local work changed after preview', async () => {
    prisma.userWorkRecord.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.applyPull(USER_ID, {
      previewId: PREVIEW_ID,
      workIds: [WORK_ID],
    });

    expect(prisma.notionSyncMapping.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      applied: 0,
      errors: [
        {
          message:
            '로컬 작품이 미리보기 이후 변경되어 Notion 변경사항을 적용하지 않았습니다.',
          workId: WORK_ID,
        },
      ],
      previewedCount: 1,
      warnings: [],
    });
  });
});
