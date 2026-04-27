import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { CatalogService } from '../src/modules/catalog/catalog.service';
import { SyncService } from '../src/modules/sync/sync.service';
import type { SyncReleaseRecordPayloadDto } from '../src/modules/sync/dto/sync-release-record-payload.dto';
import type { SyncWorkPayloadDto } from '../src/modules/sync/dto/sync-work-payload.dto';
import { type PrismaService } from '../src/prisma/prisma.service';
import type {
  UserReleaseRecordsService,
  UserReleaseRecordAggregate,
} from '../src/modules/user-records/user-release-records.service';
import type {
  UserRecordsService,
  WorkAggregate,
} from '../src/modules/user-records/user-records.service';

const USER_ID = '2c92b57e-e529-4344-bd62-0cff4de5dfe2';
const OTHER_USER_ID = 'a3fba91f-71c3-46a2-b126-c4cbca6dd1a8';

function createWorkAggregateFixture(
  overrides: Partial<WorkAggregate> = {},
): WorkAggregate {
  return {
    id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    userId: USER_ID,
    catalogTitleId: 'catalog-title-1',
    catalogWorkId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    status: WorkStatus.completed,
    rating: 5,
    shortReview: '',
    review: '',
    personalTags: [],
    tier: null,
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
      genres: ['Sci-Fi'],
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
    genres: ['Sci-Fi'],
    personalTags: [],
    description: '',
    thumbnailUrl: '',
    status: WorkStatus.completed,
    rating: 5,
    shortReview: '',
    review: '',
    tier: null,
    favorite: false,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T01:00:00.000Z',
    deletedAt: null,
    syncStatus: 'pending',
    serverVersion: 3,
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
      catalogTitleId: 'catalog-title-1',
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
      catalogTitleId: 'catalog-title-1',
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

describe('SyncService', () => {
  let service: SyncService;
  let prisma: any;
  let catalogService: jest.Mocked<
    Pick<CatalogService, 'create' | 'createTitleFromImportCandidate' | 'update'>
  >;
  let userRecordsService: jest.Mocked<
    Pick<UserRecordsService, 'create' | 'findById' | 'findByUserSince' | 'update'>
  >;
  let releaseRecordsService: any;

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
      },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: any) => Promise<any>) =>
      callback({
        catalogWork: prisma.catalogWork,
      }),
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

    service = new SyncService(
      prisma as unknown as PrismaService,
      catalogService as unknown as CatalogService,
      userRecordsService as unknown as UserRecordsService,
      releaseRecordsService as unknown as UserReleaseRecordsService,
    );
  });

  it('returns a conflict when the server version is newer and the server wins', async () => {
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
        message: expect.stringContaining('server version 3'),
      }),
    ]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
        message: expect.stringContaining('cannot be modified remotely'),
        work: null,
      }),
    ]);
  });

  it('pulls tombstones for the current user and uses updatedAt as the next cursor', async () => {
    userRecordsService.findByUserSince.mockResolvedValue([
      createWorkAggregateFixture({
        deletedAt: new Date('2026-04-18T02:00:00.000Z'),
        updatedAt: new Date('2026-04-18T02:00:00.000Z'),
      }),
    ]);

    const result = await service.pull(USER_ID, {
      since: '2026-04-18T00:00:00.000Z',
    });

    expect(userRecordsService.findByUserSince).toHaveBeenCalledWith(
      USER_ID,
      new Date('2026-04-18T00:00:00.000Z'),
    );
    expect(result).toEqual(
      expect.objectContaining({
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
        message: 'Remote record already matches the queued change.',
        work: expect.objectContaining({
          id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
          serverVersion: 3,
        }),
      }),
    ]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
    expect(catalogService.createTitleFromImportCandidate).not.toHaveBeenCalled();
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
      id: 'catalog-title-1',
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
        catalogTitleId: 'catalog-title-1',
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
            catalogTitleId: 'catalog-title-1',
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
          id: 'catalog-title-1',
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
        catalogTitleId: 'catalog-title-1',
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
          catalogTitleId: 'catalog-title-1',
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
            catalogTitleId: 'missing-catalog-title',
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
        message: 'Catalog title with id "missing-catalog-title" was not found.',
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
      id: 'catalog-title-imported',
    } as Awaited<ReturnType<CatalogService['createTitleFromImportCandidate']>>);
    userRecordsService.create.mockResolvedValue(
      createWorkAggregateFixture({
        id: importedId,
        catalogTitleId: 'catalog-title-imported',
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
    expect(catalogService.createTitleFromImportCandidate.mock.calls[0]?.[0]).toEqual(
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
        catalogTitleId: 'catalog-title-imported',
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
          catalogTitleId: 'catalog-title-imported',
        }),
      }),
    ]);
  });

  it('falls back to payload.title when importDraft.catalogTitle is missing', async () => {
    const importedId = '55555555-5555-4555-8555-555555555556';

    userRecordsService.findById.mockResolvedValue(null);
    catalogService.createTitleFromImportCandidate.mockResolvedValue({
      id: 'catalog-title-from-payload-title',
    } as Awaited<ReturnType<CatalogService['createTitleFromImportCandidate']>>);
    userRecordsService.create.mockResolvedValue(
      createWorkAggregateFixture({
        id: importedId,
        catalogTitleId: 'catalog-title-from-payload-title',
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
          catalogTitleId: 'catalog-title-from-payload-title',
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
        message:
          'Catalog title could not be resolved from importDraft.catalogTitle or payload.title.',
        work: null,
      }),
    ]);
    expect(catalogService.createTitleFromImportCandidate).not.toHaveBeenCalled();
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
        message: 'Queued tombstone applied on the server.',
        work: expect.objectContaining({
          deletedAt: new Date('2026-04-18T02:00:00.000Z'),
          serverVersion: 4,
        }),
      }),
    ]);
  });

  it('keeps the incoming pull cursor when there are no newer records', async () => {
    userRecordsService.findByUserSince.mockResolvedValue([]);

    const result = await service.pull(USER_ID, {
      since: '2026-04-18T00:00:00.000Z',
    });

    expect(result).toEqual(
      expect.objectContaining({
        nextSince: '2026-04-18T00:00:00.000Z',
        changes: [],
      }),
    );
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
        message: expect.stringContaining('already missing remotely'),
        work: null,
      }),
    ]);
    expect(catalogService.create).not.toHaveBeenCalled();
    expect(userRecordsService.create).not.toHaveBeenCalled();
  });

  it('pushes a local release record for volume-recordable titles only', async () => {
    const parent = createWorkAggregateFixture({
      catalogTitleId: 'catalog-title-1',
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
      .mockImplementationOnce(async () => createReleaseRecordAggregateFixture());
    prisma.catalogRelease.findFirst.mockResolvedValue({
      id: '5f7ac03a-0679-4e63-a62d-0d04b5e72a23',
      catalogTitleId: 'catalog-title-1',
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
        releaseRecord: expect.objectContaining({
          catalogReleaseId: '5f7ac03a-0679-4e63-a62d-0d04b5e72a23',
        }),
      }),
    ]);
  });

  it('rejects release-record sync for progress-only anime titles', async () => {
    const parent = createWorkAggregateFixture({
      catalogTitleId: 'catalog-title-1',
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
        message: expect.stringContaining('not supported'),
        releaseRecord: null,
      }),
    ]);
  });
});
