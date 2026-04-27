import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { UserReleaseRecord, WorkRecord } from '@work-archive/shared-types';

import {
  createWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../../works/db/work-archive.db';
import { LocalArchiveService } from './local-archive.service';

function buildWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    author: 'Frank Herbert',
    catalogTitleId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    description: 'Classic science fiction',
    favorite: false,
    genres: ['Science Fiction'],
    id: 'work-1',
    importDraft: null,
    progressCurrent: null,
    progressTotal: null,
    progressUnit: null,
    lastConsumedLabel: null,
    rating: 5,
    review: 'A long review',
    serverVersion: 0,
    shortReview: 'Great',
    status: 'completed',
    syncStatus: 'local-only',
    thumbnailUrl: '',
    tier: 'S',
    title: 'Dune',
    type: 'novel',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function buildReleaseRecord(
  overrides: Partial<UserReleaseRecord> = {},
): UserReleaseRecord {
  return {
    catalogReleaseId: 'release-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    favorite: false,
    id: 'release-record-1',
    rating: 4,
    review: '',
    serverVersion: 0,
    shortReview: '',
    status: 'completed',
    syncStatus: 'local-only',
    updatedAt: '2026-01-02T00:00:00.000Z',
    userWorkRecordId: 'work-1',
    ...overrides,
  };
}

describe('LocalArchiveService', () => {
  let sourceDb: WorkArchiveDatabase;
  let targetDb: WorkArchiveDatabase;
  let sourceService: LocalArchiveService;
  let targetService: LocalArchiveService;

  beforeEach(() => {
    sourceDb = createWorkArchiveDb(`archive-source-${crypto.randomUUID()}`);
    targetDb = createWorkArchiveDb(`archive-target-${crypto.randomUUID()}`);
    sourceService = new LocalArchiveService(() => sourceDb);
    targetService = new LocalArchiveService(() => targetDb);
  });

  afterEach(async () => {
    await sourceDb.delete();
    await targetDb.delete();
  });

  it('exports JSON and CSV from the current local archive', async () => {
    await sourceDb.works.add(buildWork());
    await sourceDb.releaseRecords.add(buildReleaseRecord());

    const jsonExport = await sourceService.createJsonExport();
    const csvExport = await sourceService.createCsvExportText();

    expect(jsonExport).toMatchObject({
      format: 'work-archive.local-archive',
      version: 1,
      works: [expect.objectContaining({ title: 'Dune' })],
      releaseRecords: [expect.objectContaining({ id: 'release-record-1' })],
    });
    expect(csvExport).toContain('title,type,status,rating');
    expect(csvExport).toContain('Dune,novel,completed,5');
  });

  it('previews and imports without overwriting existing local records', async () => {
    await sourceDb.works.add(buildWork());
    await sourceDb.releaseRecords.add(buildReleaseRecord());
    await targetDb.works.add(
      buildWork({
        id: 'work-1',
        title: 'Dune',
      }),
    );

    const backup = await sourceService.createJsonExportText();
    const preview = await targetService.previewImport(backup);
    const result = await targetService.importJson(backup);
    const importedWorks = await targetDb.works.toArray();
    const importedReleaseRecords = await targetDb.releaseRecords.toArray();
    const queueItems = await targetDb.syncQueue.toArray();

    expect(preview).toMatchObject({
      duplicateTitleCount: 1,
      idCollisionCount: 1,
      releaseRecordCount: 1,
      workCount: 1,
    });
    expect(result).toMatchObject({
      importedReleaseRecordCount: 1,
      importedWorkCount: 1,
    });
    expect(importedWorks).toHaveLength(2);
    expect(new Set(importedWorks.map((work) => work.id)).size).toBe(2);
    expect(importedReleaseRecords).toHaveLength(1);
    expect(importedReleaseRecords[0]?.userWorkRecordId).not.toBe('work-1');
    expect(queueItems).toEqual([
      expect.objectContaining({
        entityType: 'work',
        operation: 'create',
      }),
      expect.objectContaining({
        entityType: 'release_record',
        operation: 'create',
      }),
    ]);
  });
});
