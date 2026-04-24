import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { WorkRecord } from '@work-archive/shared-types';

import {
  createWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../db/work-archive.db';
import { SyncQueueRepository } from '../../sync/services/sync-queue.repository';
import { WorksRepository } from './works.repository';
import { WorksService } from './works.service';

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

function buildWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: crypto.randomUUID(),
    ...buildInput(),
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'synced',
    serverVersion: 2,
    ...overrides,
  };
}

describe('WorksService', () => {
  let db: WorkArchiveDatabase;
  let repository: WorksRepository;
  let queueRepository: SyncQueueRepository;
  let service: WorksService;

  beforeEach(() => {
    db = createWorkArchiveDb(`work-archive-test-${crypto.randomUUID()}`);
    repository = new WorksRepository(() => db);
    queueRepository = new SyncQueueRepository(() => db);
    service = new WorksService(repository, queueRepository);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('keeps a single create queue item while a local-only work changes', async () => {
    const created = await service.createWork(
      buildInput({
        catalogTitleId: 'catalog-title-1',
        importDraft: {
          catalogTitle: 'Dune',
          mediumType: 'novel',
          externalRefs: [
            {
              provider: 'aladin',
              externalId: '123',
              rawType: 'novel',
            },
          ],
        },
      }),
    );

    expect(await queueRepository.listAll()).toEqual([
      expect.objectContaining({
        entityId: created.id,
        operation: 'create',
        payload: expect.objectContaining({
          catalogTitleId: 'catalog-title-1',
          importDraft: expect.objectContaining({
            catalogTitle: 'Dune',
          }),
        }),
        retryCount: 0,
      }),
    ]);

    await service.updateWork(
      created.id,
      buildInput({
        title: 'Dune Messiah',
      }),
    );

    const queuedAfterUpdate = await queueRepository.listAll();

    expect(queuedAfterUpdate).toHaveLength(1);
    expect(queuedAfterUpdate[0]).toEqual(
      expect.objectContaining({
        entityId: created.id,
        operation: 'create',
        payload: expect.objectContaining({
          title: 'Dune Messiah',
          syncStatus: 'local-only',
        }),
      }),
    );

    await service.deleteWork(created.id);

    expect(await queueRepository.listAll()).toEqual([]);
    expect(await repository.getById(created.id)).toEqual(
      expect.objectContaining({
        deletedAt: expect.any(String),
      }),
    );
  });

  it('queues updates for works that already exist on the server', async () => {
    const existing = buildWork();

    await repository.create(existing);

    await service.updateWork(
      existing.id,
      buildInput({
        title: 'Children of Dune',
      }),
    );

    expect(await queueRepository.listAll()).toEqual([
      expect.objectContaining({
        entityId: existing.id,
        operation: 'update',
        payload: expect.objectContaining({
          title: 'Children of Dune',
          syncStatus: 'pending',
          serverVersion: 2,
        }),
      }),
    ]);
  });

  it('coalesces a synced work update into a single delete queue item', async () => {
    const existing = buildWork({
      syncStatus: 'synced',
      serverVersion: 4,
    });

    await repository.create(existing);

    await service.updateWork(
      existing.id,
      buildInput({
        title: 'Children of Dune',
      }),
    );
    await service.deleteWork(existing.id);

    const queueItems = await queueRepository.listAll();

    expect(queueItems).toHaveLength(1);
    expect(queueItems[0]).toEqual(
      expect.objectContaining({
        entityId: existing.id,
        operation: 'delete',
        payload: expect.objectContaining({
          title: 'Children of Dune',
          deletedAt: expect.any(String),
          syncStatus: 'pending',
          serverVersion: 4,
        }),
      }),
    );
  });

  it('restores a deleted work and queues it back for sync', async () => {
    const existing = buildWork({
      deletedAt: '2026-04-18T01:00:00.000Z',
      syncStatus: 'synced',
      updatedAt: '2026-04-18T01:00:00.000Z',
    });

    await repository.create(existing);

    const restored = await service.restoreWork(existing.id);
    const queueItems = await queueRepository.listAll();

    expect(restored).toEqual(
      expect.objectContaining({
        deletedAt: null,
        syncStatus: 'pending',
      }),
    );
    expect(queueItems).toEqual([
      expect.objectContaining({
        entityId: existing.id,
        operation: 'update',
        payload: expect.objectContaining({
          deletedAt: null,
          syncStatus: 'pending',
        }),
      }),
    ]);
  });
});
