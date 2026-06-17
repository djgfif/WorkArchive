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
  WorkRecord,
  WorkRelationRecord,
  WorkSeriesLinkRecord,
} from '@work-archive/shared-types';

import {
  cloneReleaseRecordForImport,
  cloneSyncEntityForImport,
  cloneTimelineEntryForImport,
  cloneWorkForImport,
  createLocalArchiveRecordCounts,
  createTitleDuplicateKey,
} from './local-archive-format';
import type {
  LocalArchiveExport,
  LocalArchiveImportPreview,
} from './local-archive.types';

export interface LocalArchiveImportExistingRecords {
  contributors: ContributorRecord[];
  releaseRecords: UserReleaseRecord[];
  series: SeriesRecord[];
  tierBoardAssets: TierBoardAssetRecord[];
  tierBoardCards: TierBoardCardRecord[];
  tierBoards: TierBoardRecord[];
  tierLanes: TierLaneRecord[];
  timelineEntries: TimelineEntryRecord[];
  workContributors: WorkContributorRecord[];
  workRelations: WorkRelationRecord[];
  works: WorkRecord[];
  workSeriesLinks: WorkSeriesLinkRecord[];
}

export interface LocalArchiveImportPlan {
  contributorsToImport: ContributorRecord[];
  releaseRecordsToImport: UserReleaseRecord[];
  seriesToImport: SeriesRecord[];
  tierBoardAssetsToImport: TierBoardAssetRecord[];
  tierBoardCardsToImport: TierBoardCardRecord[];
  tierBoardsToImport: TierBoardRecord[];
  tierLanesToImport: TierLaneRecord[];
  timelineEntriesToImport: TimelineEntryRecord[];
  workContributorsToImport: WorkContributorRecord[];
  workRelationsToImport: WorkRelationRecord[];
  worksToImport: WorkRecord[];
  worksToImportById: Map<string, WorkRecord>;
  workSeriesLinksToImport: WorkSeriesLinkRecord[];
}

export function createLocalArchiveImportPreview(input: {
  archive: LocalArchiveExport;
  existingTimelineEntries: TimelineEntryRecord[];
  existingWorks: WorkRecord[];
}): LocalArchiveImportPreview {
  const { archive, existingTimelineEntries, existingWorks } = input;
  const existingIds = new Set(existingWorks.map((work) => work.id));
  const existingTitleKeys = new Set(
    existingWorks
      .filter((work) => work.deletedAt === null)
      .map(createTitleDuplicateKey),
  );
  const importedWorkIds = new Set(archive.works.map((work) => work.id));
  const releaseRecordCount = archive.releaseRecords.filter((releaseRecord) =>
    importedWorkIds.has(releaseRecord.userWorkRecordId),
  ).length;
  const existingTimelineEntryIds = new Set(
    existingTimelineEntries.map((entry) => entry.id),
  );
  const timelineEntryCount = archive.timelineEntries.filter((entry) =>
    importedWorkIds.has(entry.workId),
  ).length;
  const duplicateTimelineEntryCount = archive.timelineEntries.filter((entry) =>
    existingTimelineEntryIds.has(entry.id),
  ).length;
  const duplicateTitleCount = archive.works.filter(
    (work) =>
      work.deletedAt === null &&
      existingTitleKeys.has(createTitleDuplicateKey(work)),
  ).length;
  const idCollisionCount = archive.works.filter((work) =>
    existingIds.has(work.id),
  ).length;
  const archiveSeries = archive.series ?? [];
  const archiveContributors = archive.contributors ?? [];
  const archiveWorkSeriesLinks = archive.workSeriesLinks ?? [];
  const archiveWorkContributors = archive.workContributors ?? [];
  const archiveWorkRelations = archive.workRelations ?? [];
  const archiveTierBoards = archive.tierBoards ?? [];
  const archiveTierLanes = archive.tierLanes ?? [];
  const archiveTierBoardCards = archive.tierBoardCards ?? [];
  const archiveTierBoardAssets = archive.tierBoardAssets ?? [];
  const importedSeriesIds = new Set(archiveSeries.map((series) => series.id));
  const importedContributorIds = new Set(
    archiveContributors.map((contributor) => contributor.id),
  );
  const importedTierBoardIds = new Set(
    archiveTierBoards.map((board) => board.id),
  );
  const workSeriesLinkCount = archiveWorkSeriesLinks.filter(
    (link) =>
      importedWorkIds.has(link.workId) && importedSeriesIds.has(link.seriesId),
  ).length;
  const workContributorCount = archiveWorkContributors.filter(
    (link) =>
      importedWorkIds.has(link.workId) &&
      importedContributorIds.has(link.contributorId),
  ).length;
  const workRelationCount = archiveWorkRelations.filter(
    (relation) =>
      importedWorkIds.has(relation.sourceWorkId) &&
      importedWorkIds.has(relation.targetWorkId),
  ).length;
  const validTierLaneIds = new Set(
    archiveTierLanes
      .filter((lane) => importedTierBoardIds.has(lane.boardId))
      .map((lane) => lane.id),
  );
  const validTierBoardCardIds = new Set(
    archiveTierBoardCards
      .filter(
        (card) =>
          importedTierBoardIds.has(card.boardId) &&
          (card.laneId === null || validTierLaneIds.has(card.laneId)) &&
          (card.workId === null || importedWorkIds.has(card.workId)),
      )
      .map((card) => card.id),
  );
  const tierLaneCount = validTierLaneIds.size;
  const tierBoardCardCount = validTierBoardCardIds.size;
  const tierBoardAssetCount = archiveTierBoardAssets.filter(
    (asset) =>
      importedTierBoardIds.has(asset.boardId) &&
      (asset.cardId === null || validTierBoardCardIds.has(asset.cardId)),
  ).length;
  const sourceRecordCounts = createLocalArchiveRecordCounts(archive);

  return {
    addContributorCount: archiveContributors.length,
    addReleaseRecordCount: releaseRecordCount,
    addSeriesCount: archiveSeries.length,
    addTierBoardAssetCount: tierBoardAssetCount,
    addTierBoardCardCount: tierBoardCardCount,
    addTierBoardCount: archiveTierBoards.length,
    addTierLaneCount: tierLaneCount,
    addTimelineEntryCount: timelineEntryCount,
    addWorkContributorCount: workContributorCount,
    addWorkCount: archive.works.length,
    addWorkRelationCount: workRelationCount,
    addWorkSeriesLinkCount: workSeriesLinkCount,
    conflictWorkCount: idCollisionCount,
    contributorCount: archiveContributors.length,
    duplicateTimelineEntryCount,
    duplicateTitleCount,
    duplicateWorkCount: duplicateTitleCount,
    idCollisionCount,
    releaseRecordCount,
    seriesCount: archiveSeries.length,
    skippedContributorCount: 0,
    skippedReleaseRecordCount:
      archive.releaseRecords.length - releaseRecordCount,
    skippedSeriesCount: 0,
    skippedTierBoardAssetCount:
      archiveTierBoardAssets.length - tierBoardAssetCount,
    skippedTierBoardCardCount:
      archiveTierBoardCards.length - tierBoardCardCount,
    skippedTierBoardCount: 0,
    skippedTierLaneCount: archiveTierLanes.length - tierLaneCount,
    skippedTimelineEntryCount:
      archive.timelineEntries.length - timelineEntryCount,
    skippedWorkContributorCount:
      archiveWorkContributors.length - workContributorCount,
    skippedWorkCount: 0,
    skippedWorkRelationCount: archiveWorkRelations.length - workRelationCount,
    skippedWorkSeriesLinkCount:
      archiveWorkSeriesLinks.length - workSeriesLinkCount,
    sourceExportedAt: archive.exportedAt,
    sourceRecordCounts,
    sourceSchemaVersion: archive.schemaVersion,
    sourceScope: archive.scope,
    tierBoardAssetCount,
    tierBoardCardCount,
    tierBoardCount: archiveTierBoards.length,
    tierLaneCount,
    timelineEntryCount,
    updateWorkCount: 0,
    workContributorCount,
    workCount: archive.works.length,
    workRelationCount,
    workSeriesLinkCount,
  };
}

export function buildLocalArchiveImportPlan(input: {
  archive: LocalArchiveExport;
  existingRecords: LocalArchiveImportExistingRecords;
}): LocalArchiveImportPlan {
  const { archive, existingRecords } = input;
  const usedWorkIds = new Set(existingRecords.works.map((work) => work.id));
  const usedReleaseRecordIds = new Set(
    existingRecords.releaseRecords.map((record) => record.id),
  );
  const usedTimelineEntryIds = new Set(
    existingRecords.timelineEntries.map((entry) => entry.id),
  );
  const usedSeriesIds = new Set(
    existingRecords.series.map((entry) => entry.id),
  );
  const usedContributorIds = new Set(
    existingRecords.contributors.map((entry) => entry.id),
  );
  const usedWorkSeriesLinkIds = new Set(
    existingRecords.workSeriesLinks.map((entry) => entry.id),
  );
  const usedWorkContributorIds = new Set(
    existingRecords.workContributors.map((entry) => entry.id),
  );
  const usedWorkRelationIds = new Set(
    existingRecords.workRelations.map((entry) => entry.id),
  );
  const usedTierBoardIds = new Set(
    existingRecords.tierBoards.map((entry) => entry.id),
  );
  const usedTierLaneIds = new Set(
    existingRecords.tierLanes.map((entry) => entry.id),
  );
  const usedTierBoardCardIds = new Set(
    existingRecords.tierBoardCards.map((entry) => entry.id),
  );
  const usedTierBoardAssetIds = new Set(
    existingRecords.tierBoardAssets.map((entry) => entry.id),
  );
  const workIdMap = new Map<string, string>();
  const seriesIdMap = new Map<string, string>();
  const contributorIdMap = new Map<string, string>();
  const tierBoardIdMap = new Map<string, string>();
  const tierLaneIdMap = new Map<string, string>();
  const tierBoardCardIdMap = new Map<string, string>();
  const tierBoardAssetObjectUrlMap = new Map<string, string>();

  const worksToImport = archive.works.map((work) => {
    const nextId = createMappedId(usedWorkIds, work.id);
    workIdMap.set(work.id, nextId);

    return cloneWorkForImport(work, nextId);
  });
  const releaseRecordsToImport = archive.releaseRecords.flatMap(
    (releaseRecord) => {
      const mappedWorkId = workIdMap.get(releaseRecord.userWorkRecordId);

      if (!mappedWorkId) {
        return [];
      }

      return [
        cloneReleaseRecordForImport(
          releaseRecord,
          createMappedId(usedReleaseRecordIds, releaseRecord.id),
          mappedWorkId,
        ),
      ];
    },
  );
  const timelineEntriesToImport = archive.timelineEntries.flatMap((entry) => {
    const mappedWorkId = workIdMap.get(entry.workId);

    if (!mappedWorkId) {
      return [];
    }

    return [
      cloneTimelineEntryForImport(
        entry,
        createMappedId(usedTimelineEntryIds, entry.id),
        mappedWorkId,
      ),
    ];
  });
  const archiveSeries = archive.series ?? [];

  for (const series of archiveSeries) {
    seriesIdMap.set(series.id, createMappedId(usedSeriesIds, series.id));
  }

  const seriesToImport = archiveSeries.map((series) => {
    const nextId = seriesIdMap.get(series.id)!;

    return {
      ...cloneSyncEntityForImport(series, nextId),
      parentId: series.parentId ? (seriesIdMap.get(series.parentId) ?? null) : null,
    };
  });
  const contributorsToImport = (archive.contributors ?? []).map(
    (contributor) => {
      const nextId = createMappedId(usedContributorIds, contributor.id);
      contributorIdMap.set(contributor.id, nextId);

      return cloneSyncEntityForImport(contributor, nextId);
    },
  );
  const workSeriesLinksToImport = (archive.workSeriesLinks ?? []).flatMap(
    (link) => {
      const mappedWorkId = workIdMap.get(link.workId);
      const mappedSeriesId = seriesIdMap.get(link.seriesId);

      if (!mappedWorkId || !mappedSeriesId) {
        return [];
      }

      return [
        {
          ...cloneSyncEntityForImport(
            link,
            createMappedId(usedWorkSeriesLinkIds, link.id),
          ),
          seriesId: mappedSeriesId,
          workId: mappedWorkId,
        },
      ];
    },
  );
  const workContributorsToImport = (archive.workContributors ?? []).flatMap(
    (link) => {
      const mappedWorkId = workIdMap.get(link.workId);
      const mappedContributorId = contributorIdMap.get(link.contributorId);

      if (!mappedWorkId || !mappedContributorId) {
        return [];
      }

      return [
        {
          ...cloneSyncEntityForImport(
            link,
            createMappedId(usedWorkContributorIds, link.id),
          ),
          contributorId: mappedContributorId,
          workId: mappedWorkId,
        },
      ];
    },
  );
  const workRelationsToImport = (archive.workRelations ?? []).flatMap(
    (relation) => {
      const mappedSourceWorkId = workIdMap.get(relation.sourceWorkId);
      const mappedTargetWorkId = workIdMap.get(relation.targetWorkId);

      if (!mappedSourceWorkId || !mappedTargetWorkId) {
        return [];
      }

      return [
        {
          ...cloneSyncEntityForImport(
            relation,
            createMappedId(usedWorkRelationIds, relation.id),
          ),
          sourceWorkId: mappedSourceWorkId,
          targetWorkId: mappedTargetWorkId,
        },
      ];
    },
  );
  const tierBoardsToImport = (archive.tierBoards ?? []).map((board) => {
    const nextId = createMappedId(usedTierBoardIds, board.id);
    tierBoardIdMap.set(board.id, nextId);

    return cloneSyncEntityForImport(board, nextId);
  });
  const tierLanesToImport = (archive.tierLanes ?? []).flatMap((lane) => {
    const mappedBoardId = tierBoardIdMap.get(lane.boardId);

    if (!mappedBoardId) {
      return [];
    }

    const nextId = createMappedId(usedTierLaneIds, lane.id);
    tierLaneIdMap.set(lane.id, nextId);

    return [
      {
        ...cloneSyncEntityForImport(lane, nextId),
        boardId: mappedBoardId,
      },
    ];
  });
  const tierBoardCardsToImport = (archive.tierBoardCards ?? []).flatMap(
    (card) => {
      const mappedBoardId = tierBoardIdMap.get(card.boardId);
      const mappedLaneId = card.laneId ? tierLaneIdMap.get(card.laneId) : null;
      const mappedWorkId = card.workId ? workIdMap.get(card.workId) : null;

      if (
        !mappedBoardId ||
        (card.laneId && !mappedLaneId) ||
        (card.workId && !mappedWorkId)
      ) {
        return [];
      }

      const nextId = createMappedId(usedTierBoardCardIds, card.id);
      tierBoardCardIdMap.set(card.id, nextId);

      return [
        {
          ...cloneSyncEntityForImport(card, nextId),
          boardId: mappedBoardId,
          laneId: mappedLaneId ?? null,
          workId: mappedWorkId ?? null,
        },
      ];
    },
  );
  const tierBoardAssetsToImport = (archive.tierBoardAssets ?? []).flatMap(
    (asset) => {
      const mappedBoardId = tierBoardIdMap.get(asset.boardId);
      const mappedCardId = asset.cardId
        ? tierBoardCardIdMap.get(asset.cardId)
        : null;

      if (!mappedBoardId || (asset.cardId && !mappedCardId)) {
        return [];
      }

      const nextId = createMappedId(usedTierBoardAssetIds, asset.id);
      const objectUrl =
        asset.storageType === 'local_blob'
          ? `indexeddb://tier-board-assets/${nextId}`
          : asset.objectUrl;

      if (asset.objectUrl) {
        tierBoardAssetObjectUrlMap.set(asset.objectUrl, objectUrl);
      }

      return [
        {
          ...asset,
          boardId: mappedBoardId,
          cardId: mappedCardId ?? null,
          id: nextId,
          objectUrl,
        },
      ];
    },
  );

  for (const card of tierBoardCardsToImport) {
    if (tierBoardAssetObjectUrlMap.has(card.imageUrl)) {
      card.imageUrl = tierBoardAssetObjectUrlMap.get(card.imageUrl)!;
    }
  }

  return {
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
    worksToImportById: new Map(worksToImport.map((work) => [work.id, work])),
    workSeriesLinksToImport,
  };
}

function createMappedId(usedIds: Set<string>, id: string) {
  let nextId = id;

  if (usedIds.has(nextId)) {
    nextId = crypto.randomUUID();
  }

  usedIds.add(nextId);

  return nextId;
}
