import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserReleaseRecord, WorkRecord } from '@work-archive/shared-types';

import {
  clearStoredAuthTokens,
  writeStoredAuthTokens,
} from '../../auth/services/auth-storage';
import {
  createWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../../works/db/work-archive.db';
import { WorksRepository } from '../../works/services/works.repository';
import { WorksService } from '../../works/services/works.service';
import { ReleaseRecordsRepository } from '../../works/services/release-records.repository';
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
    tier: null,
    favorite: false,
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
  let queueRepository: SyncQueueRepository;
  let appMetaRepository: AppMetaRepository;
  let worksService: WorksService;
  let syncService: SyncService;

  beforeEach(() => {
    db = createWorkArchiveDb(`work-archive-test-${crypto.randomUUID()}`);
    worksRepository = new WorksRepository(() => db);
    releaseRecordsRepository = new ReleaseRecordsRepository(() => db);
    queueRepository = new SyncQueueRepository(() => db);
    appMetaRepository = new AppMetaRepository(() => db);
    worksService = new WorksService(worksRepository, queueRepository);
    syncService = new SyncService(
      worksRepository,
      releaseRecordsRepository,
      queueRepository,
      appMetaRepository,
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
          schemaVersion: 1,
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
          schemaVersion: 2,
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
      shortReview: '1권 감상',
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
          schemaVersion: 1,
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
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 1,
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


  it('marks the local work as conflict when push returns a conflict result', async () => {
    const localWork = await worksService.createWork(buildInput());
    const queueItems = await queueRepository.listAll();
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          schemaVersion: 1,
          processedAt: '2026-04-18T01:00:00.000Z',
          results: [
            {
              queueId: queueItems[0]!.id,
              entityId: localWork.id,
              entityType: 'work',
              status: 'conflict',
              message:
                'Conflict: server version 3 updated at 2026-04-18T01:00:00.000Z won.',
              work: {
                ...localWork,
                syncStatus: 'synced',
                serverVersion: 3,
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
        appliedCount: 0,
        conflictCount: 1,
        failedCount: 0,
      }),
    );
    expect(await queueRepository.listAll()).toEqual([
      expect.objectContaining({
        entityId: localWork.id,
        retryCount: 1,
        lastError:
          '다른 곳에서 더 최근 변경이 반영되어 충돌이 발생했습니다. 내용을 확인한 뒤 다시 시도해주세요.',
        conflict: expect.objectContaining({
          message:
            '다른 곳에서 더 최근 변경이 반영되어 충돌이 발생했습니다. 내용을 확인한 뒤 다시 시도해주세요.',
          remote: expect.objectContaining({
            id: localWork.id,
            serverVersion: 3,
          }),
        }),
      }),
    ]);
    expect(await worksRepository.getById(localWork.id)).toEqual(
      expect.objectContaining({
        syncStatus: 'conflict',
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
          schemaVersion: 1,
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
                updatedAt: '2026-04-18T01:30:00.000Z',
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
          schemaVersion: 2,
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

  it('keeps the pull cursor in place when remote changes are skipped due to queued local work', async () => {
    const existing = await worksService.createWork(
      buildInput({
        title: 'Dune',
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
          schemaVersion: 1,
          pulledAt: '2026-04-18T02:00:00.000Z',
          nextSince: '2026-04-18T01:30:00.000Z',
          changes: [
            {
              entityType: 'work',
              entityId: existing.id,
              operation: 'upsert',
              work: {
                ...existing,
                title: 'Dune Messiah',
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
    const queueAfterPull = await queueRepository.getById(queueItem!.id);

    expect(result).toEqual(
      expect.objectContaining({
        pulledCount: 1,
        appliedCount: 0,
        skippedCount: 1,
        nextSince: '2026-04-18T00:00:00.000Z',
        requestFailed: false,
      }),
    );
    expect(queueAfterPull).toEqual(
      expect.objectContaining({
        retryCount: 1,
        lastError:
          '다른 곳에서 변경된 내용이 있어 자동으로 가져오지 않았습니다.',
        conflict: expect.objectContaining({
          code: 'pull_conflict_local_queue',
          message:
            '다른 곳에서 변경된 내용이 있어 자동으로 가져오지 않았습니다.',
          remote: expect.objectContaining({
            id: existing.id,
            title: 'Dune Messiah',
            serverVersion: 2,
          }),
        }),
      }),
    );
    expect(await worksRepository.getById(existing.id)).toEqual(
      expect.objectContaining({
        title: 'Dune',
        syncStatus: 'conflict',
        serverVersion: 0,
      }),
    );
    await expect(
      appMetaRepository.getValue('sync.lastSuccessfulPullAt'),
    ).resolves.toBe('2026-04-18T00:00:00.000Z');
  });
});
