import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkRecord } from '@work-archive/shared-types';

import { SyncQueueRepository } from '../../sync/queue';
import {
  createWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../db/work-archive.db';
import {
  ArchiveHealthService,
  buildArchiveHealthReport,
} from './archive-health.service';
import { WorksRepository } from './works.repository';

function buildWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  const now = '2026-07-29T00:00:00.000Z';

  return {
    author: 'Ursula K. Le Guin',
    catalogTitleId: null,
    completedAt: null,
    createdAt: now,
    deletedAt: null,
    description: '',
    droppedAt: null,
    favorite: false,
    genres: [],
    id: crypto.randomUUID(),
    importDraft: null,
    lastConsumedAt: null,
    lastConsumedLabel: null,
    personalTags: [],
    progressCurrent: null,
    progressTotal: null,
    progressUnit: null,
    rating: null,
    review: '',
    serverVersion: 0,
    shortReview: '',
    startedAt: null,
    status: 'planned',
    syncStatus: 'local-only',
    thumbnailUrl: 'https://example.com/cover.jpg',
    title: 'The Left Hand of Darkness',
    type: 'novel',
    updatedAt: now,
    ...overrides,
  };
}

describe('buildArchiveHealthReport', () => {
  it('returns a healthy report for a consistent active record', () => {
    const report = buildArchiveHealthReport(
      [buildWork()],
      '2026-07-29T10:00:00.000Z',
    );

    expect(report).toEqual({
      affectedWorkCount: 0,
      issueCounts: {
        attention: 0,
        improvement: 0,
        review: 0,
      },
      issues: [],
      scannedAt: '2026-07-29T10:00:00.000Z',
      totalWorkCount: 1,
    });
  });

  it('finds invalid progress and keeps attention issues first', () => {
    const report = buildArchiveHealthReport([
      buildWork({
        id: 'work-improvement',
        thumbnailUrl: '',
        title: 'Coverless work',
      }),
      buildWork({
        id: 'work-progress',
        progressCurrent: 12,
        progressTotal: 10,
        progressUnit: 'chapter',
        title: 'Broken progress',
      }),
    ]);

    expect(report.issueCounts).toEqual({
      attention: 1,
      improvement: 1,
      review: 0,
    });
    expect(report.issues.map((issue) => issue.code)).toEqual([
      'progress_over_total',
      'missing_thumbnail',
    ]);
  });

  it('finds date ordering and status consistency problems', () => {
    const report = buildArchiveHealthReport([
      buildWork({
        completedAt: '2026-06-01T00:00:00.000Z',
        droppedAt: '2026-06-02T00:00:00.000Z',
        id: 'work-date-order',
        lastConsumedAt: 'not-a-date',
        startedAt: '2026-07-01T00:00:00.000Z',
        status: 'completed',
      }),
      buildWork({
        completedAt: null,
        id: 'work-completed-without-date',
        status: 'completed',
      }),
    ]);

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid_date' }),
        expect.objectContaining({ code: 'started_after_completed' }),
        expect.objectContaining({ code: 'started_after_dropped' }),
        expect.objectContaining({ code: 'completed_and_dropped' }),
        expect.objectContaining({ code: 'completed_without_date' }),
      ]),
    );
    expect(report.issueCounts).toEqual({
      attention: 3,
      improvement: 0,
      review: 2,
    });
  });

  it('flags progress without a unit as a review item', () => {
    const report = buildArchiveHealthReport([
      buildWork({
        progressCurrent: 4,
        progressTotal: 12,
        progressUnit: null,
      }),
    ]);

    expect(report.issues).toEqual([
      expect.objectContaining({
        code: 'progress_unit_missing',
        safeFix: {
          kind: 'set_progress_unit',
          progressUnit: 'volume',
        },
        severity: 'review',
      }),
    ]);
  });

  it('does not offer an inferred unit when the work type has no default', () => {
    const report = buildArchiveHealthReport([
      buildWork({
        progressCurrent: 1,
        progressUnit: null,
        type: 'other',
      }),
    ]);

    expect(report.issues).toEqual([
      expect.not.objectContaining({
        safeFix: expect.anything(),
      }),
    ]);
  });
});

describe('ArchiveHealthService', () => {
  let db: WorkArchiveDatabase;

  beforeEach(() => {
    db = createWorkArchiveDb(`work-archive-health-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('scans active works without reporting trash records', async () => {
    const repository = new WorksRepository(() => db);

    await repository.bulkPut([
      buildWork({
        id: 'active-work',
        thumbnailUrl: '',
      }),
      buildWork({
        deletedAt: '2026-07-29T00:00:00.000Z',
        id: 'deleted-work',
        thumbnailUrl: '',
      }),
    ]);
    const service = new ArchiveHealthService(repository);

    const report = await service.scan();

    expect(report.totalWorkCount).toBe(1);
    expect(report.issues).toEqual([
      expect.objectContaining({
        code: 'missing_thumbnail',
        workId: 'active-work',
      }),
    ]);
  });

  it('applies a deterministic fix, records history, syncs it, and undoes it', async () => {
    const repository = new WorksRepository(() => db);
    const queueRepository = new SyncQueueRepository(() => db);
    const service = new ArchiveHealthService(
      repository,
      queueRepository,
      () => db,
    );

    await repository.bulkPut([
      buildWork({
        id: 'anime-without-unit',
        progressCurrent: 3,
        progressTotal: 12,
        progressUnit: null,
        title: 'Unitless Anime',
        type: 'anime',
      }),
    ]);

    const applied = await service.applySafeFix('anime-without-unit', {
      kind: 'set_progress_unit',
      progressUnit: 'episode',
    });

    await expect(
      repository.getById('anime-without-unit'),
    ).resolves.toMatchObject({
      progressUnit: 'episode',
    });
    await expect(queueRepository.listAll()).resolves.toEqual([
      expect.objectContaining({
        entityId: 'anime-without-unit',
        source: 'archive_health_fix',
      }),
    ]);
    await expect(service.listFixHistory()).resolves.toEqual([
      expect.objectContaining({
        afterProgressUnit: 'episode',
        id: applied.id,
        undoneAt: null,
      }),
    ]);

    const undone = await service.undoSafeFix(applied.id);

    expect(undone.undoneAt).not.toBeNull();
    await expect(
      repository.getById('anime-without-unit'),
    ).resolves.toMatchObject({
      progressUnit: null,
    });
    await expect(service.listFixHistory()).resolves.toEqual([
      expect.objectContaining({
        id: applied.id,
        undoneAt: expect.any(String),
      }),
    ]);
  });

  it('refuses to overwrite a unit changed after a safe fix', async () => {
    const repository = new WorksRepository(() => db);
    const queueRepository = new SyncQueueRepository(() => db);
    const service = new ArchiveHealthService(
      repository,
      queueRepository,
      () => db,
    );
    const work = buildWork({
      id: 'changed-after-fix',
      progressCurrent: 3,
      progressUnit: null,
      type: 'anime',
    });

    await repository.bulkPut([work]);
    const applied = await service.applySafeFix(work.id, {
      kind: 'set_progress_unit',
      progressUnit: 'episode',
    });
    const fixedWork = await repository.getById(work.id);

    await repository.update({
      ...fixedWork!,
      progressUnit: 'chapter',
      updatedAt: '2026-07-29T11:00:00.000Z',
    });

    await expect(service.undoSafeFix(applied.id)).rejects.toThrow();
    await expect(repository.getById(work.id)).resolves.toMatchObject({
      progressUnit: 'chapter',
    });
  });
});
