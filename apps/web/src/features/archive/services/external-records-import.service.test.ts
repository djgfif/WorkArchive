import { describe, expect, it, vi } from 'vitest';

import type { WorkRecord } from '@work-archive/shared-types';

import type { ExternalImportEntry } from '@features/imports';
import {
  buildExternalImportArchive,
  ExternalRecordsImportService,
} from './external-records-import.service';
import { parseArchive } from './local-archive-format';
import type { LocalArchiveService } from './local-archive.service';
import type { DatabaseResolver } from './local-archive.types';

function buildEntry(
  overrides: Partial<ExternalImportEntry> = {},
): ExternalImportEntry {
  return {
    author: '고토게 코요하루',
    completedAt: '2024-02-10T00:00:00.000Z',
    description: '검과 도깨비 이야기',
    externalKey: 'anilist:anime:101922',
    progressCurrent: 26,
    progressTotal: 26,
    progressUnit: 'episode',
    rating: 4.5,
    review: '명작',
    sourceLabel: 'AniList',
    sourceUrl: 'https://anilist.co/anime/101922',
    startedAt: '2024-01-02T00:00:00.000Z',
    status: 'completed',
    thumbnailUrl: 'https://s4.anilist.co/cover.jpg',
    title: '귀멸의 칼날',
    type: 'anime',
    ...overrides,
  };
}

function buildExistingWork(): WorkRecord {
  return {
    author: '',
    catalogTitleId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    description: '',
    favorite: false,
    genres: [],
    id: crypto.randomUUID(),
    importDraft: null,
    personalTags: [],
    rating: null,
    review: '',
    serverVersion: 0,
    shortReview: '',
    status: 'completed',
    syncStatus: 'local-only',
    thumbnailUrl: '',
    title: '귀멸의 칼날',
    type: 'anime',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function buildService(existingWorks: WorkRecord[]) {
  const importJson = vi
    .fn()
    .mockImplementation((rawValue: string) => {
      const archive = parseArchive(rawValue);

      return Promise.resolve({ importedWorkCount: archive.works.length });
    });
  const getDb = (() => ({
    works: {
      toArray: () => Promise.resolve(existingWorks),
    },
  })) as unknown as DatabaseResolver;
  const service = new ExternalRecordsImportService(getDb, {
    importJson,
  } as unknown as LocalArchiveService);

  return { importJson, service };
}

describe('buildExternalImportArchive', () => {
  it('builds a valid local archive document that parseArchive accepts', () => {
    const archive = buildExternalImportArchive(
      [buildEntry()],
      '2026-06-12T00:00:00.000Z',
    );
    const roundTripped = parseArchive(JSON.stringify(archive));

    expect(roundTripped.works).toHaveLength(1);
    expect(roundTripped.works[0]).toMatchObject({
      author: '고토게 코요하루',
      completedAt: '2024-02-10T00:00:00.000Z',
      createdAt: '2026-06-12T00:00:00.000Z',
      deletedAt: null,
      progressCurrent: 26,
      progressTotal: 26,
      progressUnit: 'episode',
      rating: 4.5,
      review: '명작',
      serverVersion: 0,
      status: 'completed',
      syncStatus: 'local-only',
      thumbnailUrl: 'https://s4.anilist.co/cover.jpg',
      title: '귀멸의 칼날',
      type: 'anime',
    });
  });

  it('keeps dropped dates on droppedAt instead of completedAt', () => {
    const archive = buildExternalImportArchive([
      buildEntry({
        completedAt: '2024-03-01T00:00:00.000Z',
        status: 'dropped',
      }),
    ]);

    expect(archive.works[0]).toMatchObject({
      completedAt: null,
      droppedAt: '2024-03-01T00:00:00.000Z',
      status: 'dropped',
    });
  });
});

describe('ExternalRecordsImportService', () => {
  it('previews totals, duplicates, and per-type counts', async () => {
    const { service } = buildService([buildExistingWork()]);
    const preview = await service.previewEntries([
      buildEntry(),
      buildEntry({
        externalKey: 'anilist:manga:2',
        thumbnailUrl: '',
        title: '나 혼자만 레벨업',
        type: 'webtoon',
      }),
    ]);

    expect(preview).toMatchObject({
      duplicateCount: 1,
      duplicateTitles: ['귀멸의 칼날'],
      newCount: 1,
      totalCount: 2,
      withCoverCount: 1,
    });
    expect(preview.typeCounts).toMatchObject({ anime: 1, webtoon: 1 });
    expect(preview.statusCounts).toMatchObject({ completed: 2 });
  });

  it('skips duplicate titles when importing with skipDuplicates', async () => {
    const { importJson, service } = buildService([buildExistingWork()]);
    const result = await service.importEntries([
      buildEntry(),
      buildEntry({
        externalKey: 'anilist:manga:2',
        title: '나 혼자만 레벨업',
        type: 'webtoon',
      }),
    ]);

    expect(result).toEqual({
      importedCount: 1,
      skippedDuplicateCount: 1,
    });
    expect(importJson).toHaveBeenCalledTimes(1);

    const archive = parseArchive(importJson.mock.calls[0]?.[0] as string);

    expect(archive.works.map((work) => work.title)).toEqual([
      '나 혼자만 레벨업',
    ]);
  });

  it('imports duplicates too when skipDuplicates is off', async () => {
    const { importJson, service } = buildService([buildExistingWork()]);
    const result = await service.importEntries([buildEntry()], {
      skipDuplicates: false,
    });

    expect(result).toEqual({
      importedCount: 1,
      skippedDuplicateCount: 0,
    });
    expect(importJson).toHaveBeenCalledTimes(1);
  });

  it('does not call importJson when everything is a duplicate', async () => {
    const { importJson, service } = buildService([buildExistingWork()]);
    const result = await service.importEntries([buildEntry()]);

    expect(result).toEqual({
      importedCount: 0,
      skippedDuplicateCount: 1,
    });
    expect(importJson).not.toHaveBeenCalled();
  });
});
