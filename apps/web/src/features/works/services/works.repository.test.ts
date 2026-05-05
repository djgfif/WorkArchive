import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { WorkRecord } from '@work-archive/shared-types';

import {
  createWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../db/work-archive.db';
import { WorksRepository } from './works.repository';

function buildWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: crypto.randomUUID(),
    type: 'novel',
    title: 'Dune',
    author: 'Frank Herbert',
    genres: ['Science Fiction'],
    personalTags: [],
    description: 'Classic science fiction',
    thumbnailUrl: '',
    status: 'planned',
    rating: null,
    shortReview: '',
    review: '',
    tier: null,
    favorite: false,
    startedAt: null,
    completedAt: null,
    droppedAt: null,
    lastConsumedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

describe('WorksRepository', () => {
  let db: WorkArchiveDatabase;
  let repository: WorksRepository;

  beforeEach(() => {
    db = createWorkArchiveDb(`work-archive-test-${crypto.randomUUID()}`);
    repository = new WorksRepository(() => db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('creates and updates a work record', async () => {
    const work = buildWork();

    await repository.create(work);

    const created = await repository.getById(work.id);
    const rawCreated = await db.works.get(work.id);

    expect(created).toEqual(work);
    expect(rawCreated).toEqual(
      expect.objectContaining({
        _deletedAtScope: 'active',
      }),
    );

    const updatedWork = {
      ...work,
      title: 'Dune Messiah',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };

    await repository.update(updatedWork);

    expect(await repository.getById(work.id)).toEqual(updatedWork);
  });

  it('soft deletes a work while keeping the record', async () => {
    const work = buildWork();

    await repository.create(work);
    await repository.softDelete(work.id, {
      deletedAt: '2026-01-03T00:00:00.000Z',
      syncStatus: 'local-only',
      updatedAt: '2026-01-03T00:00:00.000Z',
    });

    const activeWorks = await repository.listActive();
    const allWorks = await repository.listAll();
    const storedWork = await repository.getById(work.id);

    expect(activeWorks).toHaveLength(0);
    expect(allWorks).toHaveLength(1);
    expect(storedWork?.deletedAt).toBe('2026-01-03T00:00:00.000Z');
  });

  it('restores a soft-deleted work back into the active list', async () => {
    const work = buildWork({
      deletedAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
    });

    await repository.create(work);
    await repository.restore(work.id, {
      deletedAt: null,
      syncStatus: 'pending',
      updatedAt: '2026-01-04T00:00:00.000Z',
    });

    const activeWorks = await repository.listActive();
    const deletedWorks = await repository.listDeleted();
    const restoredWork = await repository.getById(work.id);

    expect(activeWorks).toHaveLength(1);
    expect(deletedWorks).toHaveLength(0);
    expect(restoredWork).toEqual(
      expect.objectContaining({
        deletedAt: null,
        syncStatus: 'pending',
        updatedAt: '2026-01-04T00:00:00.000Z',
      }),
    );
  });

  it('queries works through scope-first indexes before applying list filters', async () => {
    const activeOlder = buildWork({
      id: 'active-older',
      status: 'planned',
      title: 'Dune',
      type: 'novel',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    const activeNewer = buildWork({
      id: 'active-newer',
      status: 'completed',
      title: 'Arrival',
      type: 'movie',
      updatedAt: '2026-01-04T00:00:00.000Z',
    });
    const deleted = buildWork({
      deletedAt: '2026-01-05T00:00:00.000Z',
      id: 'deleted-work',
      status: 'planned',
      title: 'Deleted Dune',
      type: 'novel',
      updatedAt: '2026-01-05T00:00:00.000Z',
    });

    await repository.bulkPut([activeOlder, activeNewer, deleted]);

    await expect(
      repository.listByScopeForQuery('active', {
        sortBy: 'updatedAt',
        status: 'all',
        type: 'all',
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'active-newer' }),
      expect.objectContaining({ id: 'active-older' }),
    ]);
    await expect(
      repository.listByScopeForQuery('active', {
        sortBy: 'updatedAt',
        status: 'completed',
        type: 'all',
      }),
    ).resolves.toEqual([expect.objectContaining({ id: 'active-newer' })]);
    await expect(
      repository.listByScopeForQuery('deleted', {
        sortBy: 'updatedAt',
        status: 'all',
        type: 'novel',
      }),
    ).resolves.toEqual([expect.objectContaining({ id: 'deleted-work' })]);
  });
});
