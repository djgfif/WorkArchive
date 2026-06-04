import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SYNC_SCHEMA_VERSION, type WorkRecord } from '@work-archive/shared-types';

import { clearStoredAuthTokens, writeStoredAuthTokens } from '@features/auth';
import {
  createWorkArchiveDb,
  GraphRepository,
  ReleaseRecordsRepository,
  TimelineEntriesRepository,
  WorksRepository,
  WorksService,
  type WorkArchiveDatabase,
} from '@features/works';
import type { TierBoardRepository } from '@features/tier-boards/data';
import { AppMetaRepository } from './app-meta.repository';
import {
  createAutoMergeSnapshot,
  SyncAutoMergeService,
} from './sync-auto-merge.service';
import { SyncConflictResolutionService } from './sync-conflict-resolution.service';
import { SyncLeaseService } from './sync-lease.service';
import { SyncPullService } from './sync-pull.service';
import { SyncPushService } from './sync-push.service';
import {
  LAST_SUCCESSFUL_PULL_AT_KEY,
  SYNC_STALE_STATUS_AT_KEY,
  SyncStalePolicyService,
} from './sync-stale-policy.service';
import { SyncQueueRepository } from './sync-queue.repository';

function buildInput(overrides: Partial<WorkRecord> = {}) {
  return {
    type: 'novel' as const,
    title: 'Dune',
    author: 'Frank Herbert',
    genres: ['Science Fiction'],
    personalTags: [],
    description: '',
    thumbnailUrl: '',
    status: 'planned' as const,
    rating: null,
    shortReview: '',
    review: '',
    favorite: false,
    ...overrides,
  };
}

function buildWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  const now = '2026-04-18T00:00:00.000Z';

  return {
    id: crypto.randomUUID(),
    ...buildInput(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'synced',
    serverVersion: 1,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function createTierBoardRepositoryTestDouble() {
  return {
    bulkPutAssets: vi.fn().mockImplementation(async (records) => records),
    bulkPutBoards: vi.fn().mockImplementation(async (records) => records),
    bulkPutCards: vi.fn().mockImplementation(async (records) => records),
    bulkPutLanes: vi.fn().mockImplementation(async (records) => records),
    getEntity: vi.fn().mockResolvedValue(null),
    markSyncStatus: vi.fn(),
    putEntity: vi.fn().mockImplementation(async (record) => record),
  } as unknown as TierBoardRepository;
}

describe('extracted sync services', () => {
  let db: WorkArchiveDatabase;
  let worksRepository: WorksRepository;
  let releaseRecordsRepository: ReleaseRecordsRepository;
  let timelineEntriesRepository: TimelineEntriesRepository;
  let graphRepository: GraphRepository;
  let tierBoardRepository: TierBoardRepository;
  let queueRepository: SyncQueueRepository;
  let appMetaRepository: AppMetaRepository;
  let worksService: WorksService;
  let leaseService: SyncLeaseService;
  let stalePolicyService: SyncStalePolicyService;
  let autoMergeService: SyncAutoMergeService;
  let conflictService: SyncConflictResolutionService;
  let pullService: SyncPullService;
  let pushService: SyncPushService;

  beforeEach(() => {
    db = createWorkArchiveDb(`work-archive-test-${crypto.randomUUID()}`);
    worksRepository = new WorksRepository(() => db);
    releaseRecordsRepository = new ReleaseRecordsRepository(() => db);
    timelineEntriesRepository = new TimelineEntriesRepository(() => db);
    queueRepository = new SyncQueueRepository(() => db);
    graphRepository = new GraphRepository(() => db, queueRepository);
    tierBoardRepository = createTierBoardRepositoryTestDouble();
    appMetaRepository = new AppMetaRepository(() => db);
    worksService = new WorksService(worksRepository, queueRepository);
    leaseService = new SyncLeaseService(appMetaRepository);
    stalePolicyService = new SyncStalePolicyService(appMetaRepository);
    autoMergeService = new SyncAutoMergeService();
    conflictService = new SyncConflictResolutionService(
      worksRepository,
      releaseRecordsRepository,
      queueRepository,
      timelineEntriesRepository,
      graphRepository,
      tierBoardRepository,
    );
    pullService = new SyncPullService(
      worksRepository,
      releaseRecordsRepository,
      queueRepository,
      appMetaRepository,
      timelineEntriesRepository,
      graphRepository,
      tierBoardRepository,
      leaseService,
      stalePolicyService,
      autoMergeService,
      conflictService,
    );
    pushService = new SyncPushService(
      worksRepository,
      releaseRecordsRepository,
      queueRepository,
      timelineEntriesRepository,
      graphRepository,
      tierBoardRepository,
      leaseService,
      stalePolicyService,
      pullService,
      autoMergeService,
      conflictService,
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    clearStoredAuthTokens();
    await db.delete();
  });

  describe('SyncAutoMergeService', () => {
    it('describes metadata-only auto merges separately from field merges', () => {
      expect(createAutoMergeSnapshot([])).toEqual(
        expect.objectContaining({
          fields: [],
          message: '원격 버전 정보만 맞춰 다시 백업 대기 중입니다.',
          status: 'requeued',
        }),
      );
      expect(createAutoMergeSnapshot(['genres'])).toEqual(
        expect.objectContaining({
          fields: ['genres'],
          message: '안전한 필드만 자동 병합되어 다시 백업 대기 중입니다.',
          status: 'requeued',
        }),
      );
    });

    it('auto-merges safe work taxonomy changes only', () => {
      const remote = buildWork({
        genres: ['Classic'],
        personalTags: ['remote'],
        serverVersion: 3,
        updatedAt: '2026-04-18T02:00:00.000Z',
      });
      const local = buildWork({
        id: remote.id,
        genres: ['Science Fiction'],
        personalTags: ['local'],
        serverVersion: 1,
        syncStatus: 'pending',
        updatedAt: '2026-04-18T01:00:00.000Z',
      });

      const result = autoMergeService.mergeWorkSafely(remote, local);

      expect(result).toEqual(
        expect.objectContaining({
          ok: true,
          mergedFields: ['genres', 'personalTags'],
        }),
      );
      expect(result.ok && result.merged).toEqual(
        expect.objectContaining({
          genres: [],
          personalTags: expect.arrayContaining([
            'remote',
            'local',
            'Science Fiction',
            'Classic',
          ]),
          serverVersion: 3,
          syncStatus: 'pending',
        }),
      );
      expect(result.ok && result.merged.personalTags).toHaveLength(4);
    });

    it('keeps overlapping scalar work changes manual', () => {
      const remote = buildWork({
        title: 'Remote Dune',
      });
      const local = buildWork({
        id: remote.id,
        title: 'Local Dune',
        syncStatus: 'pending',
      });

      expect(autoMergeService.mergeWorkSafely(remote, local)).toEqual({
        ok: false,
        reason: 'overlapping_field_change',
      });
    });
  });

  describe('SyncLeaseService', () => {
    it('returns busy while an active lease is held and extends only the active token', async () => {
      await leaseService.withSyncLease(
        'push',
        () => {
          throw new Error('first lease should be available');
        },
        async (context) => {
          await expect(
            leaseService.withSyncLease(
              'pull',
              () => 'busy',
              async () => 'unexpected',
            ),
          ).resolves.toBe('busy');

          await expect(
            appMetaRepository.extendLease(
              'sync.activeLease',
              'wrong-token',
              '2026-04-18T01:00:00.000Z',
            ),
          ).resolves.toBeNull();
          await expect(
            leaseService.extendActiveSyncLease(context),
          ).resolves.toEqual(
            expect.objectContaining({
              token: context.leaseToken,
            }),
          );

          return 'done';
        },
      );
    });
  });

  describe('SyncStalePolicyService', () => {
    it('does not pull before push when a remote-backed payload already has a fresh pull', async () => {
      const localWork = await worksService.createWork(buildInput());
      const syncedWork = {
        ...localWork,
        syncStatus: 'pending' as const,
        serverVersion: 1,
      };

      await worksRepository.update(syncedWork);
      await queueRepository.removeMany(
        (await queueRepository.listAll()).map((item) => item.id),
      );
      await queueRepository.enqueueWorkChange(syncedWork, 'update', 'edit_form');
      await appMetaRepository.setValue(
        LAST_SUCCESSFUL_PULL_AT_KEY,
        new Date().toISOString(),
      );

      const pullRemoteChangesWithLease = vi.fn();
      const result = await stalePolicyService.ensureFreshPullBeforePush(
        await queueRepository.listAll(),
        {
          clientId: 'client-1',
          ownerId: 'owner-1',
          leaseToken: 'lease-1',
        },
        pullRemoteChangesWithLease,
      );

      expect(result).toBeNull();
      expect(pullRemoteChangesWithLease).not.toHaveBeenCalled();
      await expect(
        appMetaRepository.getValue(SYNC_STALE_STATUS_AT_KEY),
      ).resolves.toBeNull();
    });

    it('pulls stale remote-backed queued payloads before push and clears stale status on success', async () => {
      const localWork = await worksService.createWork(buildInput());
      const syncedWork = {
        ...localWork,
        syncStatus: 'pending' as const,
        serverVersion: 1,
      };

      await worksRepository.update(syncedWork);
      await queueRepository.removeMany(
        (await queueRepository.listAll()).map((item) => item.id),
      );
      await queueRepository.enqueueWorkChange(syncedWork, 'update', 'edit_form');
      await appMetaRepository.setValue(
        LAST_SUCCESSFUL_PULL_AT_KEY,
        '2026-04-18T00:00:00.000Z',
      );

      const pullRemoteChangesWithLease = vi.fn().mockResolvedValue({
        pulledCount: 0,
        appliedCount: 0,
        skippedCount: 0,
        pulledAt: '2026-04-18T01:00:00.000Z',
        nextSince: '2026-04-18T01:00:00.000Z',
        messages: [],
        requestFailed: false,
      });
      const result = await stalePolicyService.ensureFreshPullBeforePush(
        await queueRepository.listAll(),
        {
          clientId: 'client-1',
          ownerId: 'owner-1',
          leaseToken: 'lease-1',
        },
        pullRemoteChangesWithLease,
      );

      expect(result).toEqual(
        expect.objectContaining({
          requestFailed: false,
        }),
      );
      expect(pullRemoteChangesWithLease).toHaveBeenCalledTimes(1);
      await expect(
        appMetaRepository.getValue(SYNC_STALE_STATUS_AT_KEY),
      ).resolves.toBeNull();
    });
  });

  describe('SyncConflictResolutionService', () => {
    it('resolves local work conflicts for retry and rotates the mutation id', async () => {
      const localWork = await worksService.createWork(
        buildInput({
          title: 'Local Dune',
        }),
      );
      const [queueItem] = await queueRepository.listAll();

      await queueRepository.markConflict(
        queueItem!.id,
        'Remote conflict detected',
        {
          ...localWork,
          title: 'Remote Dune',
          syncStatus: 'synced',
          serverVersion: 3,
        },
      );
      await worksRepository.update({
        ...localWork,
        syncStatus: 'conflict',
      });

      await conflictService.resolveConflictWithLocal(queueItem!.id);

      const queuedAfterResolution = await queueRepository.getById(queueItem!.id);

      expect(queuedAfterResolution).toEqual(
        expect.objectContaining({
          conflict: null,
          payload: expect.objectContaining({
            title: 'Local Dune',
            syncStatus: 'pending',
          }),
        }),
      );
      expect(queuedAfterResolution?.clientMutationId).not.toBe(
        queueItem!.clientMutationId,
      );
    });
  });

  describe('SyncPushService', () => {
    it('returns the unchanged empty-queue result without calling the API', async () => {
      const fetchSpy = vi.fn();

      writeStoredAuthTokens({
        accessToken: 'access-token',
      });
      vi.stubGlobal('fetch', fetchSpy);

      await expect(pushService.pushQueuedChanges()).resolves.toEqual({
        attemptedCount: 0,
        appliedCount: 0,
        conflictCount: 0,
        failedCount: 0,
        processedAt: null,
        messages: ['동기화할 변경 사항이 없습니다.'],
        requestFailed: false,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('SyncPullService', () => {
    it('pulls an empty remote page and records the successful pull cursor', async () => {
      writeStoredAuthTokens({
        accessToken: 'access-token',
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          jsonResponse({
            schemaVersion: SYNC_SCHEMA_VERSION,
            pulledAt: '2026-04-18T01:00:00.000Z',
            nextSince: '2026-04-18T01:00:00.000Z',
            changes: [],
          }),
        ),
      );

      await expect(pullService.pullRemoteChanges()).resolves.toEqual({
        pulledCount: 0,
        appliedCount: 0,
        skippedCount: 0,
        pulledAt: '2026-04-18T01:00:00.000Z',
        nextSince: '2026-04-18T01:00:00.000Z',
        messages: ['가져올 변경 사항이 없습니다.'],
        requestFailed: false,
      });
      await expect(
        appMetaRepository.getValue(LAST_SUCCESSFUL_PULL_AT_KEY),
      ).resolves.toBe('2026-04-18T01:00:00.000Z');
    });
  });
});
