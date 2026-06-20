import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  ContributorRecord,
  SeriesRecord,
  TierBoardAssetRecord,
  TierBoardCardRecord,
  TierBoardRecord,
  TierLaneRecord,
  TimelineEntryRecord,
  UserReleaseRecord,
  WorkContributorRecord,
  WorkRelationRecord,
  WorkRecord,
  WorkSeriesLinkRecord,
} from '@work-archive/shared-types';

import { createWorkArchiveDb, type WorkArchiveDatabase } from '@features/works';
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
    startedAt: null,
    completedAt: null,
    droppedAt: null,
    lastConsumedAt: null,
    rating: 5,
    review: 'A long review',
    serverVersion: 0,
    shortReview: 'Great',
    status: 'completed',
    syncStatus: 'local-only',
    thumbnailUrl: '',
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

function buildTimelineEntry(
  overrides: Partial<TimelineEntryRecord> = {},
): TimelineEntryRecord {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    id: 'timeline-entry-1',
    note: '첫 감상 메모',
    occurredAt: '2026-01-02T00:00:00.000Z',
    serverVersion: 0,
    syncStatus: 'local-only',
    type: 'note',
    updatedAt: '2026-01-02T00:00:00.000Z',
    workId: 'work-1',
    ...overrides,
  };
}

function buildSeries(overrides: Partial<SeriesRecord> = {}): SeriesRecord {
  return {
    aliases: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    description: '',
    id: 'series-1',
    kind: 'series',
    normalizedTitle: 'dune',
    parentId: null,
    serverVersion: 0,
    syncStatus: 'local-only',
    thumbnailUrl: '',
    title: 'Dune',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function buildContributor(
  overrides: Partial<ContributorRecord> = {},
): ContributorRecord {
  return {
    aliases: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    entityType: 'person',
    id: 'contributor-1',
    name: 'Frank Herbert',
    normalizedName: 'frank herbert',
    serverVersion: 0,
    syncStatus: 'local-only',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function buildWorkSeriesLink(
  overrides: Partial<WorkSeriesLinkRecord> = {},
): WorkSeriesLinkRecord {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    id: 'work-series-link-1',
    orderIndex: null,
    orderLabel: '',
    role: 'main',
    seriesId: 'series-1',
    serverVersion: 0,
    syncStatus: 'local-only',
    updatedAt: '2026-01-02T00:00:00.000Z',
    workId: 'work-1',
    ...overrides,
  };
}

function buildWorkContributor(
  overrides: Partial<WorkContributorRecord> = {},
): WorkContributorRecord {
  return {
    contributorId: 'contributor-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    displayOrder: 0,
    id: 'work-contributor-1',
    role: 'author',
    serverVersion: 0,
    syncStatus: 'local-only',
    updatedAt: '2026-01-02T00:00:00.000Z',
    workId: 'work-1',
    ...overrides,
  };
}

function buildWorkRelation(
  overrides: Partial<WorkRelationRecord> = {},
): WorkRelationRecord {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    id: 'work-relation-1',
    note: '',
    relationType: 'same_universe',
    serverVersion: 0,
    sourceWorkId: 'work-1',
    syncStatus: 'local-only',
    targetWorkId: 'work-2',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function buildTierBoard(
  overrides: Partial<TierBoardRecord> = {},
): TierBoardRecord {
  return {
    boardType: 'classic_tier',
    coverImageUrl: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    description: '',
    id: 'tier-board-1',
    serverVersion: 0,
    slug: 'dune-board',
    syncStatus: 'local-only',
    title: 'Dune Board',
    updatedAt: '2026-01-02T00:00:00.000Z',
    visibility: 'private',
    ...overrides,
  };
}

function buildTierLane(
  overrides: Partial<TierLaneRecord> = {},
): TierLaneRecord {
  return {
    boardId: 'tier-board-1',
    colorToken: 'gray',
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    description: '',
    id: 'tier-lane-1',
    orderIndex: 0,
    serverVersion: 0,
    syncStatus: 'local-only',
    title: 'S',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function buildTierBoardCard(
  overrides: Partial<TierBoardCardRecord> = {},
): TierBoardCardRecord {
  return {
    boardId: 'tier-board-1',
    cardSourceType: 'library_work',
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    id: 'tier-card-1',
    imageUrl: 'indexeddb://tier-board-assets/tier-asset-1',
    laneId: 'tier-lane-1',
    note: '',
    orderIndex: 0,
    serverVersion: 0,
    subtitle: '',
    syncStatus: 'local-only',
    title: 'Dune',
    updatedAt: '2026-01-02T00:00:00.000Z',
    workId: 'work-1',
    ...overrides,
  };
}

function buildTierBoardAsset(
  overrides: Partial<TierBoardAssetRecord> = {},
): TierBoardAssetRecord {
  return {
    boardId: 'tier-board-1',
    cardId: 'tier-card-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    id: 'tier-asset-1',
    kind: 'image',
    mimeType: 'image/png',
    objectUrl: 'indexeddb://tier-board-assets/tier-asset-1',
    originalName: 'cover.png',
    sizeBytes: 12,
    storageType: 'local_blob',
    syncStatus: 'local-only',
    serverVersion: 0,
    updatedAt: '2026-01-02T00:00:00.000Z',
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
    await sourceDb.works.add({
      ...buildWork({
        personalTags: ['다시 볼 것', '여운 강함'],
      }),
      _deletedAtScope: 'active',
    } as WorkRecord);
    await sourceDb.releaseRecords.add(buildReleaseRecord());
    await sourceDb.timelineEntries.add(buildTimelineEntry());
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
    const jsonArtifact = await sourceService.createJsonBackupArtifact('simple', {
      fileName: 'work-archive-simple-backup-2026-01-04.json',
      now: new Date('2026-01-04T00:00:00.000Z'),
    });
    const csvExport = await sourceService.createCsvExportText();

    expect(jsonExport).toMatchObject({
      format: 'work-archive.local-archive',
      version: 1,
      schemaVersion: 2,
      source: 'work-archive-web',
      backupExclusions: [
        'syncQueue',
        'authTokens',
        'refreshCookie',
        'providerApiKeys',
      ],
      exportedAt: expect.any(String),
      works: [expect.objectContaining({ title: 'Dune' })],
      releaseRecords: [expect.objectContaining({ id: 'release-record-1' })],
      timelineEntries: [expect.objectContaining({ id: 'timeline-entry-1' })],
      appMeta: [
        expect.objectContaining({
          key: 'sync.lastSuccessfulPullAt',
        }),
      ],
    });
    expect(jsonExportText).not.toContain('_deletedAtScope');
    expect(jsonExport).not.toHaveProperty('syncQueue');
    expect(jsonExportText).not.toContain('accessToken');
    expect(jsonExportText).not.toContain('refreshToken');
    expect(jsonExportText).not.toContain('TTBKey');
    expect(jsonExportText).not.toContain('apiKey');
    expect(jsonArtifact.summary).toMatchObject({
      byteLength: new TextEncoder().encode(jsonArtifact.content).byteLength,
      contentVerifiedAt: '2026-01-04T00:00:00.000Z',
      exportedAt: '2026-01-04T00:00:00.000Z',
      fileName: 'work-archive-simple-backup-2026-01-04.json',
      fileVerifiedAt: null,
      recordCounts: {
        appMetaCount: 1,
        releaseRecordCount: 1,
        timelineEntryCount: 1,
        workCount: 1,
      },
      scope: 'simple',
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(jsonArtifact.content).not.toContain('accessToken');
    expect(jsonArtifact.content).not.toContain('refreshToken');
    await expect(
      sourceService.verifyJsonBackupText(
        jsonArtifact.content,
        jsonArtifact.summary,
        new Date('2026-01-04T00:01:00.000Z'),
      ),
    ).resolves.toMatchObject({
      fileVerifiedAt: '2026-01-04T00:01:00.000Z',
    });
    expect(csvExport).toContain('title,type,status,rating');
    expect(csvExport).toContain('Dune,novel,completed,5,다시 볼 것; 여운 강함');
  });

  it('exports and imports the full local archive domain with remapped references', async () => {
    await sourceDb.works.bulkAdd([
      buildWork(),
      buildWork({
        id: 'work-2',
        title: 'Dune Messiah',
      }),
    ]);
    await sourceDb.releaseRecords.add(buildReleaseRecord());
    await sourceDb.timelineEntries.add(buildTimelineEntry());
    await sourceDb.series.add(buildSeries());
    await sourceDb.contributors.add(buildContributor());
    await sourceDb.workSeriesLinks.add(buildWorkSeriesLink());
    await sourceDb.workContributors.add(buildWorkContributor());
    await sourceDb.workRelations.add(buildWorkRelation());
    await sourceDb.tierBoards.add(buildTierBoard());
    await sourceDb.tierLanes.add(buildTierLane());
    await sourceDb.tierBoardCards.add(buildTierBoardCard());
    await sourceDb.tierBoardAssets.add({
      ...buildTierBoardAsset(),
      blob: new Blob(['image']),
      dataUrl: 'data:image/png;base64,aW1hZ2U=',
    } as TierBoardAssetRecord & { blob: Blob; dataUrl: string });
    await targetDb.works.add(buildWork({ id: 'work-1' }));

    const exported = await sourceService.createJsonExport('full');
    const backup = JSON.stringify(exported);
    const preview = await targetService.previewImport(backup);
    const result = await targetService.importJson(backup);
    const importedWork = (await targetDb.works.toArray()).find(
      (work) => work.title === 'Dune',
    );
    const importedWork2 = (await targetDb.works.toArray()).find(
      (work) => work.title === 'Dune Messiah',
    );
    const [workSeriesLink] = await targetDb.workSeriesLinks.toArray();
    const [workContributor] = await targetDb.workContributors.toArray();
    const [workRelation] = await targetDb.workRelations.toArray();
    const [tierCard] = await targetDb.tierBoardCards.toArray();
    const [tierAsset] = await targetDb.tierBoardAssets.toArray();
    const queueItems = await targetDb.syncQueue.toArray();

    expect(exported.scope).toBe('full');
    expect(exported.series).toHaveLength(1);
    expect(exported.tierBoardAssets?.[0]).not.toHaveProperty('blob');
    expect(exported.tierBoardAssets?.[0]).not.toHaveProperty('dataUrl');
    expect(preview).toMatchObject({
      addContributorCount: 1,
      addSeriesCount: 1,
      addTierBoardAssetCount: 1,
      addTierBoardCardCount: 1,
      addTierBoardCount: 1,
      addTierLaneCount: 1,
      addWorkContributorCount: 1,
      addWorkRelationCount: 1,
      addWorkSeriesLinkCount: 1,
      conflictWorkCount: 1,
    });
    expect(result).toMatchObject({
      importedContributorCount: 1,
      importedSeriesCount: 1,
      importedTierBoardAssetCount: 1,
      importedTierBoardCardCount: 1,
      importedTierBoardCount: 1,
      importedTierLaneCount: 1,
      importedWorkContributorCount: 1,
      importedWorkRelationCount: 1,
      importedWorkSeriesLinkCount: 1,
      importedWorkCount: 2,
    });
    expect(importedWork?.id).toBeDefined();
    expect(importedWork?.id).not.toBe('work-1');
    expect(importedWork2?.id).toBe('work-2');
    expect(workSeriesLink?.workId).toBe(importedWork?.id);
    expect(workContributor?.workId).toBe(importedWork?.id);
    expect(workRelation?.sourceWorkId).toBe(importedWork?.id);
    expect(workRelation?.targetWorkId).toBe(importedWork2?.id);
    expect(tierCard?.workId).toBe(importedWork?.id);
    expect(tierAsset?.cardId).toBe(tierCard?.id);
    expect(tierAsset?.objectUrl).toBe(
      `indexeddb://tier-board-assets/${tierAsset?.id}`,
    );
    expect(tierCard?.imageUrl).toBe(tierAsset?.objectUrl);
    expect(queueItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityType: 'series' }),
        expect.objectContaining({ entityType: 'contributor' }),
        expect.objectContaining({ entityType: 'work_series_link' }),
        expect.objectContaining({ entityType: 'work_contributor' }),
        expect.objectContaining({ entityType: 'work_relation' }),
        expect.objectContaining({ entityType: 'tier_board' }),
        expect.objectContaining({ entityType: 'tier_lane' }),
        expect.objectContaining({ entityType: 'tier_board_card' }),
        expect.objectContaining({ entityType: 'tier_board_asset' }),
      ]),
    );
  });

  it('skips full archive graph and tier records with missing parents', async () => {
    await sourceDb.works.add(buildWork());
    await sourceDb.series.add(buildSeries());
    await sourceDb.workSeriesLinks.bulkAdd([
      buildWorkSeriesLink(),
      buildWorkSeriesLink({
        id: 'orphan-series-link',
        workId: 'missing-work',
      }),
    ]);
    await sourceDb.tierBoards.add(buildTierBoard());
    await sourceDb.tierLanes.bulkAdd([
      buildTierLane(),
      buildTierLane({
        boardId: 'missing-board',
        id: 'orphan-lane',
      }),
    ]);
    await sourceDb.tierBoardCards.bulkAdd([
      buildTierBoardCard(),
      buildTierBoardCard({
        id: 'orphan-card',
        workId: 'missing-work',
      }),
    ]);
    await sourceDb.tierBoardAssets.bulkAdd([
      buildTierBoardAsset(),
      buildTierBoardAsset({
        cardId: 'orphan-card',
        id: 'asset-for-orphan-card',
      }),
      buildTierBoardAsset({
        cardId: 'missing-card',
        id: 'asset-for-missing-card',
      }),
    ]);

    const backup = await sourceService.createJsonExportText('full');
    const preview = await targetService.previewImport(backup);
    const result = await targetService.importJson(backup);

    expect(preview).toMatchObject({
      skippedTierBoardAssetCount: 2,
      skippedTierBoardCardCount: 1,
      skippedTierLaneCount: 1,
      skippedWorkSeriesLinkCount: 1,
      tierBoardAssetCount: 1,
      tierBoardCardCount: 1,
      tierLaneCount: 1,
      workSeriesLinkCount: 1,
    });
    expect(result.importedTierBoardAssetCount).toBe(1);
    expect(result.importedTierBoardCardCount).toBe(1);
    expect(result.importedTierLaneCount).toBe(1);
    expect(result.importedWorkSeriesLinkCount).toBe(1);
  });

  it('treats missing archive scope as simple and ignores full archive arrays', async () => {
    await sourceDb.works.add(buildWork());
    await sourceDb.series.add(buildSeries());
    await sourceDb.tierBoards.add(buildTierBoard());

    const exported = await sourceService.createJsonExport('full');
    const legacyBackup = JSON.stringify({
      ...exported,
      scope: undefined,
    });
    const preview = await targetService.previewImport(legacyBackup);
    const result = await targetService.importJson(legacyBackup);

    expect(preview).toMatchObject({
      addSeriesCount: 0,
      addTierBoardCount: 0,
      addWorkCount: 1,
    });
    expect(result).toMatchObject({
      importedSeriesCount: 0,
      importedTierBoardCount: 0,
      importedWorkCount: 1,
    });
    expect(await targetDb.series.count()).toBe(0);
    expect(await targetDb.tierBoards.count()).toBe(0);
  });

  it('previews and imports without overwriting existing local records', async () => {
    await sourceDb.works.add(buildWork());
    await sourceDb.releaseRecords.add(buildReleaseRecord());
    await sourceDb.timelineEntries.add(buildTimelineEntry());
    await targetDb.works.add(
      buildWork({
        id: 'work-1',
        title: 'Dune',
      }),
    );

    const backup = await sourceService.createJsonExportText();
    const preview = await targetService.previewImport(backup);
    const dryRun = await targetService.dryRunImport(backup);
    const result = await targetService.importJson(backup);
    const importedWorks = await targetDb.works.toArray();
    const importedReleaseRecords = await targetDb.releaseRecords.toArray();
    const importedTimelineEntries = await targetDb.timelineEntries.toArray();
    const queueItems = await targetDb.syncQueue.toArray();

    expect(preview).toMatchObject({
      addReleaseRecordCount: 1,
      addTimelineEntryCount: 1,
      addWorkCount: 1,
      conflictWorkCount: 1,
      duplicateTimelineEntryCount: 0,
      duplicateWorkCount: 1,
      duplicateTitleCount: 1,
      idCollisionCount: 1,
      releaseRecordCount: 1,
      skippedTimelineEntryCount: 0,
      timelineEntryCount: 1,
      skippedWorkCount: 0,
      sourceRecordCounts: {
        releaseRecordCount: 1,
        timelineEntryCount: 1,
        workCount: 1,
      },
      sourceScope: 'simple',
      updateWorkCount: 0,
      workCount: 1,
    });
    expect(dryRun).toEqual(preview);
    expect(result).toMatchObject({
      importedReleaseRecordCount: 1,
      importedTimelineEntryCount: 1,
      importedWorkCount: 1,
    });
    expect(importedWorks).toHaveLength(2);
    expect(new Set(importedWorks.map((work) => work.id)).size).toBe(2);
    expect(importedReleaseRecords).toHaveLength(1);
    expect(importedReleaseRecords[0]?.userWorkRecordId).not.toBe('work-1');
    expect(importedTimelineEntries).toHaveLength(1);
    expect(importedTimelineEntries[0]?.workId).not.toBe('work-1');
    expect(importedTimelineEntries[0]?.syncStatus).toBe('pending');
    expect(queueItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'work',
          operation: 'create',
          source: 'archive_migration',
        }),
        expect.objectContaining({
          entityType: 'release_record',
          operation: 'create',
          source: 'archive_migration',
        }),
        expect.objectContaining({
          entityType: 'timeline_entry',
          operation: 'create',
          source: 'archive_migration',
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
    await sourceDb.timelineEntries.bulkAdd([
      buildTimelineEntry(),
      buildTimelineEntry({
        id: 'orphan-timeline-entry',
        workId: 'missing-work',
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
      skippedTimelineEntryCount: 1,
      timelineEntryCount: 1,
      workCount: 1,
    });
    expect(result.importedReleaseRecordCount).toBe(1);
    expect(result.importedTimelineEntryCount).toBe(1);
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
    await sourceDb.timelineEntries.add(
      buildTimelineEntry({
        deletedAt: '2026-01-04T00:00:00.000Z',
      }),
    );

    const backup = await sourceService.createJsonExportText();
    const result = await targetService.importJson(backup);

    expect(result).toMatchObject({
      importedReleaseRecordCount: 1,
      importedTimelineEntryCount: 1,
      importedWorkCount: 1,
    });
    expect(await targetDb.works.count()).toBe(1);
    expect(await targetDb.releaseRecords.count()).toBe(1);
    expect(await targetDb.timelineEntries.count()).toBe(1);
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
    delete backup.works[0]?.startedAt;
    delete backup.works[0]?.completedAt;
    delete backup.works[0]?.droppedAt;
    delete backup.works[0]?.lastConsumedAt;

    await targetService.importJson(JSON.stringify(backup));

    expect(await targetDb.works.toArray()).toEqual([
      expect.objectContaining({
        completedAt: null,
        droppedAt: null,
        lastConsumedAt: null,
        personalTags: [],
        startedAt: null,
      }),
    ]);
  });
});
