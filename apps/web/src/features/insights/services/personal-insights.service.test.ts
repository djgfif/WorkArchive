import { describe, expect, it } from 'vitest';

import type {
  TimelineEntryRecord,
  WorkRecord,
} from '@work-archive/shared-types';

import { calculatePersonalInsights } from './personal-insights.service';

function buildWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    author: '',
    catalogTitleId: null,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    description: '',
    droppedAt: null,
    favorite: false,
    genres: [],
    personalTags: [],
    id: crypto.randomUUID(),
    importDraft: null,
    progressCurrent: null,
    progressTotal: null,
    progressUnit: null,
    lastConsumedAt: null,
    lastConsumedLabel: null,
    rating: null,
    review: '',
    serverVersion: 0,
    shortReview: '',
    startedAt: null,
    status: 'planned',
    syncStatus: 'local-only',
    thumbnailUrl: '',
    title: 'Untitled',
    type: 'novel',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildTimelineEntry(
  overrides: Partial<TimelineEntryRecord> = {},
): TimelineEntryRecord {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    id: crypto.randomUUID(),
    note: '',
    occurredAt: '2026-01-02T00:00:00.000Z',
    serverVersion: 0,
    source: 'manual',
    syncStatus: 'local-only',
    type: 'rewatch',
    updatedAt: '2026-01-01T00:00:00.000Z',
    workId: 'work-1',
    ...overrides,
  };
}

describe('calculatePersonalInsights', () => {
  it('aggregates media, status, rating, and private review coverage', () => {
    const insights = calculatePersonalInsights(
      [
        buildWork({
          favorite: true,
          rating: 5,
          review: 'long note',
          status: 'completed',
          title: 'Dune',
          type: 'novel',
        }),
        buildWork({
          rating: 4,
          shortReview: 'good',
          status: 'in_progress',
          title: 'Frieren',
          type: 'manga',
        }),
        buildWork({
          rating: 4,
          status: 'dropped',
          title: 'Dropped',
          type: 'anime',
        }),
        buildWork({
          deletedAt: '2026-03-02T00:00:00.000Z',
          rating: 1,
          status: 'completed',
          title: 'Deleted',
        }),
      ],
      new Date('2026-04-27T00:00:00.000Z'),
    );

    expect(insights.totalWorks).toBe(3);
    expect(insights.averageRating).toBeCloseTo(4.333, 3);
    expect(insights.favoriteCount).toBe(1);
    expect(insights.reviewEmptyCount).toBe(1);
    expect(insights.typeCounts.novel).toBe(1);
    expect(insights.typeCounts.manga).toBe(1);
    expect(insights.typeCounts.anime).toBe(1);
    expect(insights.statusCounts.completed).toBe(1);
    expect(insights.statusCounts.in_progress).toBe(1);
    expect(insights.statusCounts.dropped).toBe(1);
    expect(insights.droppedCount).toBe(1);
    expect(insights.plannedCount).toBe(0);
    expect(insights.onHoldCount).toBe(0);
    expect(insights.ratingDistribution).toEqual([
      { count: 1, rating: 5 },
      { count: 2, rating: 4 },
    ]);
  });

  it('aggregates top personalTags and genres without legacy graph tags', () => {
    const insights = calculatePersonalInsights(
      [
        buildWork({
          genres: ['SF', '드라마'],
          personalTags: ['다시 볼 것', 'series:Dune'],
        }),
        buildWork({
          genres: ['SF'],
          personalTags: ['다시 볼 것', '정치극'],
        }),
        buildWork({
          genres: ['판타지'],
          personalTags: ['정치극'],
        }),
      ],
      new Date('2026-04-27T00:00:00.000Z'),
    );

    expect(insights.tagCounts).toEqual([
      { count: 2, tag: '다시 볼 것' },
      { count: 2, tag: '정치극' },
    ]);
    expect(insights.genreCounts).toEqual([
      { count: 2, genre: 'SF' },
      { count: 1, genre: '드라마' },
      { count: 1, genre: '판타지' },
    ]);
  });

  it('aggregates recent additions, recent updates, and completed-this-year records', () => {
    const insights = calculatePersonalInsights(
      [
        buildWork({
          completedAt: '2026-01-15T00:00:00.000Z',
          createdAt: '2026-04-20T00:00:00.000Z',
          status: 'completed',
          title: 'Recent completed',
          updatedAt: '2026-04-21T00:00:00.000Z',
        }),
        buildWork({
          completedAt: '2025-12-31T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
          status: 'completed',
          title: 'Old completed',
          updatedAt: '2026-04-23T00:00:00.000Z',
        }),
        buildWork({
          createdAt: '2026-04-10T00:00:00.000Z',
          status: 'planned',
          title: 'Recent planned',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
      ],
      new Date('2026-04-27T00:00:00.000Z'),
    );

    expect(insights.completedThisYearCount).toBe(1);
    expect(insights.addedRecentlyCount).toBe(2);
    expect(insights.updatedRecentlyCount).toBe(2);
    expect(insights.recentlyAddedWorks.map((work) => work.title)).toEqual([
      'Recent completed',
      'Recent planned',
    ]);
    expect(insights.recentlyUpdatedWorks.map((work) => work.title)).toEqual([
      'Old completed',
      'Recent completed',
    ]);
  });

  it('aggregates active repeat records only for active works', () => {
    const insights = calculatePersonalInsights(
      [
        buildWork({ id: 'work-1', title: 'Dune' }),
        buildWork({ id: 'work-2', title: 'Frieren' }),
        buildWork({
          deletedAt: '2026-03-01T00:00:00.000Z',
          id: 'work-deleted',
          title: 'Deleted',
        }),
      ],
      new Date('2026-04-27T00:00:00.000Z'),
      [
        buildTimelineEntry({
          id: 'repeat-1',
          occurredAt: '2026-01-02T00:00:00.000Z',
          workId: 'work-1',
        }),
        buildTimelineEntry({
          id: 'repeat-2',
          occurredAt: '2026-04-20T00:00:00.000Z',
          workId: 'work-1',
        }),
        buildTimelineEntry({
          id: 'repeat-3',
          occurredAt: '2025-12-01T00:00:00.000Z',
          workId: 'work-2',
        }),
        buildTimelineEntry({
          deletedAt: '2026-04-21T00:00:00.000Z',
          id: 'repeat-deleted',
          workId: 'work-1',
        }),
        buildTimelineEntry({
          id: 'repeat-deleted-work',
          workId: 'work-deleted',
        }),
        buildTimelineEntry({
          id: 'progress-entry',
          type: 'progress',
          workId: 'work-1',
        }),
      ],
    );

    expect(insights.repeatRecordCount).toBe(3);
    expect(insights.repeatedWorkCount).toBe(2);
    expect(insights.repeatedThisYearCount).toBe(2);
    expect(insights.topRepeatedWorks).toEqual([
      expect.objectContaining({
        count: 2,
        lastRepeatedAt: '2026-04-20T00:00:00.000Z',
        work: expect.objectContaining({ id: 'work-1', title: 'Dune' }),
      }),
      expect.objectContaining({
        count: 1,
        lastRepeatedAt: '2025-12-01T00:00:00.000Z',
        work: expect.objectContaining({ id: 'work-2', title: 'Frieren' }),
      }),
    ]);
  });
  it('builds a local-calendar activity rhythm from active timeline records', () => {
    const now = new Date(2026, 7, 3, 12);
    const occurredAt = (dayOffset: number) =>
      new Date(2026, 7, 3 + dayOffset, 12).toISOString();
    const dateKey = (value: Date) =>
      [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, '0'),
        String(value.getDate()).padStart(2, '0'),
      ].join('-');
    const insights = calculatePersonalInsights(
      [
        buildWork({ id: 'work-active', title: 'Active work' }),
        buildWork({
          deletedAt: occurredAt(-1),
          id: 'work-deleted',
          title: 'Deleted work',
        }),
      ],
      now,
      [
        buildTimelineEntry({
          id: 'today-progress',
          occurredAt: occurredAt(0),
          type: 'progress',
          workId: 'work-active',
        }),
        buildTimelineEntry({
          id: 'recent-note',
          occurredAt: occurredAt(-6),
          type: 'note',
          workId: 'work-active',
        }),
        buildTimelineEntry({
          id: 'older-start',
          occurredAt: occurredAt(-7),
          type: 'started',
          workId: 'work-active',
        }),
        buildTimelineEntry({
          id: 'window-edge',
          occurredAt: occurredAt(-27),
          type: 'rewatch',
          workId: 'work-active',
        }),
        buildTimelineEntry({
          id: 'outside-window',
          occurredAt: occurredAt(-28),
          type: 'note',
          workId: 'work-active',
        }),
        buildTimelineEntry({
          id: 'future-entry',
          occurredAt: occurredAt(1),
          type: 'note',
          workId: 'work-active',
        }),
        buildTimelineEntry({
          id: 'invalid-entry',
          occurredAt: 'not-a-date',
          type: 'note',
          workId: 'work-active',
        }),
        buildTimelineEntry({
          deletedAt: occurredAt(0),
          id: 'deleted-entry',
          occurredAt: occurredAt(0),
          type: 'note',
          workId: 'work-active',
        }),
        buildTimelineEntry({
          id: 'deleted-work-entry',
          occurredAt: occurredAt(0),
          type: 'note',
          workId: 'work-deleted',
        }),
      ],
    );

    expect(insights.activityDays).toHaveLength(28);
    expect(insights.activityDays[0]?.date).toBe(
      dateKey(new Date(2026, 7, 3 - 27, 12)),
    );
    expect(insights.activityDays.at(-1)?.date).toBe(dateKey(now));
    expect(insights.activityRecordCount).toBe(4);
    expect(insights.activityActiveDayCount).toBe(4);
    expect(insights.activityRecentRecordCount).toBe(2);
    expect(insights.activityLastRecordedAt).toBe(occurredAt(0));
  });

  it('returns an empty rhythm when the archive has no timeline activity', () => {
    const insights = calculatePersonalInsights(
      [buildWork({ id: 'work-active' })],
      new Date(2026, 7, 3, 12),
    );

    expect(insights.activityDays).toHaveLength(28);
    expect(insights.activityDays.every((day) => day.count === 0)).toBe(true);
    expect(insights.activityRecordCount).toBe(0);
    expect(insights.activityActiveDayCount).toBe(0);
    expect(insights.activityRecentRecordCount).toBe(0);
    expect(insights.activityLastRecordedAt).toBeNull();
  });
});
