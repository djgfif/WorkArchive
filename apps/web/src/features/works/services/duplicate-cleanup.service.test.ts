import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  TimelineEntryRecord,
  UserReleaseRecord,
  WorkRecord,
} from '@work-archive/shared-types';

import {
  createWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../db/work-archive.db';
import {
  DuplicateCleanupService,
  DUPLICATE_CLEANUP_IGNORED_META_KEY,
} from './duplicate-cleanup.service';

function buildWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  const now = '2026-05-20T00:00:00.000Z';

  return {
    author: 'Frank Herbert',
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
    thumbnailUrl: '',
    title: 'Dune',
    type: 'novel',
    updatedAt: now,
    ...overrides,
  };
}

function buildReleaseRecord(
  overrides: Partial<UserReleaseRecord> = {},
): UserReleaseRecord {
  const now = '2026-05-20T00:00:00.000Z';

  return {
    catalogReleaseId: 'catalog-release-1',
    createdAt: now,
    deletedAt: null,
    favorite: false,
    id: crypto.randomUUID(),
    rating: 4,
    review: 'release review',
    serverVersion: 0,
    shortReview: 'release note',
    status: 'completed',
    syncStatus: 'local-only',
    updatedAt: now,
    userWorkRecordId: 'work-1',
    ...overrides,
  };
}

function buildTimelineEntry(
  overrides: Partial<TimelineEntryRecord> = {},
): TimelineEntryRecord {
  const now = '2026-05-20T00:00:00.000Z';

  return {
    createdAt: now,
    deletedAt: null,
    id: crypto.randomUUID(),
    note: 'finished volume 1',
    occurredAt: now,
    serverVersion: 0,
    syncStatus: 'local-only',
    type: 'progress',
    updatedAt: now,
    workId: 'work-1',
    ...overrides,
  };
}

describe('DuplicateCleanupService', () => {
  let db: WorkArchiveDatabase;
  let service: DuplicateCleanupService;

  beforeEach(() => {
    db = createWorkArchiveDb(`work-archive-duplicate-test-${crypto.randomUUID()}`);
    service = new DuplicateCleanupService(() => db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('detects duplicate candidates by catalogTitleId', async () => {
    await db.works.bulkAdd([
      buildWork({ id: 'work-1', catalogTitleId: 'catalog-title-1' }),
      buildWork({ id: 'work-2', catalogTitleId: 'catalog-title-1' }),
      buildWork({
        id: 'work-3',
        author: 'Ursula K. Le Guin',
        catalogTitleId: 'catalog-title-2',
        title: 'The Left Hand of Darkness',
      }),
    ]);

    const groups = await service.listDuplicateCandidateGroups();

    expect(groups).toHaveLength(1);
    expect(groups[0]?.works.map((work) => work.id).sort()).toEqual([
      'work-1',
      'work-2',
    ]);
    expect(groups[0]?.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence: 'catalog-title-1',
          rule: 'catalogTitleId',
        }),
      ]),
    );
  });

  it('detects duplicate candidates by importDraft externalRefs', async () => {
    await db.works.bulkAdd([
      buildWork({
        id: 'work-1',
        importDraft: {
          externalRefs: [
            {
              externalId: '9780441172719',
              provider: 'aladin',
              rawType: 'isbn',
            },
          ],
          mediumType: 'novel',
        },
      }),
      buildWork({
        id: 'work-2',
        importDraft: {
          externalRefs: [
            {
              externalId: '9780441172719',
              provider: 'aladin',
              rawType: 'isbn',
            },
          ],
          mediumType: 'novel',
        },
      }),
    ]);

    const groups = await service.listDuplicateCandidateGroups();

    expect(groups).toHaveLength(1);
    expect(groups[0]?.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence: 'aladin:isbn:9780441172719',
          rule: 'externalRef',
        }),
      ]),
    );
  });

  it('detects duplicate candidates by normalized title, type, and author', async () => {
    await db.works.bulkAdd([
      buildWork({ id: 'work-1', title: ' Dune (Novel) ' }),
      buildWork({ id: 'work-2', title: 'dune' }),
      buildWork({ id: 'work-3', author: 'Different Author', title: 'dune' }),
    ]);

    const groups = await service.listDuplicateCandidateGroups();

    expect(groups).toHaveLength(1);
    expect(groups[0]?.works.map((work) => work.id).sort()).toEqual([
      'work-1',
      'work-2',
    ]);
    expect(groups[0]?.reasons).toEqual([
      expect.objectContaining({
        rule: 'normalizedTitleAuthor',
      }),
    ]);
  });

  it('removes a false positive after a local not-duplicate decision', async () => {
    await db.works.bulkAdd([
      buildWork({ id: 'work-1', catalogTitleId: 'catalog-title-1' }),
      buildWork({ id: 'work-2', catalogTitleId: 'catalog-title-1' }),
    ]);

    await service.markGroupNotDuplicate(['work-1', 'work-2']);

    expect(await service.listDuplicateCandidateGroups()).toEqual([]);
    expect(await db.appMeta.get(DUPLICATE_CLEANUP_IGNORED_META_KEY)).toEqual(
      expect.objectContaining({
        value: expect.stringContaining('work-1::work-2'),
      }),
    );
  });

  it('merges duplicates by unioning tags and preserving timeline and release records on the target', async () => {
    await db.works.bulkAdd([
      buildWork({
        id: 'work-1',
        genres: ['판타지'],
        personalTags: ['classic'],
        title: 'Dune',
      }),
      buildWork({
        id: 'work-2',
        genres: ['SF'],
        personalTags: ['reread'],
        title: 'Dune',
      }),
    ]);
    await db.releaseRecords.add(
      buildReleaseRecord({
        id: 'release-1',
        userWorkRecordId: 'work-2',
      }),
    );
    await db.timelineEntries.add(
      buildTimelineEntry({
        id: 'timeline-1',
        workId: 'work-2',
      }),
    );

    const result = await service.mergeDuplicates({
      sourceWorkIds: ['work-2'],
      targetWorkId: 'work-1',
    });
    const target = await db.works.get('work-1');
    const source = await db.works.get('work-2');
    const releaseRecords = await db.releaseRecords.toArray();
    const timelineEntries = await db.timelineEntries.toArray();

    expect(result.deletedWorkIds).toEqual(['work-2']);
    expect(target).toEqual(
      expect.objectContaining({
        genres: ['판타지', 'SF'],
        personalTags: ['classic', 'reread'],
      }),
    );
    expect(source?.deletedAt).toEqual(expect.any(String));
    expect(
      releaseRecords.filter(
        (record) =>
          record.userWorkRecordId === 'work-1' && record.deletedAt === null,
      ),
    ).toEqual([
      expect.objectContaining({
        catalogReleaseId: 'catalog-release-1',
        rating: 4,
        review: 'release review',
      }),
    ]);
    expect(
      releaseRecords.find((record) => record.id === 'release-1')?.deletedAt,
    ).toEqual(expect.any(String));
    expect(
      timelineEntries.filter(
        (entry) => entry.workId === 'work-1' && entry.deletedAt === null,
      ),
    ).toEqual([
      expect.objectContaining({
        note: 'finished volume 1',
        type: 'progress',
      }),
    ]);
    expect(
      timelineEntries.find((entry) => entry.id === 'timeline-1')?.deletedAt,
    ).toEqual(expect.any(String));
  });

  it('requires a manual scalar choice before merging disagreeing personal fields', async () => {
    await db.works.bulkAdd([
      buildWork({
        id: 'work-1',
        catalogTitleId: 'catalog-title-1',
        rating: 5,
      }),
      buildWork({
        id: 'work-2',
        catalogTitleId: 'catalog-title-1',
        rating: 3,
      }),
    ]);

    await expect(
      service.mergeDuplicates({
        sourceWorkIds: ['work-2'],
        targetWorkId: 'work-1',
      }),
    ).rejects.toThrow('평점 값이 서로 달라 직접 선택해야 합니다.');

    const preview = await service.getMergePreview({
      sourceWorkIds: ['work-2'],
      targetWorkId: 'work-1',
    });

    expect(preview.conflicts).toEqual([
      expect.objectContaining({
        field: 'rating',
      }),
    ]);
  });
});
