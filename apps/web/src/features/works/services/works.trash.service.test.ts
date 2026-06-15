import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { WorkRecord } from '@work-archive/shared-types';

import {
  createWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../db/work-archive.db';
import { WorksRepository } from './works.repository';
import { WorksService } from './works.service';
import type { SyncQueueRepository } from '../../sync/queue';

function buildWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: crypto.randomUUID(),
    type: 'novel',
    title: 'Dune',
    author: 'Frank Herbert',
    genres: [],
    personalTags: [],
    description: '',
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

describe('WorksService trash purge', () => {
  let db: WorkArchiveDatabase;
  let service: WorksService;

  beforeEach(() => {
    db = createWorkArchiveDb(`work-archive-trash-test-${crypto.randomUUID()}`);
    // 영구 삭제·정리 경로는 queue/graph 를 사용하지 않으므로 no-op 스텁이면 충분하다.
    const queueStub = {} as unknown as SyncQueueRepository;
    service = new WorksService(new WorksRepository(() => db), queueStub);
  });

  afterEach(async () => {
    await db.delete();
  });

  function deletedDaysAgo(days: number, id: string): WorkRecord {
    const iso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    return buildWork({ id, deletedAt: iso, updatedAt: iso });
  }

  it('purges only trash items older than the retention window', async () => {
    await db.works.bulkPut([
      { ...deletedDaysAgo(40, 'old'), _deletedAtScope: 'deleted' },
      { ...deletedDaysAgo(10, 'recent'), _deletedAtScope: 'deleted' },
      { ...buildWork({ id: 'active' }), _deletedAtScope: 'active' },
    ] as never);

    const purged = await service.purgeExpiredTrash(30);

    expect(purged).toBe(1);
    expect(await db.works.get('old')).toBeUndefined();
    expect(await db.works.get('recent')).toBeTruthy();
    expect(await db.works.get('active')).toBeTruthy();
  });

  it('does not purge anything when retention is zero or negative', async () => {
    await db.works.bulkPut([
      { ...deletedDaysAgo(400, 'ancient'), _deletedAtScope: 'deleted' },
    ] as never);

    expect(await service.purgeExpiredTrash(0)).toBe(0);
    expect(await db.works.get('ancient')).toBeTruthy();
  });

  it('empties the entire trash but leaves active works intact', async () => {
    await db.works.bulkPut([
      { ...deletedDaysAgo(1, 'd1'), _deletedAtScope: 'deleted' },
      { ...deletedDaysAgo(2, 'd2'), _deletedAtScope: 'deleted' },
      { ...buildWork({ id: 'keep' }), _deletedAtScope: 'active' },
    ] as never);

    const emptied = await service.emptyTrash();

    expect(emptied).toBe(2);
    expect(await db.works.get('keep')).toBeTruthy();
    expect(await db.works.where('_deletedAtScope').equals('deleted').count())
      .toBe(0);
  });

  it('refuses to permanently delete a work that is not in the trash', async () => {
    await db.works.bulkPut([
      { ...buildWork({ id: 'active' }), _deletedAtScope: 'active' },
    ] as never);

    await expect(service.permanentlyDeleteWork('active')).rejects.toThrow();
    expect(await db.works.get('active')).toBeTruthy();
  });
});
