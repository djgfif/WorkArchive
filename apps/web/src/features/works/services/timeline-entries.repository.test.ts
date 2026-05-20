import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { TimelineEntryRecord } from '@work-archive/shared-types';

import {
  createWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../db/work-archive.db';
import { WorksRepository } from './works.repository';
import { TimelineEntriesRepository } from './timeline-entries.repository';

describe('TimelineEntriesRepository', () => {
  let db: WorkArchiveDatabase;
  let timelineRepository: TimelineEntriesRepository;
  let worksRepository: WorksRepository;

  beforeEach(() => {
    db = createWorkArchiveDb(`timeline-entry-test-${crypto.randomUUID()}`);
    timelineRepository = new TimelineEntriesRepository(() => db);
    worksRepository = new WorksRepository(() => db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('creates and lists active timeline entries by work in reverse date order', async () => {
    await worksRepository.create({
      author: 'Author',
      catalogTitleId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
      description: '',
      favorite: false,
      genres: [],
      id: 'work-1',
      importDraft: null,
      personalTags: [],
      rating: null,
      review: '',
      serverVersion: 0,
      shortReview: '',
      status: 'in_progress',
      syncStatus: 'local-only',
      thumbnailUrl: '',
      title: 'Timeline Work',
      type: 'novel',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const older = await timelineRepository.create({
      note: '시작했다.',
      occurredAt: '2026-01-02T00:00:00.000Z',
      type: 'started',
      workId: 'work-1',
    });
    const newer = await timelineRepository.create({
      note: '2권까지 읽었다.',
      occurredAt: '2026-01-03T00:00:00.000Z',
      type: 'progress',
      workId: 'work-1',
    });
    await timelineRepository.create({
      note: '다른 작품 기록',
      occurredAt: '2026-01-04T00:00:00.000Z',
      type: 'note',
      workId: 'work-2',
    });

    await expect(timelineRepository.listByWorkId('work-1')).resolves.toEqual([
      expect.objectContaining({ id: newer.id }),
      expect.objectContaining({ id: older.id }),
    ]);
  });

  it('soft deletes entries without returning them from work timelines', async () => {
    const entry = await timelineRepository.create({
      note: '지울 기록',
      occurredAt: '2026-01-02T00:00:00.000Z',
      type: 'note',
      workId: 'work-1',
    });

    await timelineRepository.softDelete(entry.id);

    expect(await timelineRepository.listByWorkId('work-1')).toEqual([]);
    expect(await db.timelineEntries.get(entry.id)).toEqual(
      expect.objectContaining({
        deletedAt: expect.any(String),
      }),
    );
  });

  it('bulk imports entries for archive restore paths', async () => {
    const entry: TimelineEntryRecord = {
      createdAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
      id: 'timeline-1',
      note: '백업에서 가져온 기록',
      occurredAt: '2026-01-02T00:00:00.000Z',
      serverVersion: 0,
      syncStatus: 'local-only',
      type: 'note',
      updatedAt: '2026-01-01T00:00:00.000Z',
      workId: 'work-1',
    };

    await timelineRepository.bulkImport([entry]);

    expect(await timelineRepository.listByWorkId('work-1')).toEqual([entry]);
  });
});
