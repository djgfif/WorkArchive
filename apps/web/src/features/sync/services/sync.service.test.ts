import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkRecord } from '@work-archive/shared-types';

import {
  createWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../../works/db/work-archive.db';
import { WorksRepository } from '../../works/services/works.repository';
import { WorksService } from '../../works/services/works.service';
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
  let queueRepository: SyncQueueRepository;
  let appMetaRepository: AppMetaRepository;
  let worksService: WorksService;
  let syncService: SyncService;

  beforeEach(() => {
    db = createWorkArchiveDb(`work-archive-test-${crypto.randomUUID()}`);
    worksRepository = new WorksRepository(() => db);
    queueRepository = new SyncQueueRepository(() => db);
    appMetaRepository = new AppMetaRepository(() => db);
    worksService = new WorksService(worksRepository, queueRepository);
    syncService = new SyncService(
      worksRepository,
      queueRepository,
      appMetaRepository,
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await db.delete();
  });

  it('removes successful queue items and updates the local work from push results', async () => {
    const localWork = await worksService.createWork(buildInput());
    const queueItems = await queueRepository.listAll();
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
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

  it('keeps failed queue items with retry metadata when push fails', async () => {
    const localWork = await worksService.createWork(buildInput());
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    );

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
        lastError: '동기화 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
      }),
    ]);
  });

  it('marks the local work as conflict when push returns a conflict result', async () => {
    const localWork = await worksService.createWork(buildInput());
    const queueItems = await queueRepository.listAll();
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
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
        lastError: '다른 곳에서 더 최근 변경이 반영되어 충돌이 발생했습니다. 내용을 확인한 뒤 다시 시도해주세요.',
      }),
    ]);
    expect(await worksRepository.getById(localWork.id)).toEqual(
      expect.objectContaining({
        syncStatus: 'conflict',
      }),
    );
  });

  it('pulls remote changes into the local database and advances the pull cursor', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
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

  it('keeps the pull cursor in place when remote changes are skipped due to queued local work', async () => {
    const existing = await worksService.createWork(
      buildInput({
        title: 'Dune',
      }),
    );
    const [queueItem] = await queueRepository.listAll();
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    );

    await appMetaRepository.setValue(
      'sync.lastSuccessfulPullAt',
      '2026-04-18T00:00:00.000Z',
    );
    await queueRepository.markFailed(queueItem!.id, 'Previous push failed.');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
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
          '다른 곳에서 변경된 내용이 있어 자동으로 가져오지 않았습니다. 내용을 확인한 뒤 다시 동기화해주세요.',
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
