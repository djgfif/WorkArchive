/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from '@nestjs/common';
import {
  TierBoardCardSourceType,
  TierBoardAssetKind,
  TierBoardAssetStorageType,
  TierBoardType,
  TierBoardVisibility,
  TimelineEntryType,
  WorkStatus,
  WorkSyncStatus,
  WorkType,
} from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { CatalogService } from '../src/modules/catalog/catalog.service';
import { SyncService } from '../src/modules/sync/sync.service';
import type { SyncReleaseRecordPayloadDto } from '../src/modules/sync/payloads/sync-release-record-payload.dto';
import type { SyncSeriesPayloadDto } from '../src/modules/sync/payloads/sync-series-payload.dto';
import type { SyncTimelineEntryPayloadDto } from '../src/modules/sync/payloads/sync-timeline-entry-payload.dto';
import type {
  SyncTierBoardAssetPayloadDto,
  SyncTierBoardCardPayloadDto,
  SyncTierBoardPayloadDto,
  SyncTierLanePayloadDto,
} from '../src/modules/sync/payloads/sync-tier-board-payload.dto';
import type { SyncWorkSeriesLinkPayloadDto } from '../src/modules/sync/payloads/sync-work-series-link-payload.dto';
import type { SyncWorkPayloadDto } from '../src/modules/sync/payloads/sync-work-payload.dto';
import { type PrismaService } from '../src/prisma/prisma.service';
import type {
  UserReleaseRecordsService,
  UserReleaseRecordAggregate,
} from '../src/modules/user-records/user-release-records.service';
import type {
  UserRecordsService,
  WorkAggregate,
} from '../src/modules/user-records/user-records.service';
import type {
  UserTimelineEntriesService,
  UserTimelineEntryAggregate,
} from '../src/modules/user-records/user-timeline-entries.service';

const USER_ID = '2c92b57e-e529-4344-bd62-0cff4de5dfe2';
const OTHER_USER_ID = 'a3fba91f-71c3-46a2-b126-c4cbca6dd1a8';
const CATALOG_TITLE_ID = '4fb2a50f-2807-46a2-af4f-f9709afe0a8e';
const IMPORTED_CATALOG_TITLE_ID = 'db3d7b72-a7ef-4124-b09d-fb76fdf15fed';
const MISSING_CATALOG_TITLE_ID = 'b7d5aadc-bb3d-4bb8-9726-569b8812dc25';
const PAYLOAD_TITLE_CATALOG_TITLE_ID = 'a0c991ac-e88d-4f8e-81d7-f102519a913d';

function createWorkAggregateFixture(
  overrides: Partial<WorkAggregate> = {},
): WorkAggregate {
  return {
    id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    userId: USER_ID,
    catalogTitleId: CATALOG_TITLE_ID,
    catalogWorkId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    status: WorkStatus.completed,
    rating: 5,
    shortReview: '',
    review: '',
    personalTags: [],
    favorite: false,
    createdAt: new Date('2026-04-18T00:00:00.000Z'),
    updatedAt: new Date('2026-04-18T01:00:00.000Z'),
    deletedAt: null,
    syncStatus: WorkSyncStatus.synced,
    serverVersion: 3,
    catalogWork: {
      id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      type: WorkType.novel,
      title: 'The Three-Body Problem',
      author: 'Liu Cixin',
      genres: ['판타지'],
      description: '',
      thumbnailUrl: '',
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      updatedAt: new Date('2026-04-18T01:00:00.000Z'),
    },
    catalogTitle: {
      mediumType: WorkType.novel,
    },
    ...overrides,
  } as WorkAggregate;
}

function createSyncPayload(
  overrides: Partial<SyncWorkPayloadDto> = {},
): SyncWorkPayloadDto {
  return {
    id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    type: WorkType.novel,
    title: 'The Three-Body Problem',
    author: 'Liu Cixin',
    genres: ['판타지'],
    personalTags: [],
    description: '',
    thumbnailUrl: '',
    status: WorkStatus.completed,
    rating: 5,
    shortReview: '',
    review: '',
    favorite: false,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T01:00:00.000Z',
    deletedAt: null,
    syncStatus: 'pending',
    serverVersion: 3,
    ...overrides,
  };
}

function createTierBoardPayload(
  overrides: Partial<SyncTierBoardPayloadDto> = {},
): SyncTierBoardPayloadDto {
  return {
    id: 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901',
    title: 'Favorites',
    description: '',
    slug: 'favorites',
    boardType: TierBoardType.classic_tier,
    visibility: TierBoardVisibility.private,
    coverImageUrl: '',
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

function createTierLanePayload(
  overrides: Partial<SyncTierLanePayloadDto> = {},
): SyncTierLanePayloadDto {
  return {
    id: '877fb270-a90b-445f-bc7e-eec9611b6b1d',
    boardId: 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901',
    title: 'S',
    description: '',
    colorToken: '#64748b',
    orderIndex: 0,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

function createTierBoardCardPayload(
  overrides: Partial<SyncTierBoardCardPayloadDto> = {},
): SyncTierBoardCardPayloadDto {
  return {
    id: '0cb7bbce-0885-468f-ab6b-b66d646b78ec',
    boardId: 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901',
    laneId: '877fb270-a90b-445f-bc7e-eec9611b6b1d',
    cardSourceType: TierBoardCardSourceType.library_work,
    title: 'Dune',
    subtitle: '',
    imageUrl: '',
    note: '',
    workId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    orderIndex: 0,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

function createTierBoardAssetPayload(
  overrides: Partial<SyncTierBoardAssetPayloadDto> = {},
): SyncTierBoardAssetPayloadDto {
  return {
    id: 'dc42d556-13a5-4b28-897c-5c79d68a7f79',
    boardId: 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901',
    cardId: '0cb7bbce-0885-468f-ab6b-b66d646b78ec',
    kind: TierBoardAssetKind.image,
    storageType: TierBoardAssetStorageType.remote_url,
    objectUrl: 'https://example.com/image.jpg',
    originalName: 'image.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1000,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

function createUserSeriesFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: '9b9632f1-0f52-4fb3-afcf-323d99bde595',
    userId: USER_ID,
    title: 'Fate',
    normalizedTitle: 'fate',
    aliases: [],
    kind: 'series',
    parentId: null,
    description: '',
    thumbnailUrl: '',
    createdAt: new Date('2026-04-18T00:00:00.000Z'),
    updatedAt: new Date('2026-04-18T01:00:00.000Z'),
    deletedAt: null,
    syncStatus: WorkSyncStatus.synced,
    serverVersion: 1,
    ...overrides,
  };
}

function createSyncSeriesPayload(
  overrides: Partial<SyncSeriesPayloadDto> = {},
): SyncSeriesPayloadDto {
  return {
    id: '9b9632f1-0f52-4fb3-afcf-323d99bde595',
    title: 'Fate',
    normalizedTitle: 'fate',
    aliases: [],
    kind: 'series',
    parentId: null,
    description: '',
    thumbnailUrl: '',
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T01:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

function createReleaseRecordAggregateFixture(
  overrides: Partial<UserReleaseRecordAggregate> = {},
): UserReleaseRecordAggregate {
  return {
    id: '7fb84ae9-6821-4d68-bb89-2f51f0dd9e11',
    userWorkRecordId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    catalogReleaseId: '5f7ac03a-0679-4e63-a62d-0d04b5e72a23',
    status: WorkStatus.completed,
    rating: 4.5,
    shortReview: 'Volume 1 review',
    review: '',
    favorite: false,
    createdAt: new Date('2026-04-18T00:00:00.000Z'),
    updatedAt: new Date('2026-04-18T01:00:00.000Z'),
    deletedAt: null,
    syncStatus: WorkSyncStatus.synced,
    serverVersion: 1,
    catalogRelease: {
      id: '5f7ac03a-0679-4e63-a62d-0d04b5e72a23',
      catalogTitleId: CATALOG_TITLE_ID,
      releaseType: 'volume',
      displayLabel: 'Volume 1',
      title: 'Dune Volume 1',
      sequence: 1,
      isbn: null,
      releaseDate: null,
      summary: '',
      thumbnailUrl: '',
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    },
    userWorkRecord: {
      id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      userId: USER_ID,
      catalogTitleId: CATALOG_TITLE_ID,
      catalogWork: {
        type: WorkType.light_novel,
      },
      catalogTitle: {
        mediumType: WorkType.light_novel,
      },
    },
    ...overrides,
  } as UserReleaseRecordAggregate;
}

function createReleaseRecordPayload(
  overrides: Partial<SyncReleaseRecordPayloadDto> = {},
): SyncReleaseRecordPayloadDto {
  return {
    id: '7fb84ae9-6821-4d68-bb89-2f51f0dd9e11',
    userWorkRecordId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    catalogReleaseId: '5f7ac03a-0679-4e63-a62d-0d04b5e72a23',
    status: WorkStatus.completed,
    rating: 4.5,
    shortReview: 'Volume 1 review',
    review: '',
    favorite: false,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T01:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

function createTimelineEntryAggregateFixture(
  overrides: Partial<UserTimelineEntryAggregate> = {},
): UserTimelineEntryAggregate {
  return {
    id: '169626cc-e8db-4e67-bb21-c1a7609e5ebc',
    userId: USER_ID,
    userWorkRecordId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    type: TimelineEntryType.note,
    occurredAt: new Date('2026-04-18T02:00:00.000Z'),
    note: 'Manual note',
    createdAt: new Date('2026-04-18T00:00:00.000Z'),
    updatedAt: new Date('2026-04-18T02:00:00.000Z'),
    deletedAt: null,
    syncStatus: WorkSyncStatus.synced,
    serverVersion: 1,
    userWorkRecord: {
      id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      userId: USER_ID,
    },
    ...overrides,
  } as UserTimelineEntryAggregate;
}

function createTimelineEntryPayload(
  overrides: Partial<SyncTimelineEntryPayloadDto> = {},
): SyncTimelineEntryPayloadDto {
  return {
    id: '169626cc-e8db-4e67-bb21-c1a7609e5ebc',
    workId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    type: TimelineEntryType.note,
    occurredAt: '2026-04-18T02:00:00.000Z',
    note: 'Manual note',
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T02:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

describe('SyncService', () => {
  let service: SyncService;
  let prisma: any;
  let catalogService: jest.Mocked<
    Pick<CatalogService, 'create' | 'createTitleFromImportCandidate' | 'update'>
  >;
  let userRecordsService: jest.Mocked<
    Pick<
      UserRecordsService,
      'create' | 'findById' | 'findByUserSince' | 'update'
    >
  >;
  let releaseRecordsService: any;
  let timelineEntriesService: any;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      catalogTitle: {
        findUnique: jest.fn(),
      },
      catalogWork: {
        create: jest.fn(),
      },
      catalogRelease: {
        findFirst: jest.fn(),
      },
      userReleaseRecord: {
        create: jest.fn(),
        findMany: jest.fn(async () => []),
      },
      userSeries: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(async () => []),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userWorkSeriesLink: {
        create: jest.fn(),
        findMany: jest.fn(async () => []),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userContributor: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(async () => []),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userWorkContributor: {
        create: jest.fn(),
        findMany: jest.fn(async () => []),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userWorkRelation: {
        create: jest.fn(),
        findMany: jest.fn(async () => []),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userTierBoard: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(async () => []),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userTierLane: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(async () => []),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userTierBoardCard: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(async () => []),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userTierBoardAsset: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(async () => []),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userWorkRecord: {
        findMany: jest.fn(async () => []),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userTimelineEntry: {
        findMany: jest.fn(async () => []),
      },
      userSyncAppliedMutation: {
        create: jest.fn(),
        findUnique: jest.fn(async () => null),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: any) => Promise<any>) => callback(prisma),
    );

    catalogService = {
      create: jest.fn(),
      createTitleFromImportCandidate: jest.fn(),
      update: jest.fn(),
    };
    userRecordsService = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserSince: jest.fn(),
      update: jest.fn(),
    };
    releaseRecordsService = {
      findById: jest.fn(),
      findByUserSince: jest.fn(async () => []),
      update: jest.fn(),
    };
    timelineEntriesService = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserSince: jest.fn(async () => []),
      update: jest.fn(),
    };

    service = new SyncService(
      prisma as unknown as PrismaService,
      catalogService as unknown as CatalogService,
      userRecordsService as unknown as UserRecordsService,
      releaseRecordsService as unknown as UserReleaseRecordsService,
      timelineEntriesService as unknown as UserTimelineEntriesService,
    );
  });

  it('rejects unsupported push schema versions at the service boundary', async () => {
    await expect(
      service.push(USER_ID, {
        changes: [],
        schemaVersion: 1,
      } as any),
    ).rejects.toThrow('Unsupported sync schema version "1"');

    expect(userRecordsService.findById).not.toHaveBeenCalled();
  });

  it('rejects null pull schema versions at the service boundary', async () => {
    await expect(
      service.pull(USER_ID, {
        schemaVersion: null,
        since: null,
      } as any),
    ).rejects.toThrow('Unsupported sync schema version "null"');

    expect(userRecordsService.findByUserSince).not.toHaveBeenCalled();
  });

  it('returns failed_validation for malformed work payloads before applying storage writes', async () => {
    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: '95f2a1ca-f820-4126-9db4-c6ee3551ae51',
          entityType: 'work',
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'update',
          createdAt: '2026-04-18T00:30:00.000Z',
          payload: {
            ...createSyncPayload(),
            rating: 9,
            title: '',
          },
        },
      ],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'failed',
        code: 'failed_validation',
        message: expect.stringContaining('Invalid work sync payload'),
      }),
    ]);
    expect(userRecordsService.findById).not.toHaveBeenCalled();
    expect(userRecordsService.update).not.toHaveBeenCalled();
  });

  it('returns failed_validation for malformed graph payloads', async () => {
    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: '95f2a1ca-f820-4126-9db4-c6ee3551ae52',
          entityType: 'series',
          entityId: '9b9632f1-0f52-4fb3-afcf-323d99bde595',
          operation: 'update',
          createdAt: '2026-04-18T00:30:00.000Z',
          payload: {
            ...createSyncSeriesPayload(),
            aliases: ['Fate', 123] as any,
            kind: 'bad-kind',
          } as any,
        },
      ],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'failed',
        code: 'failed_validation',
        message: expect.stringContaining('Invalid series sync payload'),
      }),
    ]);
    expect(prisma.userSeries.findUnique).not.toHaveBeenCalled();
  });

  it('returns failed_validation for unknown or mismatched entityType payloads', async () => {
    const unknownEntityResult = await service.push(USER_ID, {
      changes: [
        {
          queueId: '95f2a1ca-f820-4126-9db4-c6ee3551ae55',
          entityType: 'unknown',
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'update',
          createdAt: '2026-04-18T00:30:00.000Z',
          payload: createSyncPayload(),
        },
      ],
    } as any);
    const mismatchedPayloadResult = await service.push(USER_ID, {
      changes: [
        {
          queueId: '95f2a1ca-f820-4126-9db4-c6ee3551ae56',
          entityType: 'series',
          entityId: '9b9632f1-0f52-4fb3-afcf-323d99bde595',
          operation: 'update',
          createdAt: '2026-04-18T00:30:00.000Z',
          payload: createSyncPayload({
            id: '9b9632f1-0f52-4fb3-afcf-323d99bde595',
          }),
        },
      ],
    });

    expect(unknownEntityResult.results).toEqual([
      expect.objectContaining({
        status: 'failed',
        code: 'failed_validation',
        message: expect.stringContaining('Unsupported sync entityType'),
      }),
    ]);
    expect(mismatchedPayloadResult.results).toEqual([
      expect.objectContaining({
        status: 'failed',
        code: 'failed_validation',
        message: expect.stringContaining('Invalid series sync payload'),
      }),
    ]);
  });

  it('reports a remote-newer work conflict instead of overwriting stale changes', async () => {
    userRecordsService.findById.mockResolvedValue(createWorkAggregateFixture());

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: '95f2a1ca-f820-4126-9db4-c6ee3551ae53',
          entityType: 'work',
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'update',
          createdAt: '2026-04-18T00:30:00.000Z',
          payload: {
            ...createSyncPayload(),
            title: 'The Dark Forest',
            updatedAt: '2026-04-18T00:30:00.000Z',
            serverVersion: 2,
          },
        },
      ],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'conflict',
        code: 'conflict_remote_newer',
        work: expect.objectContaining({
          title: 'The Three-Body Problem',
          serverVersion: 3,
        }),
      }),
    ]);
    expect(result.schemaVersion).toBe(5);
    expect(catalogService.update).not.toHaveBeenCalled();
    expect(userRecordsService.update).not.toHaveBeenCalled();
  });

  it('treats a stale but equivalent work payload as already applied', async () => {
    userRecordsService.findById.mockResolvedValue(createWorkAggregateFixture());

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: '95f2a1ca-f820-4126-9db4-c6ee3551ae54',
          entityType: 'work',
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'update',
          createdAt: '2026-04-18T00:30:00.000Z',
          payload: {
            ...createSyncPayload(),
            serverVersion: 2,
          },
        },
      ],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'applied',
        code: 'already_applied',
        work: expect.objectContaining({
          title: 'The Three-Body Problem',
          serverVersion: 3,
        }),
      }),
    ]);
    expect(catalogService.update).not.toHaveBeenCalled();
    expect(userRecordsService.update).not.toHaveBeenCalled();
  });

  it('refuses to modify a record that belongs to another user', async () => {
    userRecordsService.findById.mockResolvedValue(
      createWorkAggregateFixture({
        userId: OTHER_USER_ID,
      }),
    );

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: '95f2a1ca-f820-4126-9db4-c6ee3551ae53',
          entityType: 'work',
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'update',
          createdAt: '2026-04-18T00:30:00.000Z',
          payload: {
            ...createSyncPayload(),
            title: 'The Dark Forest',
            updatedAt: '2026-04-18T00:30:00.000Z',
            serverVersion: 2,
          },
        },
      ],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'conflict',
        code: 'conflict_ownership_mismatch',
        message: expect.stringContaining('cannot be modified remotely'),
        work: null,
      }),
    ]);
  });

  it('pulls tombstones for the current user and uses updatedAt as the next cursor', async () => {
    prisma.userWorkRecord.findMany.mockResolvedValue([
      createWorkAggregateFixture({
        deletedAt: new Date('2026-04-18T02:00:00.000Z'),
        updatedAt: new Date('2026-04-18T02:00:00.000Z'),
      }),
    ]);

    const result = await service.pull(USER_ID, {
      since: '2026-04-18T00:00:00.000Z',
    });

    expect(prisma.userWorkRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 501,
        where: expect.objectContaining({
          userId: USER_ID,
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        schemaVersion: 5,
        nextSince: '2026-04-18T02:00:00.000Z',
        changes: [
          expect.objectContaining({
            operation: 'delete',
            entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          }),
        ],
      }),
    );
  });

  it('uses the default pull page size when limit is omitted', async () => {
    prisma.userWorkRecord.findMany.mockResolvedValue(
      Array.from({ length: 501 }, (_, index) =>
        createWorkAggregateFixture({
          id: `${String(index).padStart(8, '0')}-0000-4000-8000-000000000000`,
          catalogWorkId: `${String(index).padStart(8, '0')}-0000-4000-8000-000000000000`,
          updatedAt: new Date(
            `2026-04-18T02:${String(index % 60).padStart(2, '0')}:00.000Z`,
          ),
        }),
      ),
    );

    const result = await service.pull(USER_ID, {
      since: '2026-04-18T00:00:00.000Z',
    });

    expect(prisma.userWorkRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 501,
      }),
    );
    expect(result.changes).toHaveLength(500);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual(expect.any(String));
  });

  it('paginates pull changes with a stable cursor across same-timestamp entity types', async () => {
    const sharedUpdatedAt = new Date('2026-04-18T02:00:00.000Z');
    prisma.userWorkRecord.findMany
      .mockResolvedValueOnce([
        createWorkAggregateFixture({
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          catalogWorkId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          updatedAt: sharedUpdatedAt,
          catalogWork: {
            ...createWorkAggregateFixture().catalogWork,
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            updatedAt: sharedUpdatedAt,
          },
        }),
      ])
      .mockResolvedValueOnce([
        createWorkAggregateFixture({
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          catalogWorkId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          updatedAt: sharedUpdatedAt,
          catalogWork: {
            ...createWorkAggregateFixture().catalogWork,
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            updatedAt: sharedUpdatedAt,
          },
        }),
      ]);
    prisma.userReleaseRecord.findMany
      .mockResolvedValueOnce([
        createReleaseRecordAggregateFixture({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          updatedAt: sharedUpdatedAt,
        }),
      ])
      .mockResolvedValueOnce([]);
    prisma.userTimelineEntry.findMany
      .mockResolvedValueOnce([
        createTimelineEntryAggregateFixture({
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          updatedAt: sharedUpdatedAt,
        }),
      ])
      .mockResolvedValueOnce([]);

    const firstPage = await service.pull(USER_ID, {
      limit: 2,
      since: '2026-04-18T00:00:00.000Z',
    });

    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextSince).toBe('2026-04-18T00:00:00.000Z');
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    expect(firstPage.changes.map((change) => change.entityType)).toEqual([
      'release_record',
      'timeline_entry',
    ]);
    const nextCursor = firstPage.nextCursor;

    if (!nextCursor) {
      throw new Error('Expected first page to include a next cursor.');
    }

    const secondPage = await service.pull(USER_ID, {
      cursor: nextCursor,
      limit: 2,
      since: '2026-04-18T00:00:00.000Z',
    });

    expect(secondPage.hasMore).toBe(false);
    expect(secondPage.nextCursor).toBeNull();
    expect(secondPage.nextSince).toBe('2026-04-18T02:00:00.000Z');
    expect(secondPage.changes.map((change) => change.entityType)).toEqual([
      'work',
    ]);
  });

  it('applies queued creates in createdAt order even when the payloads arrive out of order', async () => {
    userRecordsService.findById.mockResolvedValue(null);
    userRecordsService.create.mockResolvedValue(createWorkAggregateFixture());

    await service.push(USER_ID, {
      changes: [
        {
          queueId: '95f2a1ca-f820-4126-9db4-c6ee3551ae53',
          entityType: 'work',
          entityId: '11111111-1111-4111-8111-111111111111',
          operation: 'create',
          createdAt: '2026-04-18T00:10:00.000Z',
          payload: createSyncPayload({
            id: '11111111-1111-4111-8111-111111111111',
            title: 'Second change',
            createdAt: '2026-04-18T00:10:00.000Z',
            updatedAt: '2026-04-18T00:10:00.000Z',
            syncStatus: 'local-only',
            serverVersion: 0,
          }),
        },
        {
          queueId: '4cc40859-3c61-4056-aabd-c9471d6f4dfd',
          entityType: 'work',
          entityId: '22222222-2222-4222-8222-222222222222',
          operation: 'create',
          createdAt: '2026-04-18T00:05:00.000Z',
          payload: createSyncPayload({
            id: '22222222-2222-4222-8222-222222222222',
            title: 'First change',
            createdAt: '2026-04-18T00:05:00.000Z',
            updatedAt: '2026-04-18T00:05:00.000Z',
            syncStatus: 'local-only',
            serverVersion: 0,
          }),
        },
      ],
    });

    expect(catalogService.create.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        id: '22222222-2222-4222-8222-222222222222',
        title: 'First change',
      }),
    );
    expect(catalogService.create.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Second change',
      }),
    );
  });

  it('applies an update when the local payload is based on the current server version', async () => {
    userRecordsService.findById.mockResolvedValue(createWorkAggregateFixture());
    userRecordsService.update.mockResolvedValue(
      createWorkAggregateFixture({
        catalogWork: {
          ...createWorkAggregateFixture().catalogWork,
          title: 'Dune Messiah',
        },
        serverVersion: 4,
        updatedAt: new Date('2026-04-18T02:00:00.000Z'),
      }),
    );

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: 'aef45379-c7fc-4874-b3db-8dd7d66f7ea4',
          entityType: 'work',
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'update',
          createdAt: '2026-04-18T02:00:00.000Z',
          payload: createSyncPayload({
            title: 'Dune Messiah',
            updatedAt: '2026-04-18T02:00:00.000Z',
            serverVersion: 3,
          }),
        },
      ],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'applied',
        code: 'applied_change',
        message: 'Queued change applied on the server.',
        work: expect.objectContaining({
          title: 'Dune Messiah',
          serverVersion: 4,
        }),
      }),
    ]);
  });

  it('moves legacy sync payload genres into personal tags before applying work updates', async () => {
    userRecordsService.findById.mockResolvedValue(
      createWorkAggregateFixture({
        catalogWork: {
          ...createWorkAggregateFixture().catalogWork,
          genres: ['판타지'],
        },
      }),
    );
    userRecordsService.update.mockResolvedValue(
      createWorkAggregateFixture({
        personalTags: ['완결까지', '회귀', '빙의'],
        catalogWork: {
          ...createWorkAggregateFixture().catalogWork,
          genres: ['판타지'],
        },
        serverVersion: 4,
      }),
    );

    await service.push(USER_ID, {
      changes: [
        {
          queueId: '655b7fea-19c7-4a03-8d38-6b888943d552',
          entityType: 'work',
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'update',
          createdAt: '2026-04-18T02:00:00.000Z',
          payload: createSyncPayload({
            genres: ['회귀', '빙의', '판타지'],
            personalTags: ['완결까지'],
            updatedAt: '2026-04-18T02:00:00.000Z',
            serverVersion: 3,
          }),
        },
      ],
    });

    expect(catalogService.update).toHaveBeenCalledWith(
      '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      expect.objectContaining({
        genres: ['판타지'],
      }),
      expect.any(Object),
    );
    expect(userRecordsService.update).toHaveBeenCalledWith(
      '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      expect.objectContaining({
        personalTags: ['완결까지', '회귀', '빙의'],
      }),
      expect.any(Object),
    );
  });

  it('returns applied with a stable already-applied message for duplicate push payloads', async () => {
    userRecordsService.findById.mockResolvedValue(createWorkAggregateFixture());

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: '95f2a1ca-f820-4126-9db4-c6ee3551ae53',
          entityType: 'work',
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'update',
          createdAt: '2026-04-18T01:05:00.000Z',
          payload: createSyncPayload(),
        },
      ],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'applied',
        code: 'already_applied',
        message: 'Remote record already matches the queued change.',
        work: expect.objectContaining({
          id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          serverVersion: 3,
        }),
      }),
    ]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('handles lost network response retries by deduplicating the same work clientMutationId', async () => {
    const idempotencyRecords = new Map<string, Record<string, unknown>>();
    prisma.userSyncAppliedMutation.findUnique.mockImplementation(
      async ({ where }: any) =>
        idempotencyRecords.get(
          `${where.userId_clientMutationId.userId}:${where.userId_clientMutationId.clientMutationId}`,
        ) ?? null,
    );
    prisma.userSyncAppliedMutation.create.mockImplementation(
      async ({ data }: any) => {
        const record = { ...data };
        idempotencyRecords.set(
          `${data.userId}:${data.clientMutationId}`,
          record,
        );

        return record;
      },
    );
    userRecordsService.findById.mockResolvedValue(createWorkAggregateFixture());
    userRecordsService.update.mockResolvedValue(
      createWorkAggregateFixture({
        catalogWork: {
          ...createWorkAggregateFixture().catalogWork,
          title: 'Dune Messiah',
        },
        serverVersion: 4,
      }),
    );

    const pushBody = {
      changes: [
        {
          queueId: 'de034913-d0d0-47fb-bf62-db2a662e4e68',
          clientMutationId: '4f392746-389b-457f-8801-5c821b643bde',
          entityType: 'work' as const,
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'update' as const,
          createdAt: '2026-04-18T02:00:00.000Z',
          payload: createSyncPayload({
            title: 'Dune Messiah',
            updatedAt: '2026-04-18T02:00:00.000Z',
          }),
        },
      ],
    };

    const first = await service.push(USER_ID, pushBody);
    const second = await service.push(USER_ID, pushBody);

    expect(first.results[0]).toEqual(
      expect.objectContaining({
        code: 'applied_change',
        status: 'applied',
      }),
    );
    expect(second.results[0]).toEqual(
      expect.objectContaining({
        code: 'already_applied',
        status: 'applied',
        work: expect.objectContaining({
          title: 'Dune Messiah',
          serverVersion: 4,
        }),
      }),
    );
    expect(userRecordsService.update).toHaveBeenCalledTimes(1);
    expect(prisma.userSyncAppliedMutation.create).toHaveBeenCalledTimes(1);
    expect(idempotencyRecords.size).toBe(1);
  });

  it('rejects reused clientMutationId values when the payload changes', async () => {
    const idempotencyRecords = new Map<string, Record<string, unknown>>();
    prisma.userSyncAppliedMutation.findUnique.mockImplementation(
      async ({ where }: any) =>
        idempotencyRecords.get(
          `${where.userId_clientMutationId.userId}:${where.userId_clientMutationId.clientMutationId}`,
        ) ?? null,
    );
    prisma.userSyncAppliedMutation.create.mockImplementation(
      async ({ data }: any) => {
        const record = { ...data };
        idempotencyRecords.set(
          `${data.userId}:${data.clientMutationId}`,
          record,
        );

        return record;
      },
    );
    userRecordsService.findById.mockResolvedValue(createWorkAggregateFixture());
    userRecordsService.update.mockResolvedValue(createWorkAggregateFixture());

    const baseChange = {
      queueId: 'de034913-d0d0-47fb-bf62-db2a662e4e68',
      clientMutationId: '4f392746-389b-457f-8801-5c821b643bde',
      entityType: 'work' as const,
      entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      operation: 'update' as const,
      createdAt: '2026-04-18T02:00:00.000Z',
      payload: createSyncPayload({
        shortReview: 'first',
        updatedAt: '2026-04-18T02:00:00.000Z',
      }),
    };

    const first = await service.push(USER_ID, { changes: [baseChange] });
    const second = await service.push(USER_ID, {
      changes: [
        {
          ...baseChange,
          payload: createSyncPayload({
            shortReview: 'changed',
            updatedAt: '2026-04-18T02:00:00.000Z',
          }),
        },
      ],
    });

    expect(first.results[0]).toEqual(
      expect.objectContaining({
        status: 'applied',
      }),
    );
    expect(second.results[0]).toEqual(
      expect.objectContaining({
        code: 'failed_client_mutation_reused',
        status: 'failed',
      }),
    );
    expect(userRecordsService.update).toHaveBeenCalledTimes(1);
  });

  it('stores deterministic validation failures for replay', async () => {
    const idempotencyRecords = new Map<string, Record<string, unknown>>();
    prisma.userSyncAppliedMutation.findUnique.mockImplementation(
      async ({ where }: any) =>
        idempotencyRecords.get(
          `${where.userId_clientMutationId.userId}:${where.userId_clientMutationId.clientMutationId}`,
        ) ?? null,
    );
    prisma.userSyncAppliedMutation.create.mockImplementation(
      async ({ data }: any) => {
        const record = { ...data };
        idempotencyRecords.set(
          `${data.userId}:${data.clientMutationId}`,
          record,
        );

        return record;
      },
    );

    const pushBody = {
      changes: [
        {
          queueId: '26d60e20-4258-4480-a3ad-becf9ce0fe30',
          clientMutationId: 'f55ebb17-62ff-4424-9f4e-67111b3c7936',
          entityType: 'work' as const,
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'update' as const,
          createdAt: '2026-04-18T02:00:00.000Z',
          payload: {
            ...createSyncPayload(),
            id: '1f6055fa-0ac9-4ac8-a30a-6c957dc5b465',
          },
        },
      ],
    };

    const first = await service.push(USER_ID, pushBody);
    const second = await service.push(USER_ID, pushBody);

    expect(first.results[0]).toEqual(
      expect.objectContaining({
        code: 'failed_validation',
        status: 'failed',
      }),
    );
    expect(second.results[0]).toEqual(first.results[0]);
    expect(prisma.userSyncAppliedMutation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
          resultStatus: 'failed',
        }),
      }),
    );
  });

  it('handles lost network response retries by deduplicating the same tier_board clientMutationId', async () => {
    const idempotencyRecords = new Map<string, Record<string, unknown>>();
    prisma.userSyncAppliedMutation.findUnique.mockImplementation(
      async ({ where }: any) =>
        idempotencyRecords.get(
          `${where.userId_clientMutationId.userId}:${where.userId_clientMutationId.clientMutationId}`,
        ) ?? null,
    );
    prisma.userSyncAppliedMutation.create.mockImplementation(
      async ({ data }: any) => {
        const record = { ...data };
        idempotencyRecords.set(
          `${data.userId}:${data.clientMutationId}`,
          record,
        );

        return record;
      },
    );
    prisma.userTierBoard.findUnique.mockResolvedValue(null);
    prisma.userTierBoard.create.mockImplementation(async ({ data }: any) => ({
      ...data,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }));

    const pushBody = {
      changes: [
        {
          queueId: '93f835f1-306b-4414-927e-348e5bbb8f43',
          clientMutationId: '5354f467-b376-4a09-a657-0429e93a91a2',
          entityType: 'tier_board' as const,
          entityId: 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901',
          operation: 'create' as const,
          createdAt: '2026-04-18T00:00:00.000Z',
          payload: createTierBoardPayload(),
        },
      ],
    };

    const first = await service.push(USER_ID, pushBody);
    const second = await service.push(USER_ID, pushBody);

    expect(first.results[0]).toEqual(
      expect.objectContaining({
        code: 'created',
        status: 'applied',
      }),
    );
    expect(second.results[0]).toEqual(
      expect.objectContaining({
        code: 'already_applied',
        status: 'applied',
        tierBoard: expect.objectContaining({
          id: 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901',
          title: 'Favorites',
        }),
      }),
    );
    expect(prisma.userTierBoard.create).toHaveBeenCalledTimes(1);
    expect(prisma.userSyncAppliedMutation.create).toHaveBeenCalledTimes(1);
    expect(idempotencyRecords.size).toBe(1);
  });

  it('rolls back sync entity writes when the idempotency record write fails in the transaction', async () => {
    const committed = {
      boards: [] as Record<string, unknown>[],
      idempotencyRecords: [] as Record<string, unknown>[],
    };
    const entityCreate = jest.fn(async ({ data }: any) => data);

    prisma.$transaction.mockImplementation(
      async (callback: (client: any) => Promise<any>) => {
        const pending = {
          boards: [] as Record<string, unknown>[],
          idempotencyRecords: [] as Record<string, unknown>[],
        };
        const tx = {
          ...prisma,
          userSyncAppliedMutation: {
            findUnique: jest.fn(async () => null),
            create: jest.fn(async ({ data }: any) => {
              pending.idempotencyRecords.push(data);
              throw new Error(
                'refresh_token access_token api_key raw_image_data',
              );
            }),
          },
          userTierBoard: {
            ...prisma.userTierBoard,
            findUnique: jest.fn(async () => null),
            create: jest.fn(async ({ data }: any) => {
              pending.boards.push(data);

              return entityCreate({ data });
            }),
          },
        };

        const result = await callback(tx);
        committed.boards.push(...pending.boards);
        committed.idempotencyRecords.push(...pending.idempotencyRecords);

        return result;
      },
    );

    await expect(
      service.push(USER_ID, {
        changes: [
          {
            queueId: '52e614a4-080f-4955-9166-77987bc29942',
            clientMutationId: 'b8d13e1f-fceb-43ff-a5da-b1d29ed691eb',
            entityType: 'tier_board',
            entityId: 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901',
            operation: 'create',
            createdAt: '2026-04-18T00:00:00.000Z',
            payload: createTierBoardPayload(),
          },
        ],
      }),
    ).rejects.toThrow('refresh_token');

    expect(entityCreate).toHaveBeenCalledTimes(1);
    expect(committed.boards).toHaveLength(0);
    expect(committed.idempotencyRecords).toHaveLength(0);
  });

  it('does not commit an idempotency record when the sync entity write fails in the transaction', async () => {
    const committed = {
      boards: [] as Record<string, unknown>[],
      idempotencyRecords: [] as Record<string, unknown>[],
    };
    const idempotencyCreate = jest.fn(async ({ data }: any) => data);

    prisma.$transaction.mockImplementation(
      async (callback: (client: any) => Promise<any>) => {
        const pending = {
          boards: [] as Record<string, unknown>[],
          idempotencyRecords: [] as Record<string, unknown>[],
        };
        const tx = {
          ...prisma,
          userSyncAppliedMutation: {
            findUnique: jest.fn(async () => null),
            create: jest.fn(async ({ data }: any) => {
              pending.idempotencyRecords.push(data);

              return idempotencyCreate({ data });
            }),
          },
          userTierBoard: {
            ...prisma.userTierBoard,
            findUnique: jest.fn(async () => null),
            create: jest.fn(async () => {
              throw new Error(
                'authorization cookie set-cookie oauth_code api_key',
              );
            }),
          },
        };

        const result = await callback(tx);
        committed.boards.push(...pending.boards);
        committed.idempotencyRecords.push(...pending.idempotencyRecords);

        return result;
      },
    );

    await expect(
      service.push(USER_ID, {
        changes: [
          {
            queueId: 'f022e7f8-a7af-448a-8b01-c3088cc63835',
            clientMutationId: '884c1bb1-a41f-42de-a028-98a82b98d789',
            entityType: 'tier_board',
            entityId: 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901',
            operation: 'create',
            createdAt: '2026-04-18T00:00:00.000Z',
            payload: createTierBoardPayload(),
          },
        ],
      }),
    ).rejects.toThrow('authorization');

    expect(idempotencyCreate).not.toHaveBeenCalled();
    expect(committed.boards).toHaveLength(0);
    expect(committed.idempotencyRecords).toHaveLength(0);
  });

  it('logs sync.push.failed without sensitive request or token material', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    prisma.$transaction.mockRejectedValue(
      new Error(
        'authorization cookie set-cookie refresh_token access_token oauth_code api_key raw_image_data',
      ),
    );

    await expect(
      service.push(
        USER_ID,
        {
          changes: [
            {
              queueId: 'bd0ce1c4-c9f1-4d05-8204-079722e0e53b',
              clientMutationId: '5673ea84-5e2e-4abf-9a9a-9f54949054fe',
              entityType: 'work',
              entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
              operation: 'update',
              createdAt: '2026-04-18T02:00:00.000Z',
              payload: createSyncPayload(),
            },
          ],
        },
        'req-sync-redaction',
      ),
    ).rejects.toThrow('authorization');

    const failedLog = logSpy.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .find((message: string) =>
        message.includes('"event":"sync.push.failed"'),
      );

    expect(failedLog).toBeDefined();
    expect(JSON.parse(failedLog!)).toEqual(
      expect.objectContaining({
        durationMs: expect.any(Number),
        errorCode: 'Error',
        event: 'sync.push.failed',
        requestId: 'req-sync-redaction',
        userId: USER_ID,
      }),
    );
    expect(`${failedLog} ${warnSpy.mock.calls.flat().join(' ')}`).not.toMatch(
      /authorization|cookie|set-cookie|refresh_token|access_token|oauth_code|api_key|raw_image_data/i,
    );
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('rejects tier_lane sync when the parent board belongs to another user or is deleted', async () => {
    for (const board of [
      {
        id: 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901',
        userId: OTHER_USER_ID,
        deletedAt: null,
      },
      {
        id: 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901',
        userId: USER_ID,
        deletedAt: new Date('2026-04-18T01:00:00.000Z'),
      },
    ]) {
      prisma.userTierBoard.findUnique.mockResolvedValueOnce(board);

      const result = await service.push(USER_ID, {
        changes: [
          {
            queueId: crypto.randomUUID(),
            clientMutationId: crypto.randomUUID(),
            entityType: 'tier_lane',
            entityId: '877fb270-a90b-445f-bc7e-eec9611b6b1d',
            operation: 'create',
            createdAt: '2026-04-18T00:00:00.000Z',
            payload: createTierLanePayload(),
          },
        ],
      });

      expect(result.results[0]).toEqual(
        expect.objectContaining({
          code: 'conflict_parent_changed',
          status: 'conflict',
        }),
      );
    }

    expect(prisma.userTierLane.create).not.toHaveBeenCalled();
    expect(prisma.userSyncAppliedMutation.create).toHaveBeenCalledTimes(2);
    expect(prisma.userSyncAppliedMutation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resultStatus: 'conflict',
        }),
      }),
    );
  });

  it('syncs tier_board_card source work metadata without requiring active WorkRecord', async () => {
    prisma.userTierBoard.findUnique.mockResolvedValue({
      id: 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901',
      userId: USER_ID,
      deletedAt: null,
    });
    prisma.userTierLane.findUnique.mockResolvedValue({
      id: '877fb270-a90b-445f-bc7e-eec9611b6b1d',
      boardId: 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901',
      userId: USER_ID,
      deletedAt: null,
      board: {
        userId: USER_ID,
      },
    });
    prisma.userTierBoardCard.create.mockImplementation(
      async ({ data }: any) => ({
        ...data,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        deletedAt: data.deletedAt,
        serverVersion: data.serverVersion,
      }),
    );

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: '7eab94e4-45b4-4c03-8e79-89f73847487a',
          clientMutationId: 'f5a70a08-9339-48c4-9a66-34f32c6fa0a0',
          entityType: 'tier_board_card',
          entityId: '0cb7bbce-0885-468f-ab6b-b66d646b78ec',
          operation: 'create',
          createdAt: '2026-04-18T00:00:00.000Z',
          payload: createTierBoardCardPayload(),
        },
      ],
    });

    expect(result.results[0]).toEqual(
      expect.objectContaining({
        code: 'created',
        status: 'applied',
        tierBoardCard: expect.objectContaining({
          workId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
        }),
      }),
    );
    expect(prisma.userTierBoardCard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userWorkId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
        }),
      }),
    );
    expect(prisma.userWorkRecord.findUnique).not.toHaveBeenCalled();
    expect(prisma.userWorkRecord.update).not.toHaveBeenCalled();
    expect(userRecordsService.update).not.toHaveBeenCalled();
  });

  it('rejects tier_board_asset sync when the parent card belongs to another user or is deleted', async () => {
    prisma.userTierBoard.findUnique.mockResolvedValue({
      id: 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901',
      userId: USER_ID,
      deletedAt: null,
    });

    for (const card of [
      {
        id: '0cb7bbce-0885-468f-ab6b-b66d646b78ec',
        boardId: 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901',
        deletedAt: null,
        board: {
          userId: OTHER_USER_ID,
        },
      },
      {
        id: '0cb7bbce-0885-468f-ab6b-b66d646b78ec',
        boardId: 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901',
        deletedAt: new Date('2026-04-18T01:00:00.000Z'),
        board: {
          userId: USER_ID,
        },
      },
    ]) {
      prisma.userTierBoardCard.findUnique.mockResolvedValueOnce(card);

      const result = await service.push(USER_ID, {
        changes: [
          {
            queueId: crypto.randomUUID(),
            clientMutationId: crypto.randomUUID(),
            entityType: 'tier_board_asset',
            entityId: 'dc42d556-13a5-4b28-897c-5c79d68a7f79',
            operation: 'create',
            createdAt: '2026-04-18T00:00:00.000Z',
            payload: createTierBoardAssetPayload(),
          },
        ],
      });

      expect(result.results[0]).toEqual(
        expect.objectContaining({
          code: 'conflict_parent_changed',
          status: 'conflict',
        }),
      );
    }

    expect(prisma.userTierBoardAsset.create).not.toHaveBeenCalled();
    expect(prisma.userSyncAppliedMutation.create).toHaveBeenCalledTimes(2);
    expect(prisma.userSyncAppliedMutation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resultStatus: 'conflict',
        }),
      }),
    );
  });

  it('creates a missing remote record for a local-only payload and assigns the authenticated owner', async () => {
    const importedId = '33333333-3333-4333-8333-333333333333';

    userRecordsService.findById.mockResolvedValue(null);
    userRecordsService.create.mockResolvedValue(
      createWorkAggregateFixture({
        id: importedId,
        catalogTitleId: importedId,
        catalogWorkId: importedId,
        serverVersion: 1,
        createdAt: new Date('2026-04-18T00:00:00.000Z'),
        updatedAt: new Date('2026-04-18T00:00:00.000Z'),
        catalogWork: {
          ...createWorkAggregateFixture().catalogWork,
          id: importedId,
          title: 'Imported Dune',
          createdAt: new Date('2026-04-18T00:00:00.000Z'),
          updatedAt: new Date('2026-04-18T00:00:00.000Z'),
        },
      }),
    );

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: 'eab7b702-fab8-43d0-9170-175f4bc5f713',
          entityType: 'work',
          entityId: importedId,
          operation: 'create',
          createdAt: '2026-04-18T00:00:00.000Z',
          payload: createSyncPayload({
            id: importedId,
            title: 'Imported Dune',
            personalTags: ['다시 볼 것'],
            createdAt: '2026-04-18T00:00:00.000Z',
            updatedAt: '2026-04-18T00:00:00.000Z',
            syncStatus: 'local-only',
            serverVersion: 0,
          }),
        },
      ],
    });

    expect(catalogService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: importedId,
        title: 'Imported Dune',
      }),
      expect.any(Object),
    );
    expect(
      catalogService.createTitleFromImportCandidate,
    ).not.toHaveBeenCalled();
    expect(userRecordsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: importedId,
        userId: USER_ID,
        catalogWorkId: importedId,
        serverVersion: 1,
        personalTags: ['다시 볼 것'],
      }),
      expect.any(Object),
    );
    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'applied',
        code: 'created',
        work: expect.objectContaining({
          id: importedId,
          title: 'Imported Dune',
          serverVersion: 1,
        }),
      }),
    ]);
  });

  it('creates a missing remote record against an existing catalog title when catalogTitleId is present', async () => {
    const importedId = '44444444-4444-4444-8444-444444444444';

    userRecordsService.findById.mockResolvedValue(null);
    prisma.catalogTitle.findUnique.mockResolvedValue({
      id: CATALOG_TITLE_ID,
      displayTitle: 'Dune',
      mediumType: WorkType.novel,
      summary: 'A desert saga.',
      thumbnailUrl: 'https://image.example/dune.jpg',
      contributors: [
        {
          contributor: {
            displayName: 'Frank Herbert',
          },
        },
      ],
    });
    userRecordsService.create.mockResolvedValue(
      createWorkAggregateFixture({
        id: importedId,
        catalogTitleId: CATALOG_TITLE_ID,
        catalogWorkId: importedId,
        serverVersion: 1,
        catalogWork: {
          ...createWorkAggregateFixture().catalogWork,
          id: importedId,
          title: 'Dune',
          author: 'Frank Herbert',
        },
      }),
    );

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: 'f6a51b9d-0471-49b0-97ab-5fbe58af06d8',
          entityType: 'work',
          entityId: importedId,
          operation: 'create',
          createdAt: '2026-04-18T00:00:00.000Z',
          payload: createSyncPayload({
            id: importedId,
            catalogTitleId: CATALOG_TITLE_ID,
            title: 'Dune',
            author: '',
            description: '',
            thumbnailUrl: '',
            createdAt: '2026-04-18T00:00:00.000Z',
            updatedAt: '2026-04-18T00:00:00.000Z',
            syncStatus: 'local-only',
            serverVersion: 0,
          }),
        },
      ],
    });

    expect(prisma.catalogTitle.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: CATALOG_TITLE_ID,
        },
      }),
    );
    expect(prisma.catalogWork.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: importedId,
          title: 'Dune',
          author: 'Frank Herbert',
        }),
      }),
    );
    expect(userRecordsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: importedId,
        catalogTitleId: CATALOG_TITLE_ID,
        catalogWorkId: importedId,
        userId: USER_ID,
      }),
      expect.any(Object),
    );
    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'applied',
        work: expect.objectContaining({
          id: importedId,
          catalogTitleId: CATALOG_TITLE_ID,
        }),
      }),
    ]);
  });

  it('fails a sync create when catalogTitleId points to a missing catalog title', async () => {
    const importedId = '44444444-4444-4444-8444-444444444445';

    userRecordsService.findById.mockResolvedValue(null);
    prisma.catalogTitle.findUnique.mockResolvedValue(null);

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: 'f6a51b9d-0471-49b0-97ab-5fbe58af06d9',
          entityType: 'work',
          entityId: importedId,
          operation: 'create',
          createdAt: '2026-04-18T00:00:00.000Z',
          payload: createSyncPayload({
            id: importedId,
            catalogTitleId: MISSING_CATALOG_TITLE_ID,
            title: 'Missing Catalog Title',
            createdAt: '2026-04-18T00:00:00.000Z',
            updatedAt: '2026-04-18T00:00:00.000Z',
            syncStatus: 'local-only',
            serverVersion: 0,
          }),
        },
      ],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'failed',
        code: 'failed_missing_catalog_title',
        message: `Catalog title with id "${MISSING_CATALOG_TITLE_ID}" was not found.`,
        work: null,
      }),
    ]);
    expect(prisma.catalogWork.create).not.toHaveBeenCalled();
    expect(userRecordsService.create).not.toHaveBeenCalled();
  });

  it('creates or reuses a catalog title from importDraft before creating the missing remote record', async () => {
    const importedId = '55555555-5555-4555-8555-555555555555';

    userRecordsService.findById.mockResolvedValue(null);
    catalogService.createTitleFromImportCandidate.mockResolvedValue({
      id: IMPORTED_CATALOG_TITLE_ID,
    } as Awaited<ReturnType<CatalogService['createTitleFromImportCandidate']>>);
    userRecordsService.create.mockResolvedValue(
      createWorkAggregateFixture({
        id: importedId,
        catalogTitleId: IMPORTED_CATALOG_TITLE_ID,
        catalogWorkId: importedId,
        serverVersion: 1,
        catalogWork: {
          ...createWorkAggregateFixture().catalogWork,
          id: importedId,
          title: 'Dune',
          author: 'Frank Herbert',
        },
      }),
    );

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: 'dab74906-b392-4d52-afb1-349c315af930',
          entityType: 'work',
          entityId: importedId,
          operation: 'create',
          createdAt: '2026-04-18T00:00:00.000Z',
          payload: createSyncPayload({
            id: importedId,
            title: 'Dune',
            author: 'Frank Herbert',
            description: 'A desert saga.',
            thumbnailUrl: 'https://image.example/dune.jpg',
            createdAt: '2026-04-18T00:00:00.000Z',
            updatedAt: '2026-04-18T00:00:00.000Z',
            syncStatus: 'local-only',
            serverVersion: 0,
            importDraft: {
              catalogTitle: 'Dune',
              mediumType: WorkType.novel,
              franchiseName: 'Dune',
              subType: 'science_fiction',
              releaseYear: 2026,
              contributors: [{ name: 'Frank Herbert' }],
              externalRefs: [
                {
                  provider: 'aladin',
                  externalId: '123',
                  rawType: 'novel',
                  url: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=123',
                },
              ],
              releaseCandidates: [
                {
                  displayLabel: 'Volume 1',
                  externalRefs: [
                    {
                      provider: 'aladin',
                      externalId: '123-1',
                      rawType: 'volume',
                      url: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=123-1',
                    },
                  ],
                  isbn: '9781234567890',
                  releaseDate: '2026-04-18',
                  releaseType: 'volume',
                  sequence: 1,
                  thumbnailUrl: 'https://image.example/dune-volume-1.jpg',
                  title: 'Dune Volume 1',
                },
              ],
            },
          }),
        },
      ],
    });

    expect(catalogService.createTitleFromImportCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalTitle: 'Dune',
        displayTitle: 'Dune',
        mediumType: WorkType.novel,
        franchiseName: 'Dune',
        subType: 'science_fiction',
        releaseYear: 2026,
        summary: 'A desert saga.',
        thumbnailUrl: 'https://image.example/dune.jpg',
      }),
      expect.any(Object),
    );
    expect(
      catalogService.createTitleFromImportCandidate.mock.calls[0]?.[0],
    ).toEqual(
      expect.objectContaining({
        externalRefs: [
          {
            provider: 'aladin',
            externalId: '123',
            rawType: 'novel',
            url: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=123',
          },
        ],
        releaseCandidates: [
          expect.objectContaining({
            displayLabel: expect.any(String),
            externalRefs: [
              {
                provider: 'aladin',
                externalId: '123-1',
                rawType: 'volume',
                url: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=123-1',
              },
            ],
            isbn: '9781234567890',
            releaseDate: '2026-04-18',
            releaseType: 'volume',
            sequence: 1,
            thumbnailUrl: 'https://image.example/dune-volume-1.jpg',
            title: expect.any(String),
          }),
        ],
      }),
    );
    expect(prisma.catalogWork.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: importedId,
          title: 'Dune',
          author: 'Frank Herbert',
        }),
      }),
    );
    expect(userRecordsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: importedId,
        catalogTitleId: IMPORTED_CATALOG_TITLE_ID,
        catalogWorkId: importedId,
        userId: USER_ID,
      }),
      expect.any(Object),
    );
    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'applied',
        work: expect.objectContaining({
          id: importedId,
          catalogTitleId: IMPORTED_CATALOG_TITLE_ID,
        }),
      }),
    ]);
  });

  it('falls back to payload.title when importDraft.catalogTitle is missing', async () => {
    const importedId = '55555555-5555-4555-8555-555555555556';

    userRecordsService.findById.mockResolvedValue(null);
    catalogService.createTitleFromImportCandidate.mockResolvedValue({
      id: PAYLOAD_TITLE_CATALOG_TITLE_ID,
    } as Awaited<ReturnType<CatalogService['createTitleFromImportCandidate']>>);
    userRecordsService.create.mockResolvedValue(
      createWorkAggregateFixture({
        id: importedId,
        catalogTitleId: PAYLOAD_TITLE_CATALOG_TITLE_ID,
        catalogWorkId: importedId,
        serverVersion: 1,
      }),
    );

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: 'dab74906-b392-4d52-afb1-349c315af931',
          entityType: 'work',
          entityId: importedId,
          operation: 'create',
          createdAt: '2026-04-18T00:00:00.000Z',
          payload: createSyncPayload({
            id: importedId,
            title: 'Payload Title Fallback',
            createdAt: '2026-04-18T00:00:00.000Z',
            updatedAt: '2026-04-18T00:00:00.000Z',
            syncStatus: 'local-only',
            serverVersion: 0,
            importDraft: {
              mediumType: WorkType.novel,
              franchiseName: 'Dune',
              contributors: [{ name: 'Fallback Author' }],
              externalRefs: [
                {
                  provider: 'aladin',
                  externalId: 'payload-fallback',
                  rawType: 'novel',
                  url: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=payload-fallback',
                },
              ],
            },
          }),
        },
      ],
    });

    expect(catalogService.createTitleFromImportCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalTitle: 'Payload Title Fallback',
        displayTitle: 'Payload Title Fallback',
      }),
      expect.any(Object),
    );
    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'applied',
        work: expect.objectContaining({
          id: importedId,
          catalogTitleId: PAYLOAD_TITLE_CATALOG_TITLE_ID,
        }),
      }),
    ]);
  });

  it('fails when importDraft.catalogTitle and payload.title are both blank', async () => {
    const importedId = '55555555-5555-4555-8555-555555555557';

    userRecordsService.findById.mockResolvedValue(null);

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: 'dab74906-b392-4d52-afb1-349c315af932',
          entityType: 'work',
          entityId: importedId,
          operation: 'create',
          createdAt: '2026-04-18T00:00:00.000Z',
          payload: createSyncPayload({
            id: importedId,
            title: '   ',
            createdAt: '2026-04-18T00:00:00.000Z',
            updatedAt: '2026-04-18T00:00:00.000Z',
            syncStatus: 'local-only',
            serverVersion: 0,
            importDraft: {
              catalogTitle: '   ',
              mediumType: WorkType.novel,
            },
          }),
        },
      ],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'failed',
        code: 'failed_validation',
        message: expect.stringContaining('Invalid work sync payload'),
      }),
    ]);
    expect(
      catalogService.createTitleFromImportCandidate,
    ).not.toHaveBeenCalled();
    expect(prisma.catalogWork.create).not.toHaveBeenCalled();
    expect(userRecordsService.create).not.toHaveBeenCalled();
  });

  it('applies tombstone payloads and increments the server version', async () => {
    userRecordsService.findById.mockResolvedValue(createWorkAggregateFixture());
    userRecordsService.update.mockResolvedValue(
      createWorkAggregateFixture({
        deletedAt: new Date('2026-04-18T02:00:00.000Z'),
        updatedAt: new Date('2026-04-18T02:00:00.000Z'),
        serverVersion: 4,
      }),
    );

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: '5a3ea445-68dc-4842-a62d-7e3d36f1b045',
          entityType: 'work',
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'delete',
          createdAt: '2026-04-18T02:00:00.000Z',
          payload: createSyncPayload({
            deletedAt: '2026-04-18T02:00:00.000Z',
            personalTags: ['보관'],
            updatedAt: '2026-04-18T02:00:00.000Z',
          }),
        },
      ],
    });

    expect(userRecordsService.update).toHaveBeenCalledWith(
      '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      expect.objectContaining({
        deletedAt: new Date('2026-04-18T02:00:00.000Z'),
        personalTags: ['보관'],
        syncStatus: WorkSyncStatus.synced,
        serverVersion: {
          increment: 1,
        },
      }),
      expect.any(Object),
    );
    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'applied',
        code: 'applied_tombstone',
        message: 'Queued tombstone applied on the server.',
        work: expect.objectContaining({
          deletedAt: new Date('2026-04-18T02:00:00.000Z'),
          serverVersion: 4,
        }),
      }),
    ]);
  });

  it('keeps the incoming pull cursor when there are no newer records', async () => {
    const result = await service.pull(USER_ID, {
      since: '2026-04-18T00:00:00.000Z',
    });

    expect(result).toEqual(
      expect.objectContaining({
        schemaVersion: 5,
        nextSince: '2026-04-18T00:00:00.000Z',
        changes: [],
      }),
    );
  });

  it('treats a local-only delete for a missing remote record as a no-op', async () => {
    userRecordsService.findById.mockResolvedValue(null);

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: '95f2a1ca-f820-4126-9db4-c6ee3551ae55',
          entityType: 'work',
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'delete',
          createdAt: '2026-04-18T00:30:00.000Z',
          payload: {
            ...createSyncPayload(),
            updatedAt: '2026-04-18T00:30:00.000Z',
            deletedAt: '2026-04-18T00:30:00.000Z',
            serverVersion: 0,
          },
        },
      ],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'applied',
        code: 'missing_remote_delete_noop',
        message:
          'Remote delete was a no-op because the server record is missing.',
        work: null,
      }),
    ]);
    expect(catalogService.create).not.toHaveBeenCalled();
    expect(userRecordsService.create).not.toHaveBeenCalled();
  });

  it('returns a conflict when a previously synced delete targets a missing remote record', async () => {
    userRecordsService.findById.mockResolvedValue(null);

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: '95f2a1ca-f820-4126-9db4-c6ee3551ae53',
          entityType: 'work',
          entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          operation: 'delete',
          createdAt: '2026-04-18T00:30:00.000Z',
          payload: {
            ...createSyncPayload(),
            updatedAt: '2026-04-18T00:30:00.000Z',
            deletedAt: '2026-04-18T00:30:00.000Z',
            serverVersion: 2,
          },
        },
      ],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'conflict',
        code: 'conflict_remote_missing',
        message: expect.stringContaining('already missing remotely'),
        work: null,
      }),
    ]);
    expect(catalogService.create).not.toHaveBeenCalled();
    expect(userRecordsService.create).not.toHaveBeenCalled();
  });

  it('pushes a local series graph record as a private user entity', async () => {
    const createdSeries = createUserSeriesFixture();
    prisma.userSeries.findUnique.mockResolvedValue(null);
    prisma.userSeries.create.mockResolvedValue(createdSeries);

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: 'graph-series-queue-1',
          entityType: 'series',
          entityId: createdSeries.id,
          operation: 'create',
          createdAt: '2026-04-18T00:30:00.000Z',
          payload: createSyncSeriesPayload(),
        },
      ],
    });

    expect(prisma.userSeries.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: createdSeries.id,
          userId: USER_ID,
          title: 'Fate',
          normalizedTitle: 'fate',
          serverVersion: 1,
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        schemaVersion: 5,
        results: [
          expect.objectContaining({
            entityType: 'series',
            status: 'applied',
            code: 'created',
            series: expect.objectContaining({
              id: createdSeries.id,
              title: 'Fate',
              syncStatus: 'synced',
              serverVersion: 1,
            }),
          }),
        ],
      }),
    );
  });

  it('rejects a work-series link when the parent work or series is missing', async () => {
    prisma.userWorkSeriesLink.findUnique.mockResolvedValue(null);
    userRecordsService.findById.mockResolvedValue(null);
    prisma.userSeries.findFirst.mockResolvedValue(createUserSeriesFixture());

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: 'graph-link-queue-1',
          entityType: 'work_series_link',
          entityId: '4a822eea-c1c9-40d3-b18c-b4d35a75b0f3',
          operation: 'create',
          createdAt: '2026-04-18T00:30:00.000Z',
          payload: {
            id: '4a822eea-c1c9-40d3-b18c-b4d35a75b0f3',
            workId: '33333333-3333-4333-8333-333333333333',
            seriesId: '9b9632f1-0f52-4fb3-afcf-323d99bde595',
            role: 'main',
            orderIndex: null,
            orderLabel: '',
            createdAt: '2026-04-18T00:00:00.000Z',
            updatedAt: '2026-04-18T00:30:00.000Z',
            deletedAt: null,
            syncStatus: 'local-only',
            serverVersion: 0,
          } satisfies SyncWorkSeriesLinkPayloadDto,
        },
      ],
    });

    expect(prisma.userWorkSeriesLink.create).not.toHaveBeenCalled();
    expect(result.results).toEqual([
      expect.objectContaining({
        entityType: 'work_series_link',
        status: 'failed',
        code: 'failed_validation',
        message: expect.stringContaining('parent work is missing'),
        workSeriesLink: null,
      }),
    ]);
  });

  it('pushes a local release record for volume-recordable titles only', async () => {
    const parent = createWorkAggregateFixture({
      catalogTitleId: CATALOG_TITLE_ID,
      catalogWork: {
        ...createWorkAggregateFixture().catalogWork,
        type: WorkType.light_novel,
      },
      catalogTitle: {
        mediumType: WorkType.light_novel,
      } as never,
    });
    userRecordsService.findById.mockResolvedValue(parent);
    releaseRecordsService.findById
      .mockImplementationOnce(async () => null)
      .mockImplementationOnce(async () =>
        createReleaseRecordAggregateFixture(),
      );
    prisma.catalogRelease.findFirst.mockResolvedValue({
      id: '5f7ac03a-0679-4e63-a62d-0d04b5e72a23',
      catalogTitleId: CATALOG_TITLE_ID,
    });
    prisma.userReleaseRecord.create.mockResolvedValue({
      id: '7fb84ae9-6821-4d68-bb89-2f51f0dd9e11',
    });

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: 'ce8e1f64-3070-4cb9-bdf4-2df15a925826',
          entityType: 'release_record',
          entityId: '7fb84ae9-6821-4d68-bb89-2f51f0dd9e11',
          operation: 'create',
          createdAt: '2026-04-18T01:00:00.000Z',
          payload: createReleaseRecordPayload(),
        },
      ],
    });

    expect(prisma.userReleaseRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          catalogReleaseId: '5f7ac03a-0679-4e63-a62d-0d04b5e72a23',
          userWorkRecordId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
        }),
      }),
    );
    expect(result.results).toEqual([
      expect.objectContaining({
        entityType: 'release_record',
        status: 'applied',
        code: 'created',
        releaseRecord: expect.objectContaining({
          catalogReleaseId: '5f7ac03a-0679-4e63-a62d-0d04b5e72a23',
        }),
      }),
    ]);
  });

  it('returns a conflict when a release-record parent changed remotely', async () => {
    releaseRecordsService.findById.mockResolvedValue(
      createReleaseRecordAggregateFixture({
        userWorkRecordId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
    );

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: 'ce8e1f64-3070-4cb9-bdf4-2df15a925827',
          entityType: 'release_record',
          entityId: '7fb84ae9-6821-4d68-bb89-2f51f0dd9e11',
          operation: 'update',
          createdAt: '2026-04-18T01:00:00.000Z',
          payload: createReleaseRecordPayload(),
        },
      ],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        entityType: 'release_record',
        status: 'conflict',
        code: 'conflict_parent_changed',
        message: 'Server mismatch: release record parent or release changed.',
        releaseRecord: expect.objectContaining({
          userWorkRecordId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        }),
      }),
    ]);
    expect(releaseRecordsService.update).not.toHaveBeenCalled();
  });

  it('rejects release-record sync for progress-only anime titles', async () => {
    const parent = createWorkAggregateFixture({
      catalogTitleId: CATALOG_TITLE_ID,
      catalogWork: {
        ...createWorkAggregateFixture().catalogWork,
        type: WorkType.anime,
      },
      catalogTitle: {
        mediumType: WorkType.anime,
      } as never,
    });
    userRecordsService.findById.mockResolvedValue(parent);
    releaseRecordsService.findById.mockImplementation(async () => null);

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: 'ce8e1f64-3070-4cb9-bdf4-2df15a925826',
          entityType: 'release_record',
          entityId: '7fb84ae9-6821-4d68-bb89-2f51f0dd9e11',
          operation: 'create',
          createdAt: '2026-04-18T01:00:00.000Z',
          payload: createReleaseRecordPayload(),
        },
      ],
    });

    expect(prisma.userReleaseRecord.create).not.toHaveBeenCalled();
    expect(result.results).toEqual([
      expect.objectContaining({
        entityType: 'release_record',
        status: 'failed',
        code: 'failed_validation',
        message: expect.stringContaining('not supported'),
        releaseRecord: null,
      }),
    ]);
  });

  it('pushes a timeline entry create when the user owns the parent work', async () => {
    const parent = createWorkAggregateFixture();
    const created = createTimelineEntryAggregateFixture();

    timelineEntriesService.findById.mockResolvedValue(null);
    userRecordsService.findById.mockResolvedValue(parent);
    timelineEntriesService.create.mockResolvedValue(created);

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: 'd8e29511-448f-4d67-bd7a-e2732f8cc9d9',
          entityType: 'timeline_entry',
          entityId: '169626cc-e8db-4e67-bb21-c1a7609e5ebc',
          operation: 'create',
          createdAt: '2026-04-18T02:00:00.000Z',
          payload: createTimelineEntryPayload(),
        },
      ],
    });

    expect(timelineEntriesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '169626cc-e8db-4e67-bb21-c1a7609e5ebc',
        userId: USER_ID,
        userWorkRecordId: parent.id,
        note: 'Manual note',
        serverVersion: 1,
      }),
      prisma,
    );
    expect(result.results).toEqual([
      expect.objectContaining({
        entityType: 'timeline_entry',
        status: 'applied',
        code: 'created',
        timelineEntry: expect.objectContaining({
          id: '169626cc-e8db-4e67-bb21-c1a7609e5ebc',
          workId: parent.id,
          syncStatus: 'synced',
          serverVersion: 1,
        }),
      }),
    ]);
  });

  it('rejects timeline entry sync when the parent work is missing', async () => {
    timelineEntriesService.findById.mockResolvedValue(null);
    userRecordsService.findById.mockResolvedValue(null);

    const result = await service.push(USER_ID, {
      changes: [
        {
          queueId: 'd8e29511-448f-4d67-bd7a-e2732f8cc9d9',
          entityType: 'timeline_entry',
          entityId: '169626cc-e8db-4e67-bb21-c1a7609e5ebc',
          operation: 'create',
          createdAt: '2026-04-18T02:00:00.000Z',
          payload: createTimelineEntryPayload(),
        },
      ],
    });

    expect(timelineEntriesService.create).not.toHaveBeenCalled();
    expect(result.results).toEqual([
      expect.objectContaining({
        entityType: 'timeline_entry',
        status: 'failed',
        code: 'failed_validation',
        message: expect.stringContaining('parent is missing'),
        timelineEntry: null,
      }),
    ]);
  });

  it('pulls timeline entry changes with the other private sync records', async () => {
    prisma.userTimelineEntry.findMany.mockResolvedValue([
      createTimelineEntryAggregateFixture({
        updatedAt: new Date('2026-04-18T03:00:00.000Z'),
      }),
    ]);

    const result = await service.pull(USER_ID, {
      since: '2026-04-18T00:00:00.000Z',
    });

    expect(prisma.userTimelineEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 501,
        where: expect.objectContaining({
          userId: USER_ID,
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        schemaVersion: 5,
        nextSince: '2026-04-18T03:00:00.000Z',
        changes: [
          expect.objectContaining({
            entityType: 'timeline_entry',
            operation: 'upsert',
            timelineEntry: expect.objectContaining({
              note: 'Manual note',
              workId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
            }),
          }),
        ],
      }),
    );
  });
});
