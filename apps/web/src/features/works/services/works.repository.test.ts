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
    description: 'Classic science fiction',
    thumbnailUrl: '',
    status: 'planned',
    rating: null,
    shortReview: '',
    review: '',
    tier: null,
    favorite: false,
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
    repository = new WorksRepository(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('creates and updates a work record', async () => {
    const work = buildWork();

    await repository.create(work);

    const created = await repository.getById(work.id);

    expect(created).toEqual(work);

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
    const storedWork = await repository.getById(work.id);

    expect(activeWorks).toHaveLength(0);
    expect(storedWork?.deletedAt).toBe('2026-01-03T00:00:00.000Z');
  });
});
