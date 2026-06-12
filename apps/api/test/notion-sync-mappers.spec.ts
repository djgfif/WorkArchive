import { ProgressUnit, WorkStatus } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import {
  buildNotionProperties,
  buildNotionPullUpdateData,
  diffNotionSafeValues,
  isUsableNotionSchema,
  normalizeNotionDataSourceId,
  PROPERTY_NAMES,
  readSafeValuesFromNotionPage,
  type NotionChangePreview,
  type NotionDataSourceSchema,
} from '../src/modules/notion/notion-sync-mappers';
import type { WorkAggregate } from '../src/modules/user-records/user-records.types';

function makeWork(overrides: Partial<WorkAggregate> = {}): WorkAggregate {
  return {
    id: 'work-1',
    catalogTitleId: 'title-1',
    userId: 'user-1',
    catalogWorkId: 'catalog-work-1',
    status: WorkStatus.completed,
    rating: 4.5,
    personalTags: ['고전', '재독'],
    shortReview: '짧은 감상',
    review: '긴 감상',
    favorite: true,
    progressCurrent: 12,
    progressTotal: 12,
    progressUnit: ProgressUnit.volume,
    lastConsumedLabel: null,
    startedAt: new Date('2026-01-01T12:00:00.000Z'),
    completedAt: new Date('2026-02-03T12:00:00.000Z'),
    droppedAt: null,
    lastConsumedAt: null,
    importDraft: null,
    catalogTitle: {
      id: 'title-1',
      mediumType: 'light_novel',
      displayTitle: '늑대와 향신료',
      originalTitle: null,
      romajiTitle: null,
      englishTitle: null,
      aliases: [],
      countryOfOrigin: null,
      language: null,
      status: null,
      releaseYear: null,
      releaseDate: null,
      endDate: null,
      synopsis: null,
      summary: null,
      thumbnailUrl: null,
      coverImageUrl: null,
      officialSiteUrl: null,
      externalRefs: [],
      averageRating: null,
      ratingCount: 0,
      popularityScore: null,
      verificationStatus: 'unverified',
      dataQualityScore: null,
      franchiseId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      franchise: null,
      contributors: [],
      outgoingRelations: [],
    },
    catalogWork: {
      id: 'catalog-work-1',
      type: 'novel',
      title: 'Fallback Title',
      author: null,
      genres: [],
      description: null,
      thumbnailUrl: null,
      externalId: null,
      source: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    syncStatus: 'synced',
    serverVersion: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-04T05:06:07.000Z'),
    deletedAt: null,
    ...overrides,
  } as unknown as WorkAggregate;
}

const fullSchema: NotionDataSourceSchema = {
  Name: { type: 'title' },
  [PROPERTY_NAMES.workArchiveId]: { type: 'rich_text' },
  [PROPERTY_NAMES.type]: { type: 'select' },
  [PROPERTY_NAMES.status]: { type: 'status' },
  [PROPERTY_NAMES.rating]: { type: 'number' },
  [PROPERTY_NAMES.favorite]: { type: 'checkbox' },
  [PROPERTY_NAMES.tags]: { type: 'multi_select' },
  [PROPERTY_NAMES.shortReview]: { type: 'rich_text' },
  [PROPERTY_NAMES.review]: { type: 'rich_text' },
  [PROPERTY_NAMES.progressCurrent]: { type: 'number' },
  [PROPERTY_NAMES.progressTotal]: { type: 'number' },
  [PROPERTY_NAMES.progressUnit]: { type: 'select' },
  [PROPERTY_NAMES.startedAt]: { type: 'date' },
  [PROPERTY_NAMES.completedAt]: { type: 'date' },
  [PROPERTY_NAMES.droppedAt]: { type: 'date' },
  [PROPERTY_NAMES.lastLocalUpdatedAt]: { type: 'date' },
};

describe('notion sync mappers', () => {
  it('normalizes Notion data source ids and validates title schema support', () => {
    expect(normalizeNotionDataSourceId('  abc-def-123  ')).toBe('abcdef123');
    expect(isUsableNotionSchema(fullSchema)).toBe(true);
    expect(isUsableNotionSchema({ Status: { type: 'status' } })).toBe(false);
  });

  it('builds Notion page properties from a work aggregate', () => {
    const properties = buildNotionProperties(makeWork(), fullSchema);

    expect(properties.Name).toEqual({
      title: [{ text: { content: '늑대와 향신료' } }],
    });
    expect(properties[PROPERTY_NAMES.type]).toEqual({
      select: { name: '라이트노벨' },
    });
    expect(properties[PROPERTY_NAMES.status]).toEqual({
      status: { name: '완료' },
    });
    expect(properties[PROPERTY_NAMES.tags]).toEqual({
      multi_select: [{ name: '고전' }, { name: '재독' }],
    });
    expect(properties[PROPERTY_NAMES.lastLocalUpdatedAt]).toEqual({
      date: { start: '2026-02-04T05:06:07.000Z' },
    });
  });

  it('reads only schema-backed safe values from a Notion page', () => {
    const values = readSafeValuesFromNotionPage(
      {
        id: 'page-1',
        properties: {
          [PROPERTY_NAMES.status]: { status: { name: '진행중' } },
          [PROPERTY_NAMES.rating]: { number: 4 },
          [PROPERTY_NAMES.favorite]: { checkbox: false },
          [PROPERTY_NAMES.tags]: {
            multi_select: [{ name: '  고전 ' }, { name: '' }, { name: '독서' }],
          },
          [PROPERTY_NAMES.shortReview]: {
            rich_text: [{ plain_text: '  좋은 기록  ' }],
          },
          [PROPERTY_NAMES.progressCurrent]: { number: 7 },
          [PROPERTY_NAMES.progressTotal]: { number: 12.5 },
          [PROPERTY_NAMES.progressUnit]: { select: { name: '권' } },
          [PROPERTY_NAMES.startedAt]: { date: { start: '2026-01-01' } },
        },
      },
      fullSchema,
    );

    expect(values).toMatchObject({
      favorite: false,
      personalTags: ['고전', '독서'],
      progressCurrent: 7,
      progressUnit: ProgressUnit.volume,
      rating: 4,
      shortReview: '좋은 기록',
      startedAt: '2026-01-01',
      status: WorkStatus.in_progress,
    });
    expect(values).not.toHaveProperty('progressTotal');
  });

  it('diffs local work values against Notion safe values', () => {
    const changes = diffNotionSafeValues(makeWork(), {
      favorite: false,
      rating: 4.5,
      status: WorkStatus.completed,
      completedAt: '2026-02-03',
    });

    expect(changes).toEqual([
      {
        field: 'favorite',
        localValue: true,
        notionValue: false,
      },
    ]);
  });

  it('builds safe pull update data from preview changes', () => {
    const changes: NotionChangePreview['changes'] = [
      { field: 'startedAt', localValue: null, notionValue: '2026-03-04' },
      { field: 'droppedAt', localValue: null, notionValue: 'invalid' },
      { field: 'favorite', localValue: false, notionValue: true },
      { field: 'personalTags', localValue: [], notionValue: ['  태그 ', '태그'] },
      { field: 'progressCurrent', localValue: 1, notionValue: 2 },
      { field: 'progressUnit', localValue: null, notionValue: '에피소드' },
      { field: 'rating', localValue: null, notionValue: 3 },
      { field: 'review', localValue: '', notionValue: '  본문  ' },
      { field: 'shortReview', localValue: '', notionValue: null },
      { field: 'status', localValue: WorkStatus.planned, notionValue: '보류' },
    ];

    expect(buildNotionPullUpdateData(changes)).toMatchObject({
      droppedAt: null,
      favorite: true,
      personalTags: ['태그'],
      progressCurrent: 2,
      progressUnit: ProgressUnit.episode,
      rating: 3,
      review: '본문',
      shortReview: '',
      startedAt: new Date('2026-03-04'),
      status: WorkStatus.on_hold,
    });
  });
});
