import type { TimelineEntryRecord } from '@work-archive/shared-types';

import { getWorkArchiveDb } from '../../works/storage';
import {
  createCsvRows,
  createQueueItem,
  normalizeTimelineEntry,
  parseArchive,
  prepareImportedWorkForStorage,
  stripLocalOnlyTierBoardAssetFields,
  stripLocalOnlyWorkFields,
} from './local-archive-format';
import {
  buildLocalArchiveImportPlan,
  createLocalArchiveImportPreview,
} from './local-archive-import-plan';
import {
  ARCHIVE_FORMAT,
  ARCHIVE_SCHEMA_VERSION,
  ARCHIVE_SOURCE,
  ARCHIVE_VERSION,
  BACKUP_EXCLUSIONS,
  type DatabaseResolver,
  type LocalArchiveExport,
  type LocalArchiveImportPreview,
  type LocalArchiveImportResult,
  type LocalArchiveScope,
} from './local-archive.types';

export type {
  LocalArchiveExport,
  LocalArchiveImportPreview,
  LocalArchiveImportResult,
  LocalArchiveScope,
} from './local-archive.types';

export class LocalArchiveService {
  constructor(private readonly getDb: DatabaseResolver = getWorkArchiveDb) {}

  async createJsonExport(
    scope: LocalArchiveScope = 'simple',
  ): Promise<LocalArchiveExport> {
    const db = this.getDb();
    const [works, releaseRecords, timelineEntries, appMeta] = await Promise.all(
      [
        db.works.toArray(),
        db.releaseRecords.toArray(),
        db.timelineEntries.toArray(),
        db.appMeta.toArray(),
      ],
    );
    const fullArchiveData =
      scope === 'full'
        ? await Promise.all([
            db.series.toArray(),
            db.contributors.toArray(),
            db.workSeriesLinks.toArray(),
            db.workContributors.toArray(),
            db.workRelations.toArray(),
            db.tierBoards.toArray(),
            db.tierLanes.toArray(),
            db.tierBoardCards.toArray(),
            db.tierBoardAssets.toArray(),
          ])
        : null;
    const [
      series,
      contributors,
      workSeriesLinks,
      workContributors,
      workRelations,
      tierBoards,
      tierLanes,
      tierBoardCards,
      tierBoardAssets,
    ] = fullArchiveData ?? [];

    return {
      appMeta,
      backupExclusions: [...BACKUP_EXCLUSIONS],
      ...(scope === 'full'
        ? {
            contributors: contributors ?? [],
            series: series ?? [],
            tierBoardAssets:
              tierBoardAssets?.map(stripLocalOnlyTierBoardAssetFields) ?? [],
            tierBoardCards: tierBoardCards ?? [],
            tierBoards: tierBoards ?? [],
            tierLanes: tierLanes ?? [],
            workContributors: workContributors ?? [],
            workRelations: workRelations ?? [],
            workSeriesLinks: workSeriesLinks ?? [],
          }
        : {}),
      exportedAt: new Date().toISOString(),
      format: ARCHIVE_FORMAT,
      releaseRecords,
      schemaVersion: ARCHIVE_SCHEMA_VERSION,
      scope,
      source: ARCHIVE_SOURCE,
      timelineEntries: timelineEntries.map(normalizeTimelineEntry),
      version: ARCHIVE_VERSION,
      works: works.map(stripLocalOnlyWorkFields),
    };
  }

  async createJsonExportText(scope: LocalArchiveScope = 'simple') {
    return JSON.stringify(await this.createJsonExport(scope), null, 2);
  }

  async createCsvExportText() {
    const works = await this.getDb()
      .works.filter((work) => work.deletedAt === null)
      .toArray();

    return createCsvRows(works);
  }

  async dryRunImport(rawValue: string): Promise<LocalArchiveImportPreview> {
    const archive = parseArchive(rawValue);
    const db = this.getDb();

    const [existingWorks, existingTimelineEntries] = await Promise.all([
      db.works.toArray(),
      db.timelineEntries.toArray(),
    ]);

    return createLocalArchiveImportPreview({
      archive,
      existingTimelineEntries,
      existingWorks,
    });
  }

  async previewImport(rawValue: string): Promise<LocalArchiveImportPreview> {
    return this.dryRunImport(rawValue);
  }

  async importJson(rawValue: string): Promise<LocalArchiveImportResult> {
    const archive = parseArchive(rawValue);
    const preview = await this.previewImport(rawValue);
    const db = this.getDb();
    const [
      existingWorks,
      existingReleaseRecords,
      existingTimelineEntries,
      existingSeries,
      existingContributors,
      existingWorkSeriesLinks,
      existingWorkContributors,
      existingWorkRelations,
      existingTierBoards,
      existingTierLanes,
      existingTierBoardCards,
      existingTierBoardAssets,
    ] = await Promise.all([
      db.works.toArray(),
      db.releaseRecords.toArray(),
      db.timelineEntries.toArray(),
      db.series.toArray(),
      db.contributors.toArray(),
      db.workSeriesLinks.toArray(),
      db.workContributors.toArray(),
      db.workRelations.toArray(),
      db.tierBoards.toArray(),
      db.tierLanes.toArray(),
      db.tierBoardCards.toArray(),
      db.tierBoardAssets.toArray(),
    ]);
    const {
      contributorsToImport,
      releaseRecordsToImport,
      seriesToImport,
      tierBoardAssetsToImport,
      tierBoardCardsToImport,
      tierBoardsToImport,
      tierLanesToImport,
      timelineEntriesToImport,
      workContributorsToImport,
      workRelationsToImport,
      worksToImport,
      worksToImportById,
      workSeriesLinksToImport,
    } = buildLocalArchiveImportPlan({
      archive,
      existingRecords: {
        contributors: existingContributors,
        releaseRecords: existingReleaseRecords,
        series: existingSeries,
        tierBoardAssets: existingTierBoardAssets,
        tierBoardCards: existingTierBoardCards,
        tierBoards: existingTierBoards,
        tierLanes: existingTierLanes,
        timelineEntries: existingTimelineEntries,
        workContributors: existingWorkContributors,
        workRelations: existingWorkRelations,
        works: existingWorks,
        workSeriesLinks: existingWorkSeriesLinks,
      },
    });

    await db.transaction(
      'rw',
      [
        db.works,
        db.releaseRecords,
        db.timelineEntries,
        db.series,
        db.contributors,
        db.workSeriesLinks,
        db.workContributors,
        db.workRelations,
        db.tierBoards,
        db.tierLanes,
        db.tierBoardCards,
        db.tierBoardAssets,
        db.syncQueue,
      ],
      async () => {
        await db.works.bulkPut(
          worksToImport.map(prepareImportedWorkForStorage),
        );
        await db.releaseRecords.bulkPut(releaseRecordsToImport);
        await db.timelineEntries.bulkPut(timelineEntriesToImport);
        await db.series.bulkPut(seriesToImport);
        await db.contributors.bulkPut(contributorsToImport);
        await db.workSeriesLinks.bulkPut(workSeriesLinksToImport);
        await db.workContributors.bulkPut(workContributorsToImport);
        await db.workRelations.bulkPut(workRelationsToImport);
        await db.tierBoards.bulkPut(tierBoardsToImport);
        await db.tierLanes.bulkPut(tierLanesToImport);
        await db.tierBoardCards.bulkPut(tierBoardCardsToImport);
        await db.tierBoardAssets.bulkPut(tierBoardAssetsToImport);

        for (const work of worksToImport) {
          if (work.deletedAt !== null) {
            continue;
          }

          await db.syncQueue.add(
            createQueueItem('work', work.id, 'create', {
              ...work,
              genres: [...work.genres],
              personalTags: [...work.personalTags],
            }),
          );
        }

        for (const releaseRecord of releaseRecordsToImport) {
          if (releaseRecord.deletedAt !== null) {
            continue;
          }

          if (
            worksToImportById.get(releaseRecord.userWorkRecordId)?.deletedAt !==
            null
          ) {
            continue;
          }

          await db.syncQueue.add(
            createQueueItem('release_record', releaseRecord.id, 'create', {
              ...releaseRecord,
            }),
          );
        }

        for (const timelineEntry of timelineEntriesToImport) {
          if (timelineEntry.deletedAt !== null) {
            continue;
          }

          const queuedTimelineEntry: TimelineEntryRecord = {
            ...timelineEntry,
            syncStatus: 'pending',
          };

          await db.timelineEntries.put(queuedTimelineEntry);
          await db.syncQueue.add(
            createQueueItem('timeline_entry', timelineEntry.id, 'create', {
              ...timelineEntry,
              syncStatus: 'pending',
            }),
          );
        }

        for (const entity of seriesToImport) {
          if (entity.deletedAt === null) {
            await db.syncQueue.add(
              createQueueItem('series', entity.id, 'create', entity),
            );
          }
        }

        for (const entity of contributorsToImport) {
          if (entity.deletedAt === null) {
            await db.syncQueue.add(
              createQueueItem('contributor', entity.id, 'create', entity),
            );
          }
        }

        for (const entity of workSeriesLinksToImport) {
          if (entity.deletedAt === null) {
            await db.syncQueue.add(
              createQueueItem('work_series_link', entity.id, 'create', entity),
            );
          }
        }

        for (const entity of workContributorsToImport) {
          if (entity.deletedAt === null) {
            await db.syncQueue.add(
              createQueueItem('work_contributor', entity.id, 'create', entity),
            );
          }
        }

        for (const entity of workRelationsToImport) {
          if (entity.deletedAt === null) {
            await db.syncQueue.add(
              createQueueItem('work_relation', entity.id, 'create', entity),
            );
          }
        }

        for (const entity of tierBoardsToImport) {
          if (entity.deletedAt === null) {
            await db.syncQueue.add(
              createQueueItem('tier_board', entity.id, 'create', entity),
            );
          }
        }

        for (const entity of tierLanesToImport) {
          if (entity.deletedAt === null) {
            await db.syncQueue.add(
              createQueueItem('tier_lane', entity.id, 'create', entity),
            );
          }
        }

        for (const entity of tierBoardCardsToImport) {
          if (entity.deletedAt === null) {
            await db.syncQueue.add(
              createQueueItem('tier_board_card', entity.id, 'create', entity),
            );
          }
        }

        for (const entity of tierBoardAssetsToImport) {
          if (entity.deletedAt === null) {
            await db.syncQueue.add(
              createQueueItem('tier_board_asset', entity.id, 'create', entity),
            );
          }
        }
      },
    );

    return {
      ...preview,
      importedContributorCount: contributorsToImport.length,
      importedReleaseRecordCount: releaseRecordsToImport.length,
      importedSeriesCount: seriesToImport.length,
      importedTierBoardAssetCount: tierBoardAssetsToImport.length,
      importedTierBoardCardCount: tierBoardCardsToImport.length,
      importedTierBoardCount: tierBoardsToImport.length,
      importedTierLaneCount: tierLanesToImport.length,
      importedTimelineEntryCount: timelineEntriesToImport.length,
      importedWorkContributorCount: workContributorsToImport.length,
      importedWorkCount: worksToImport.length,
      importedWorkRelationCount: workRelationsToImport.length,
      importedWorkSeriesLinkCount: workSeriesLinksToImport.length,
    };
  }
}

export const localArchiveService = new LocalArchiveService();
