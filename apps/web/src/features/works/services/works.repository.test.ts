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

  it('permanently deletes works and cascades owned records without touching other works or shared entities', async () => {
    const target = buildWork({
      id: 'target',
      deletedAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
    const other = buildWork({ id: 'other' });

    await repository.bulkPut([target, other]);

    await db.table('releaseRecords').bulkPut([
      { id: 'r1', userWorkRecordId: 'target' },
      { id: 'r2', userWorkRecordId: 'other' },
    ]);
    await db.table('timelineEntries').bulkPut([
      { id: 't1', workId: 'target' },
      { id: 't2', workId: 'other' },
    ]);
    await db.table('workSeriesLinks').bulkPut([
      { id: 'sl1', workId: 'target', seriesId: 's1', role: 'main' },
      { id: 'sl2', workId: 'other', seriesId: 's1', role: 'main' },
    ]);
    await db.table('workContributors').bulkPut([
      { id: 'wc1', workId: 'target', contributorId: 'c1', role: 'author' },
      { id: 'wc2', workId: 'other', contributorId: 'c1', role: 'author' },
    ]);
    await db.table('workRelations').bulkPut([
      { id: 'rel1', sourceWorkId: 'target', targetWorkId: 'other' },
      { id: 'rel2', sourceWorkId: 'other', targetWorkId: 'target' },
      { id: 'rel3', sourceWorkId: 'other', targetWorkId: 'x' },
    ]);
    // 공유 엔티티 — 영구 삭제 캐스케이드가 절대 건드려선 안 된다.
    await db.table('contributors').put({ id: 'c1', normalizedName: 'a' });
    await db.table('series').put({ id: 's1', normalizedTitle: 'b' });

    const removed = await repository.permanentlyDelete(['target']);

    expect(removed).toBe(1);
    expect(await repository.getById('target')).toBeNull();
    expect(await repository.getById('other')).not.toBeNull();

    const remainingIds = async (table: string) =>
      (await db.table(table).toArray()).map((row) => row.id).sort();

    expect(await remainingIds('releaseRecords')).toEqual(['r2']);
    expect(await remainingIds('timelineEntries')).toEqual(['t2']);
    expect(await remainingIds('workSeriesLinks')).toEqual(['sl2']);
    expect(await remainingIds('workContributors')).toEqual(['wc2']);
    // target 을 source 또는 target 으로 가리키는 관계는 모두 제거되고 rel3 만 남는다.
    expect(await remainingIds('workRelations')).toEqual(['rel3']);
    // 공유 엔티티는 그대로 유지된다.
    expect(await db.table('contributors').get('c1')).toBeTruthy();
    expect(await db.table('series').get('s1')).toBeTruthy();
  });

  it('treats permanentlyDelete of an empty id list as a no-op', async () => {
    await repository.create(buildWork({ id: 'keep' }));

    await expect(repository.permanentlyDelete([])).resolves.toBe(0);
    expect(await repository.getById('keep')).not.toBeNull();
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
