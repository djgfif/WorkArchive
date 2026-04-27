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
    personalTags: [],
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
    await sourceDb.works.add(
      buildWork({
        personalTags: ['다시 볼 것', '여운 강함'],
      }),
    );
    await sourceDb.releaseRecords.add(buildReleaseRecord());
    await sourceDb.appMeta.add({
      key: 'sync.lastSuccessfulPullAt',
      value: '2026-01-03T00:00:00.000Z',
    });
    await sourceDb.syncQueue.add({
      createdAt: '2026-01-03T00:00:00.000Z',
      entityId: 'work-1',
      entityType: 'work',
      id: 'queue-1',
      lastError: null,
      operation: 'create',
      payload: buildWork(),
      retryCount: 0,
    });

    const jsonExport = await sourceService.createJsonExport();
    const jsonExportText = await sourceService.createJsonExportText();
    const csvExport = await sourceService.createCsvExportText();

    expect(jsonExport).toMatchObject({
      format: 'work-archive.local-archive',
      version: 1,
      exportedAt: expect.any(String),
      works: [expect.objectContaining({ title: 'Dune' })],
      releaseRecords: [expect.objectContaining({ id: 'release-record-1' })],
      appMeta: [
        expect.objectContaining({
          key: 'sync.lastSuccessfulPullAt',
        }),
      ],
    });
    expect(jsonExport).not.toHaveProperty('syncQueue');
    expect(jsonExportText).not.toContain('accessToken');
    expect(jsonExportText).not.toContain('refreshToken');
    expect(jsonExportText).not.toContain('TTBKey');
    expect(jsonExportText).not.toContain('apiKey');
    expect(csvExport).toContain('title,type,status,rating');
    expect(csvExport).toContain('Dune,novel,completed,5,다시 볼 것; 여운 강함');
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
    expect(queueItems).toEqual(
      expect.arrayContaining([
      expect.objectContaining({
        entityType: 'work',
        operation: 'create',
      }),
      expect.objectContaining({
        entityType: 'release_record',
        operation: 'create',
      }),
      ]),
    );
  });

  it('skips orphan release records and does not restore appMeta from imports', async () => {
    await sourceDb.works.add(buildWork());
    await sourceDb.releaseRecords.bulkAdd([
      buildReleaseRecord(),
      buildReleaseRecord({
        id: 'orphan-release-record',
        userWorkRecordId: 'missing-work',
      }),
    ]);
    await sourceDb.appMeta.add({
      key: 'sync.lastSuccessfulPullAt',
      value: '2026-01-03T00:00:00.000Z',
    });

    const backup = await sourceService.createJsonExportText();
    const preview = await targetService.previewImport(backup);
    const result = await targetService.importJson(backup);

    expect(preview).toMatchObject({
      releaseRecordCount: 1,
      skippedReleaseRecordCount: 1,
      workCount: 1,
    });
    expect(result.importedReleaseRecordCount).toBe(1);
    expect(await targetDb.appMeta.toArray()).toEqual([]);
  });

  it('imports deleted records without queueing new create sync items', async () => {
    await sourceDb.works.add(
      buildWork({
        deletedAt: '2026-01-04T00:00:00.000Z',
      }),
    );
    await sourceDb.releaseRecords.add(
      buildReleaseRecord({
        deletedAt: '2026-01-04T00:00:00.000Z',
      }),
    );

    const backup = await sourceService.createJsonExportText();
    const result = await targetService.importJson(backup);

    expect(result).toMatchObject({
      importedReleaseRecordCount: 1,
      importedWorkCount: 1,
    });
    expect(await targetDb.works.count()).toBe(1);
    expect(await targetDb.releaseRecords.count()).toBe(1);
    expect(await targetDb.syncQueue.toArray()).toEqual([]);
  });

  it('adds repeated imports as new records without overwriting existing ones', async () => {
    await sourceDb.works.add(buildWork());

    const backup = await sourceService.createJsonExportText();

    await targetService.importJson(backup);
    await targetService.importJson(backup);

    const importedWorks = await targetDb.works.toArray();

    expect(importedWorks).toHaveLength(2);
    expect(new Set(importedWorks.map((work) => work.id)).size).toBe(2);
    expect(importedWorks.every((work) => work.title === 'Dune')).toBe(true);
  });

  it('rejects invalid JSON backup text with a friendly error', async () => {
    await expect(targetService.previewImport('not-json')).rejects.toThrow(
      'JSON 백업 파일을 읽지 못했습니다.',
    );
  });

  it('normalizes legacy backups without personalTags', async () => {
    await sourceDb.works.add(buildWork());

    const backup = JSON.parse(await sourceService.createJsonExportText()) as {
      works: Array<Partial<WorkRecord>>;
    };
    delete backup.works[0]?.personalTags;

    await targetService.importJson(JSON.stringify(backup));

    expect(await targetDb.works.toArray()).toEqual([
      expect.objectContaining({
        personalTags: [],
      }),
    ]);
  });
});
