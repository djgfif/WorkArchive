import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  SeriesRecord,
  SyncQueueItemRecord,
  TimelineEntryRecord,
  UserReleaseRecord,
  WorkRecord,
} from '@work-archive/shared-types';

import { clearStoredAuthTokens, writeStoredAuthTokens } from '@features/auth';
import { createWorkArchiveDb, type WorkArchiveDatabase } from '@features/works';
import { WorksRepository } from '@features/works';
import { WorksService } from '@features/works';
import { ReleaseRecordsRepository } from '@features/works';
import { TimelineEntriesRepository } from '@features/works';
import { GraphRepository } from '@features/works';
import { AppMetaRepository } from './app-meta.repository';
import { SyncQueueRepository } from './sync-queue.repository';
import { SyncService } from './sync.service';

function buildInput(overrides: Partial<WorkRecord> = {}) {
  return {
    type: 'novel' as const,
    title: 'Dune',
    author: 'Frank Herbert',
    genres: ['Science Fiction'],
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

function buildSeries(overrides: Partial<SeriesRecord> = {}): SeriesRecord {
  const now = '2026-04-18T00:00:00.000Z';

  return {
    id: '0dd891e7-2f56-42a1-a9f6-fbd5d36938c1',
    title: 'Fate',
    normalizedTitle: 'fate',
    aliases: [],
    kind: 'series',
    parentId: null,
    description: '',
    thumbnailUrl: '',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
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

describe('SyncService', () => {
  let db: WorkArchiveDatabase;
  let worksRepository: WorksRepository;
  let releaseRecordsRepository: ReleaseRecordsRepository;
  let timelineEntriesRepository: TimelineEntriesRepository;
  let graphRepository: GraphRepository;
  let queueRepository: SyncQueueRepository;
  let appMetaRepository: AppMetaRepository;
  let worksService: WorksService;
  let syncService: SyncService;

  beforeEach(() => {
    db = createWorkArchiveDb(`work-archive-test-${crypto.randomUUID()}`);
    worksRepository = new WorksRepository(() => db);
    releaseRecordsRepository = new ReleaseRecordsRepository(() => db);
    timelineEntriesRepository = new TimelineEntriesRepository(() => db);
    queueRepository = new SyncQueueRepository(() => db);
    graphRepository = new GraphRepository(() => db, queueRepository);
    appMetaRepository = new AppMetaRepository(() => db);
    worksService = new WorksService(worksRepository, queueRepository);
    syncService = new SyncService(
      worksRepository,
      releaseRecordsRepository,
      queueRepository,
      appMetaRepository,
      timelineEntriesRepository,
      graphRepository,
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearStoredAuthTokens();
    await db.delete();
  });

  it('removes successful queue items and updates the local work from push results', async () => {
    const localWork = await worksService.createWork(buildInput());
    const queueItems = await queueRepository.listAll();
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 5,
          processedAt: '2026-04-18T01:00:00.000Z',
          results: [
            {
              queueId: queueItems[0]!.id,
              entityId: localWork.id,
              entityType: 'work',
              status: 'applied',
              message: 'Queued record created on the server.',
              work: {
                ...localWork,
                syncStatus: 'synced',
                serverVersion: 1,
                updatedAt: '2026-04-18T01:00:00.000Z',
              },
            },
          ],
        }),
      ),
    );

    const result = await syncService.pushQueuedChanges();

    expect(result).toEqual(
      expect.objectContaining({
        appliedCount: 1,
        conflictCount: 0,
        failedCount: 0,
        requestFailed: false,
      }),
    );
    expect(await queueRepository.listAll()).toEqual([]);
    expect(await worksRepository.getById(localWork.id)).toEqual(
      expect.objectContaining({
        syncStatus: 'synced',
        serverVersion: 1,
        updatedAt: '2026-04-18T01:00:00.000Z',
      }),
    );
  });

  it('removes successful graph queue items and updates local graph records', async () => {
    const localSeries = buildSeries();

    await db.series.add(localSeries);
    await queueRepository.enqueueEntityChange(
      'series',
      localSeries,
      'create',
      localSeries,
      'edit_form',
    );
    const [queueItem] = await queueRepository.listAll();
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 5,
          processedAt: '2026-04-18T01:00:00.000Z',
          results: [
            {
              queueId: queueItem!.id,
              entityId: localSeries.id,
              entityType: 'series',
              status: 'applied',
              message: 'Queued graph record created on the server.',
              series: {
                ...localSeries,
                syncStatus: 'synced',
                serverVersion: 1,
                updatedAt: '2026-04-18T01:00:00.000Z',
              },
            },
          ],
        }),
      ),
    );

    const result = await syncService.pushQueuedChanges();

    expect(result).toEqual(
      expect.objectContaining({
        appliedCount: 1,
        failedCount: 0,
        requestFailed: false,
      }),
    );
    expect(await queueRepository.listAll()).toEqual([]);
    expect(await db.series.get(localSeries.id)).toEqual(
      expect.objectContaining({
        syncStatus: 'synced',
        serverVersion: 1,
        updatedAt: '2026-04-18T01:00:00.000Z',
      }),
    );
  });

  it('fails push without removing queue items when the response schema version is unsupported', async () => {
    const localWork = await worksService.createWork(buildInput());
    const [queueItem] = await queueRepository.listAll();
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 1,
          processedAt: '2026-04-18T01:00:00.000Z',
          results: [],
        }),
      ),
    );

    const result = await syncService.pushQueuedChanges();

    expect(result).toEqual(
      expect.objectContaining({
        attemptedCount: 1,
        appliedCount: 0,
        failedCount: 1,
        requestFailed: true,
        messages: [
          '보내기 응답의 동기화 계약 버전을 지원하지 않습니다. 앱을 새로고침하거나 업데이트해주세요.',
        ],
      }),
    );
    expect(await queueRepository.getById(queueItem!.id)).toEqual(
      expect.objectContaining({
        entityId: localWork.id,
        retryCount: 1,
        lastError:
          '보내기 응답의 동기화 계약 버전을 지원하지 않습니다. 앱을 새로고침하거나 업데이트해주세요.',
      }),
    );
  });

  it('removes successful release-record queue items and updates local release records', async () => {
    const now = '2026-04-18T01:00:00.000Z';
    const localReleaseRecord: UserReleaseRecord = {
      id: '7fb84ae9-6821-4d68-bb89-2f51f0dd9e11',
      userWorkRecordId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      catalogReleaseId: '5f7ac03a-0679-4e63-a62d-0d04b5e72a23',
      status: 'completed',
      rating: 4.5,
      shortReview: '1沅?媛먯긽',
      review: '',
      favorite: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local-only',
      serverVersion: 0,
    };

    await releaseRecordsRepository.create(localReleaseRecord);
    await queueRepository.enqueueReleaseRecordChange(
      localReleaseRecord,
      'create',
    );
    const queueItems = await queueRepository.listAll();
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 5,
          processedAt: '2026-04-18T02:00:00.000Z',
          results: [
            {
              queueId: queueItems[0]!.id,
              entityId: localReleaseRecord.id,
              entityType: 'release_record',
              status: 'applied',
              message: 'Queued record created on the server.',
              releaseRecord: {
                ...localReleaseRecord,
                syncStatus: 'synced',
                serverVersion: 1,
                updatedAt: '2026-04-18T02:00:00.000Z',
              },
            },
          ],
        }),
      ),
    );

    const result = await syncService.pushQueuedChanges();

    expect(result).toEqual(
      expect.objectContaining({
        appliedCount: 1,
        conflictCount: 0,
        failedCount: 0,
        requestFailed: false,
      }),
    );
    expect(await queueRepository.listAll()).toEqual([]);
    expect(
      await releaseRecordsRepository.getById(localReleaseRecord.id),
    ).toEqual(
      expect.objectContaining({
        syncStatus: 'synced',
        serverVersion: 1,
      }),
    );
  });

  it('keeps failed queue items with retry metadata when push fails', async () => {
    const localWork = await worksService.createWork(buildInput());
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            message: 'Sync server is unavailable.',
          },
          503,
        ),
      ),
    );

    const result = await syncService.pushQueuedChanges();
    const remainingQueueItems = await queueRepository.listAll();

    expect(result).toEqual(
      expect.objectContaining({
        failedCount: 1,
        requestFailed: true,
      }),
    );
    expect(remainingQueueItems).toEqual([
      expect.objectContaining({
        entityId: localWork.id,
        retryCount: 1,
        lastError:
          '동기화 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
      }),
    ]);
  });

  it('retries a failed queue item and removes it after a later successful push', async () => {
    const localWork = await worksService.createWork(buildInput());
    const [queueItem] = await queueRepository.listAll();

    await queueRepository.markFailed(queueItem!.id, 'Network request failed.');
    await db.syncQueue.put({
      ...(await queueRepository.getById(queueItem!.id))!,
      nextRetryAt: '2000-01-01T00:00:00.000Z',
    });
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 5,
          processedAt: '2026-04-18T01:00:00.000Z',
          results: [
            {
              queueId: queueItem!.id,
              entityId: localWork.id,
              entityType: 'work',
              status: 'applied',
              message: 'Queued record updated on the server.',
              work: {
                ...localWork,
                syncStatus: 'synced',
                serverVersion: 1,
                updatedAt: '2026-04-18T01:00:00.000Z',
              },
            },
          ],
        }),
      ),
    );

    const result = await syncService.pushQueuedChanges();

    expect(result).toEqual(
      expect.objectContaining({
        appliedCount: 1,
        failedCount: 0,
      }),
    );
    await expect(queueRepository.listAll()).resolves.toEqual([]);
    await expect(worksRepository.getById(localWork.id)).resolves.toEqual(
      expect.objectContaining({
        syncStatus: 'synced',
        serverVersion: 1,
      }),
    );
  });

  it('does not retry failed queue items before their backoff expires', async () => {
    const localWork = await worksService.createWork(buildInput());
    const [queueItem] = await queueRepository.listAll();

    await queueRepository.markFailed(queueItem!.id, 'Network request failed.');
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const fetchSpy = vi.fn();

    vi.stubGlobal('fetch', fetchSpy);

    const result = await syncService.pushQueuedChanges();

    expect(result).toEqual(
      expect.objectContaining({
        attemptedCount: 0,
        appliedCount: 0,
        conflictCount: 0,
        failedCount: 0,
        requestFailed: false,
        messages: ['실패한 항목은 다음 자동 재시도 시간까지 기다립니다.'],
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await queueRepository.getById(queueItem!.id)).toEqual(
      expect.objectContaining({
        entityId: localWork.id,
        lastError: 'Network request failed.',
        nextRetryAt: expect.any(String),
      }),
    );
  });

  it('skips push when another tab holds the scope sync lease', async () => {
    await worksService.createWork(buildInput());
    await appMetaRepository.setValue(
      'sync.activeLease',
      JSON.stringify({
        acquiredAt: '2026-05-26T00:00:00.000Z',
        expiresAt: '9999-01-01T00:00:00.000Z',
        ownerId: 'other-client:other-tab',
        token: 'push:other',
      }),
    );
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const fetchSpy = vi.fn();

    vi.stubGlobal('fetch', fetchSpy);

    const result = await syncService.pushQueuedChanges();

    expect(result).toEqual(
      expect.objectContaining({
        attemptedCount: 0,
        requestFailed: false,
        messages: ['다른 탭에서 동기화 중이라 이번 백업을 건너뛰었습니다.'],
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('acquires expired leases and only extends the active token', async () => {
    const key = 'sync.activeLease';

    await appMetaRepository.acquireLease(key, {
      acquiredAt: '2026-04-18T00:00:00.000Z',
      expiresAt: '2026-04-18T00:00:01.000Z',
      ownerId: 'owner:old',
      token: 'token:old',
    });

    const currentLease = await appMetaRepository.acquireLease(key, {
      acquiredAt: '2026-04-18T00:00:02.000Z',
      expiresAt: '2026-04-18T00:00:27.000Z',
      ownerId: 'owner:current',
      token: 'token:current',
    });

    expect(currentLease).toEqual(
      expect.objectContaining({
        token: 'token:current',
      }),
    );
    await expect(
      appMetaRepository.extendLease(
        key,
        'token:old',
        '2026-04-18T00:01:00.000Z',
      ),
    ).resolves.toBeNull();
    await expect(appMetaRepository.getValue(key)).resolves.toContain(
      '"expiresAt":"2026-04-18T00:00:27.000Z"',
    );

    await expect(
      appMetaRepository.extendLease(
        key,
        'token:current',
        '2026-04-18T00:01:00.000Z',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        expiresAt: '2026-04-18T00:01:00.000Z',
        token: 'token:current',
      }),
    );

    await appMetaRepository.releaseLease(key, 'token:current');
    await expect(
      appMetaRepository.extendLease(
        key,
        'token:current',
        '2026-04-18T00:02:00.000Z',
      ),
    ).resolves.toBeNull();
  });

  it('auto-merges safe array-only push conflicts and keeps the work queued for backup retry', async () => {
    const localWork = await worksService.createWork(
      buildInput({
        genres: ['Science Fiction'],
        personalTags: ['local'],
      }),
    );
    const queueItems = await queueRepository.listAll();
    const originalClientMutationId = queueItems[0]!.clientMutationId;
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 5,
          processedAt: '2026-04-18T01:00:00.000Z',
          results: [
            {
              queueId: queueItems[0]!.id,
              entityId: localWork.id,
              entityType: 'work',
              status: 'conflict',
              code: 'conflict_remote_newer',
              message:
                'Conflict: server version 3 updated at 2026-06-18T01:00:00.000Z won.',
              work: {
                ...localWork,
                genres: ['Classic'],
                personalTags: ['remote'],
                syncStatus: 'synced',
                serverVersion: 3,
                updatedAt: '2026-06-18T01:00:00.000Z',
              },
            },
          ],
        }),
      ),
    );

    const result = await syncService.pushQueuedChanges();

    expect(result).toEqual(
      expect.objectContaining({
        appliedCount: 0,
        conflictCount: 0,
        failedCount: 0,
      }),
    );
    const queuedAfterAutoMerge = await queueRepository.listAll();

    expect(queuedAfterAutoMerge).toEqual([
      expect.objectContaining({
        entityId: localWork.id,
        retryCount: 0,
        lastError: null,
        conflict: null,
        autoMerge: expect.objectContaining({
          status: 'requeued',
        }),
        clientMutationId: expect.any(String),
        payload: expect.objectContaining({
          genres: [],
          personalTags: ['remote', 'local', 'Science Fiction', 'Classic'],
          serverVersion: 3,
          syncStatus: 'pending',
        }),
      }),
    ]);
    expect(queuedAfterAutoMerge[0]?.clientMutationId).not.toBe(
      originalClientMutationId,
    );
    expect(await worksRepository.getById(localWork.id)).toEqual(
      expect.objectContaining({
        genres: [],
        personalTags: ['remote', 'local', 'Science Fiction', 'Classic'],
        serverVersion: 3,
        syncStatus: 'pending',
      }),
    );
  });

  it('keeps scalar push conflicts manual so local field data is not discarded', async () => {
    const localWork = await worksService.createWork(
      buildInput({
        title: 'Local Dune',
        personalTags: ['local'],
      }),
    );
    const [queueItem] = await queueRepository.listAll();
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 5,
          processedAt: '2026-04-18T01:00:00.000Z',
          results: [
            {
              queueId: queueItem!.id,
              entityId: localWork.id,
              entityType: 'work',
              status: 'conflict',
              code: 'conflict_remote_newer',
              message:
                'Server mismatch: the work record has a newer remote version.',
              work: {
                ...localWork,
                title: 'Remote Dune',
                personalTags: ['remote'],
                syncStatus: 'synced',
                serverVersion: 3,
                updatedAt: '2026-06-18T01:00:00.000Z',
              },
            },
          ],
        }),
      ),
    );

    const result = await syncService.pushQueuedChanges();

    expect(result).toEqual(
      expect.objectContaining({
        appliedCount: 0,
        conflictCount: 1,
        failedCount: 0,
      }),
    );
    expect(await worksRepository.getById(localWork.id)).toEqual(
      expect.objectContaining({
        title: 'Local Dune',
        personalTags: ['local', 'Science Fiction'],
        syncStatus: 'conflict',
      }),
    );
    expect(await queueRepository.getById(queueItem!.id)).toEqual(
      expect.objectContaining({
        conflict: expect.objectContaining({
          code: 'conflict_remote_newer',
          remote: expect.objectContaining({
            title: 'Remote Dune',
          }),
        }),
        payload: expect.objectContaining({
          title: 'Local Dune',
          personalTags: ['local', 'Science Fiction'],
        }),
      }),
    );
  });

  it('does not auto-merge delete/update push collisions', async () => {
    const localWork = await worksService.createWork(
      buildInput({
        title: 'Local Dune',
      }),
    );
    const [queueItem] = await queueRepository.listAll();
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 5,
          processedAt: '2026-04-18T01:00:00.000Z',
          results: [
            {
              queueId: queueItem!.id,
              entityId: localWork.id,
              entityType: 'work',
              status: 'conflict',
              code: 'conflict_remote_newer',
              message:
                'Server mismatch: the work record has a newer remote version.',
              work: {
                ...localWork,
                deletedAt: '2026-06-18T01:00:00.000Z',
                syncStatus: 'synced',
                serverVersion: 3,
                updatedAt: '2026-06-18T01:00:00.000Z',
              },
            },
          ],
        }),
      ),
    );

    const result = await syncService.pushQueuedChanges();

    expect(result.conflictCount).toBe(1);
    expect(await worksRepository.getById(localWork.id)).toEqual(
      expect.objectContaining({
        deletedAt: null,
        syncStatus: 'conflict',
      }),
    );
    expect(await queueRepository.getById(queueItem!.id)).toEqual(
      expect.objectContaining({
        conflict: expect.objectContaining({
          code: 'conflict_remote_newer',
        }),
      }),
    );
  });

  it('resolves a conflict by keeping the local work queued for retry', async () => {
    const localWork = await worksService.createWork(
      buildInput({
        title: 'Local Dune',
        review: 'Local review',
      }),
    );
    const [queueItem] = await queueRepository.listAll();

    await queueRepository.markConflict(
      queueItem!.id,
      'Remote conflict detected',
      {
        ...localWork,
        title: 'Remote Dune',
        review: 'Remote review',
        syncStatus: 'synced',
        serverVersion: 3,
      },
    );
    await worksRepository.update({
      ...localWork,
      syncStatus: 'conflict',
    });

    await syncService.resolveConflictWithLocal(queueItem!.id);

    expect(await worksRepository.getById(localWork.id)).toEqual(
      expect.objectContaining({
        title: 'Local Dune',
        review: 'Local review',
        syncStatus: 'pending',
      }),
    );
    expect(await queueRepository.getById(queueItem!.id)).toEqual(
      expect.objectContaining({
        retryCount: 0,
        lastError: null,
        conflict: null,
        payload: expect.objectContaining({
          title: 'Local Dune',
          syncStatus: 'pending',
        }),
      }),
    );
  });

  it('resolves a conflict by applying the remote work snapshot', async () => {
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

    await syncService.resolveConflictWithRemote(queueItem!.id);

    expect(await queueRepository.listAll()).toEqual([]);
    expect(await worksRepository.getById(localWork.id)).toEqual(
      expect.objectContaining({
        title: 'Remote Dune',
        syncStatus: 'synced',
        serverVersion: 3,
      }),
    );
  });

  it('resolves a conflict by merging selected remote work fields into the local payload', async () => {
    const localWork = await worksService.createWork(
      buildInput({
        title: 'Local Dune',
        review: 'Local review',
        personalTags: ['local-tag'],
      }),
    );
    const [queueItem] = await queueRepository.listAll();

    await queueRepository.markConflict(
      queueItem!.id,
      'Remote conflict detected',
      {
        ...localWork,
        title: 'Remote Dune',
        review: 'Remote review',
        personalTags: ['remote-tag'],
        syncStatus: 'synced',
        serverVersion: 3,
      },
    );
    await worksRepository.update({
      ...localWork,
      syncStatus: 'conflict',
    });

    await syncService.resolveConflictWithMergedFields(queueItem!.id, [
      'title',
      'personalTags',
    ]);

    expect(await worksRepository.getById(localWork.id)).toEqual(
      expect.objectContaining({
        title: 'Remote Dune',
        review: 'Local review',
        personalTags: ['remote-tag'],
        syncStatus: 'pending',
      }),
    );
    expect(await queueRepository.getById(queueItem!.id)).toEqual(
      expect.objectContaining({
        conflict: null,
        payload: expect.objectContaining({
          title: 'Remote Dune',
          review: 'Local review',
          personalTags: ['remote-tag'],
          syncStatus: 'pending',
        }),
      }),
    );
  });

  it('resolves a release-record conflict by applying the remote snapshot', async () => {
    const now = '2026-04-18T01:00:00.000Z';
    const localReleaseRecord: UserReleaseRecord = {
      id: 'release-conflict-1',
      userWorkRecordId: 'work-1',
      catalogReleaseId: 'release-1',
      status: 'planned',
      rating: null,
      shortReview: 'Local release',
      review: '',
      favorite: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
      serverVersion: 1,
    };

    await releaseRecordsRepository.create(localReleaseRecord);
    const queueItem = await queueRepository.enqueueReleaseRecordChange(
      localReleaseRecord,
      'update',
    );

    await queueRepository.markConflict(
      queueItem!.id,
      'Remote release conflict detected',
      {
        ...localReleaseRecord,
        status: 'completed',
        shortReview: 'Remote release',
        syncStatus: 'synced',
        serverVersion: 2,
      },
    );
    await releaseRecordsRepository.update({
      ...localReleaseRecord,
      syncStatus: 'conflict',
    });

    await syncService.resolveConflictWithRemote(queueItem!.id);

    expect(await queueRepository.listAll()).toEqual([]);
    expect(
      await releaseRecordsRepository.getById(localReleaseRecord.id),
    ).toEqual(
      expect.objectContaining({
        status: 'completed',
        shortReview: 'Remote release',
        syncStatus: 'synced',
        serverVersion: 2,
      }),
    );
  });

  it('pulls remote changes into the local database and advances the pull cursor', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 5,
          pulledAt: '2026-04-18T02:00:00.000Z',
          nextSince: '2026-04-18T01:30:00.000Z',
          changes: [
            {
              entityType: 'work',
              entityId: '1ef17be0-b7fd-4b6b-a7f4-64db4026fcbf',
              operation: 'upsert',
              work: {
                id: '1ef17be0-b7fd-4b6b-a7f4-64db4026fcbf',
                ...buildInput({
                  title: 'Frieren',
                  author: 'Kanehito Yamada',
                  status: 'completed',
                }),
                createdAt: '2026-04-17T00:00:00.000Z',
                updatedAt: '2026-06-18T01:30:00.000Z',
                deletedAt: null,
                syncStatus: 'synced',
                serverVersion: 4,
              },
            },
          ],
        }),
      ),
    );

    const result = await syncService.pullRemoteChanges();

    expect(result).toEqual(
      expect.objectContaining({
        pulledCount: 1,
        appliedCount: 1,
        skippedCount: 0,
        requestFailed: false,
      }),
    );
    expect(
      await worksRepository.getById('1ef17be0-b7fd-4b6b-a7f4-64db4026fcbf'),
    ).toEqual(
      expect.objectContaining({
        title: 'Frieren',
        serverVersion: 4,
        syncStatus: 'synced',
      }),
    );
    await expect(
      appMetaRepository.getValue('sync.lastSuccessfulPullAt'),
    ).resolves.toBe('2026-04-18T01:30:00.000Z');
  });

  it('pulls remote graph records into the local database', async () => {
    const remoteSeries = buildSeries({
      id: '4cc0c4f5-9e5b-4376-aaaf-68b8241cc552',
      syncStatus: 'synced',
      serverVersion: 2,
      updatedAt: '2026-04-18T03:00:00.000Z',
    });
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 5,
          pulledAt: '2026-04-18T03:00:00.000Z',
          nextSince: '2026-04-18T03:00:00.000Z',
          changes: [
            {
              entityType: 'series',
              entityId: remoteSeries.id,
              operation: 'upsert',
              series: remoteSeries,
            },
          ],
        }),
      ),
    );

    const result = await syncService.pullRemoteChanges();

    expect(result).toEqual(
      expect.objectContaining({
        pulledCount: 1,
        appliedCount: 1,
        skippedCount: 0,
        requestFailed: false,
      }),
    );
    expect(await db.series.get(remoteSeries.id)).toEqual(remoteSeries);
  });

  it('updates local timeline entries from successful push results', async () => {
    const localWork = await worksService.createWork(buildInput());
    await queueRepository.removeMany(
      (await queueRepository.listAll()).map((item) => item.id),
    );
    const localTimelineEntry = await timelineEntriesRepository.create({
      note: 'Manual note',
      occurredAt: '2026-04-18T02:00:00.000Z',
      type: 'note',
      workId: localWork.id,
    });
    await queueRepository.enqueueTimelineEntryChange(
      {
        ...localTimelineEntry,
        syncStatus: 'pending',
      },
      'create',
    );
    const queueItem = (await queueRepository.listAll()).find(
      (item) => item.entityType === 'timeline_entry',
    );
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 5,
          processedAt: '2026-04-18T03:00:00.000Z',
          results: [
            {
              queueId: queueItem!.id,
              entityId: localTimelineEntry.id,
              entityType: 'timeline_entry',
              status: 'applied',
              message: 'Queued record created on the server.',
              timelineEntry: {
                ...localTimelineEntry,
                syncStatus: 'synced',
                serverVersion: 1,
                updatedAt: '2026-04-18T03:00:00.000Z',
              } satisfies TimelineEntryRecord,
            },
          ],
        }),
      ),
    );

    const result = await syncService.pushQueuedChanges();

    expect(result).toEqual(
      expect.objectContaining({
        appliedCount: 1,
        failedCount: 0,
      }),
    );
    expect(await queueRepository.listAll()).toEqual([]);
    expect(
      await timelineEntriesRepository.getById(localTimelineEntry.id),
    ).toEqual(
      expect.objectContaining({
        syncStatus: 'synced',
        serverVersion: 1,
        updatedAt: '2026-04-18T03:00:00.000Z',
      }),
    );
  });

  it('pulls remote timeline entries into the local database', async () => {
    const remoteTimelineEntry: TimelineEntryRecord = {
      createdAt: '2026-04-18T00:00:00.000Z',
      deletedAt: null,
      id: '169626cc-e8db-4e67-bb21-c1a7609e5ebc',
      note: 'Remote note',
      occurredAt: '2026-04-18T02:00:00.000Z',
      serverVersion: 2,
      syncStatus: 'synced',
      type: 'note',
      updatedAt: '2026-04-18T03:00:00.000Z',
      workId: '1ef17be0-b7fd-4b6b-a7f4-64db4026fcbf',
    };
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 5,
          pulledAt: '2026-04-18T03:00:00.000Z',
          nextSince: '2026-04-18T03:00:00.000Z',
          changes: [
            {
              entityType: 'timeline_entry',
              entityId: remoteTimelineEntry.id,
              operation: 'upsert',
              timelineEntry: remoteTimelineEntry,
            },
          ],
        }),
      ),
    );

    const result = await syncService.pullRemoteChanges();

    expect(result).toEqual(
      expect.objectContaining({
        pulledCount: 1,
        appliedCount: 1,
        skippedCount: 0,
      }),
    );
    await expect(
      timelineEntriesRepository.getById(remoteTimelineEntry.id),
    ).resolves.toEqual(remoteTimelineEntry);
  });

  it('fails pull without advancing the cursor when the response schema version is unsupported', async () => {
    await appMetaRepository.setValue(
      'sync.lastSuccessfulPullAt',
      '2026-04-18T00:00:00.000Z',
    );
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 1,
          pulledAt: '2026-04-18T02:00:00.000Z',
          nextSince: '2026-04-18T01:30:00.000Z',
          changes: [],
        }),
      ),
    );

    const result = await syncService.pullRemoteChanges();

    expect(result).toEqual(
      expect.objectContaining({
        pulledCount: 0,
        appliedCount: 0,
        skippedCount: 0,
        nextSince: '2026-04-18T00:00:00.000Z',
        requestFailed: true,
        messages: [
          '가져오기 응답의 동기화 계약 버전을 지원하지 않습니다. 앱을 새로고침하거나 업데이트해주세요.',
        ],
      }),
    );
    await expect(
      appMetaRepository.getValue('sync.lastSuccessfulPullAt'),
    ).resolves.toBe('2026-04-18T00:00:00.000Z');
  });

  it('auto-merges safe pulled work arrays into queued local work without marking a conflict', async () => {
    const existing = await worksService.createWork(
      buildInput({
        title: 'Dune',
        personalTags: ['local'],
      }),
    );
    const [queueItem] = await queueRepository.listAll();
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    await appMetaRepository.setValue(
      'sync.lastSuccessfulPullAt',
      '2026-04-18T00:00:00.000Z',
    );
    await queueRepository.markFailed(queueItem!.id, 'Previous push failed.');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 5,
          pulledAt: '2026-04-18T02:00:00.000Z',
          nextSince: '2026-04-18T01:30:00.000Z',
          changes: [
            {
              entityType: 'work',
              entityId: existing.id,
              operation: 'upsert',
              work: {
                ...existing,
                genres: ['Classic'],
                personalTags: ['remote'],
                updatedAt: '2026-06-18T01:30:00.000Z',
                syncStatus: 'synced',
                serverVersion: 2,
              },
            },
          ],
        }),
      ),
    );

    const result = await syncService.pullRemoteChanges();
    const queueAfterPull = await queueRepository.getById(queueItem!.id);

    expect(result).toEqual(
      expect.objectContaining({
        pulledCount: 1,
        appliedCount: 0,
        skippedCount: 0,
        nextSince: '2026-04-18T01:30:00.000Z',
        requestFailed: false,
      }),
    );
    expect(queueAfterPull).toEqual(
      expect.objectContaining({
        retryCount: 0,
        lastError: null,
        conflict: null,
        autoMerge: expect.objectContaining({
          status: 'requeued',
        }),
        payload: expect.objectContaining({
          id: existing.id,
          title: 'Dune',
          genres: [],
          personalTags: ['remote', 'local', 'Science Fiction', 'Classic'],
          syncStatus: 'pending',
          serverVersion: 2,
        }),
      }),
    );
    expect(await worksRepository.getById(existing.id)).toEqual(
      expect.objectContaining({
        title: 'Dune',
        genres: [],
        personalTags: ['remote', 'local', 'Science Fiction', 'Classic'],
        syncStatus: 'pending',
        serverVersion: 2,
      }),
    );
    await expect(
      appMetaRepository.getValue('sync.lastSuccessfulPullAt'),
    ).resolves.toBe('2026-04-18T01:30:00.000Z');
  });

  it('marks unsafe pulled work conflicts as manual-required without changing local data', async () => {
    const existing = await worksService.createWork(
      buildInput({
        title: 'Local Dune',
        personalTags: ['local'],
      }),
    );
    const [queueItem] = await queueRepository.listAll();
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    await appMetaRepository.setValue(
      'sync.lastSuccessfulPullAt',
      '2026-04-18T00:00:00.000Z',
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 5,
          pulledAt: '2026-04-18T02:00:00.000Z',
          nextSince: '2026-04-18T01:30:00.000Z',
          changes: [
            {
              entityType: 'work',
              entityId: existing.id,
              operation: 'upsert',
              work: {
                ...existing,
                title: 'Remote Dune',
                personalTags: ['remote'],
                updatedAt: '2026-06-18T01:30:00.000Z',
                syncStatus: 'synced',
                serverVersion: 2,
              },
            },
          ],
        }),
      ),
    );

    const result = await syncService.pullRemoteChanges();

    expect(result).toEqual(
      expect.objectContaining({
        pulledCount: 1,
        appliedCount: 0,
        skippedCount: 1,
        requestFailed: false,
      }),
    );
    expect(await worksRepository.getById(existing.id)).toEqual(
      expect.objectContaining({
        title: 'Local Dune',
        personalTags: ['local', 'Science Fiction'],
        syncStatus: 'conflict',
      }),
    );
    expect(await queueRepository.getById(queueItem!.id)).toEqual(
      expect.objectContaining({
        conflict: expect.objectContaining({
          code: 'pull_conflict_local_queue',
          remote: expect.objectContaining({
            title: 'Remote Dune',
          }),
        }),
        payload: expect.objectContaining({
          title: 'Local Dune',
          personalTags: ['local', 'Science Fiction'],
        }),
      }),
    );
  });

  it('does not partially reset safe queue items when a later pulled item is unsafe', async () => {
    const existing = await worksService.createWork(
      buildInput({
        title: 'Dune',
      }),
    );
    await queueRepository.removeMany(
      (await queueRepository.listAll()).map((item) => item.id),
    );

    const safePayload: WorkRecord = {
      ...existing,
      personalTags: ['local-safe'],
      syncStatus: 'pending',
      updatedAt: '2026-04-18T01:00:00.000Z',
    };
    const unsafePayload: WorkRecord = {
      ...existing,
      title: 'Local Dune',
      personalTags: ['local-unsafe'],
      syncStatus: 'pending',
      updatedAt: '2026-04-18T01:01:00.000Z',
    };
    const safeQueueItem: SyncQueueItemRecord<WorkRecord> = {
      id: crypto.randomUUID(),
      clientMutationId: crypto.randomUUID(),
      entityType: 'work',
      entityId: existing.id,
      operation: 'update',
      payload: safePayload,
      source: 'edit_form',
      createdAt: '2026-04-18T01:00:00.000Z',
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
      autoMerge: null,
      conflict: null,
    };
    const unsafeQueueItem: SyncQueueItemRecord<WorkRecord> = {
      ...safeQueueItem,
      id: crypto.randomUUID(),
      clientMutationId: crypto.randomUUID(),
      payload: unsafePayload,
      createdAt: '2026-04-18T01:01:00.000Z',
    };

    await db.syncQueue.bulkAdd([safeQueueItem, unsafeQueueItem]);
    await appMetaRepository.setValue(
      'sync.lastSuccessfulPullAt',
      '2026-04-18T00:00:00.000Z',
    );
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 5,
          pulledAt: '2026-04-18T02:00:00.000Z',
          nextSince: '2026-04-18T01:30:00.000Z',
          changes: [
            {
              entityType: 'work',
              entityId: existing.id,
              operation: 'upsert',
              work: {
                ...existing,
                genres: ['Classic'],
                personalTags: ['remote'],
                updatedAt: '2026-04-18T01:30:00.000Z',
                syncStatus: 'synced',
                serverVersion: 2,
              },
            },
          ],
        }),
      ),
    );

    const result = await syncService.pullRemoteChanges();
    const safeQueueAfterPull = await queueRepository.getById(safeQueueItem.id);
    const unsafeQueueAfterPull = await queueRepository.getById(
      unsafeQueueItem.id,
    );

    expect(result).toEqual(
      expect.objectContaining({
        pulledCount: 1,
        appliedCount: 0,
        skippedCount: 2,
        requestFailed: false,
      }),
    );
    expect(await worksRepository.getById(existing.id)).toEqual(
      expect.objectContaining({
        title: 'Dune',
        personalTags: ['Science Fiction'],
        serverVersion: 0,
        syncStatus: 'conflict',
      }),
    );
    expect(safeQueueAfterPull).toEqual(
      expect.objectContaining({
        autoMerge: null,
        conflict: expect.objectContaining({
          code: 'pull_conflict_local_queue',
        }),
        payload: expect.objectContaining({
          title: 'Dune',
          personalTags: ['local-safe'],
          serverVersion: 0,
        }),
        retryCount: 1,
      }),
    );
    expect(unsafeQueueAfterPull).toEqual(
      expect.objectContaining({
        autoMerge: null,
        conflict: expect.objectContaining({
          code: 'pull_conflict_local_queue',
        }),
        payload: expect.objectContaining({
          title: 'Local Dune',
          personalTags: ['local-unsafe'],
          serverVersion: 0,
        }),
        retryCount: 1,
      }),
    );
  });

  it('pulls before pushing stale remote-backed local payloads and blocks unsafe overwrite', async () => {
    const created = await worksService.createWork(
      buildInput({
        title: 'Synced Dune',
        personalTags: ['local'],
      }),
    );

    await queueRepository.removeMany(
      (await queueRepository.listAll()).map((item) => item.id),
    );

    const syncedWork: WorkRecord = {
      ...created,
      syncStatus: 'synced',
      serverVersion: 1,
      updatedAt: '2026-04-18T00:00:00.000Z',
    };
    const localEdit: WorkRecord = {
      ...syncedWork,
      title: 'Local Dune',
      syncStatus: 'pending',
      updatedAt: '2026-04-18T01:00:00.000Z',
    };

    await worksRepository.update(localEdit);
    const queueItem = await queueRepository.enqueueWorkChange(
      localEdit,
      'update',
      'edit_form',
    );
    await appMetaRepository.setValue(
      'sync.lastSuccessfulPullAt',
      '2026-04-18T00:00:00.000Z',
    );
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        schemaVersion: 5,
        pulledAt: '2026-04-18T02:00:00.000Z',
        nextSince: '2026-04-18T02:00:00.000Z',
        changes: [
          {
            entityType: 'work',
            entityId: created.id,
            operation: 'upsert',
            work: {
              ...syncedWork,
              title: 'Remote Dune',
              personalTags: ['remote'],
              syncStatus: 'synced',
              serverVersion: 2,
              updatedAt: '2026-04-18T02:00:00.000Z',
            },
          },
        ],
      }),
    );

    vi.stubGlobal('fetch', fetchSpy);

    const result = await syncService.pushQueuedChanges();

    expect(result).toEqual(
      expect.objectContaining({
        attemptedCount: 0,
        appliedCount: 0,
        conflictCount: 1,
        failedCount: 0,
        requestFailed: false,
      }),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe('/api/sync/pull');
    expect(await worksRepository.getById(created.id)).toEqual(
      expect.objectContaining({
        title: 'Local Dune',
        syncStatus: 'conflict',
        serverVersion: 1,
      }),
    );
    expect(await queueRepository.getById(queueItem!.id)).toEqual(
      expect.objectContaining({
        conflict: expect.objectContaining({
          code: 'pull_conflict_local_queue',
          remote: expect.objectContaining({
            title: 'Remote Dune',
            serverVersion: 2,
          }),
        }),
        payload: expect.objectContaining({
          title: 'Local Dune',
          serverVersion: 1,
        }),
      }),
    );
    await expect(
      appMetaRepository.getValue('sync.staleStatusAt'),
    ).resolves.toEqual(expect.any(String));
  });
});
