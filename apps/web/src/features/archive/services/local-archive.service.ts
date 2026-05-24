import {
  TIMELINE_ENTRY_TYPES,
  type AppMetaRecord,
  type ContributorRecord,
  type SeriesRecord,
  type SyncOperation,
  type SyncQueueItemRecord,
  type SyncQueuePayload,
  type TierBoardAssetRecord,
  type TierBoardCardRecord,
  type TierBoardRecord,
  type TierLaneRecord,
  type TimelineEntryRecord,
  type UserReleaseRecord,
  type WorkContributorRecord,
  type WorkRelationRecord,
  type WorkRecord,
  type WorkSeriesLinkRecord,
} from '@work-archive/shared-types';

import {
  getWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../../works/storage';

const ARCHIVE_FORMAT = 'work-archive.local-archive';
const ARCHIVE_VERSION = 1;
const ARCHIVE_SCHEMA_VERSION = 2;
const ARCHIVE_SOURCE = 'work-archive-web';
const ARCHIVE_SCOPES = ['simple', 'full'] as const;
const BACKUP_EXCLUSIONS = [
  'syncQueue',
  'authTokens',
  'refreshCookie',
  'providerApiKeys',
];

export type LocalArchiveScope = (typeof ARCHIVE_SCOPES)[number];
type DatabaseResolver = () => WorkArchiveDatabase;
type StoredTierBoardAssetRecord = TierBoardAssetRecord & {
  blob?: Blob | null;
  dataUrl?: string;
};

export interface LocalArchiveExport {
  appMeta: AppMetaRecord[];
  backupExclusions: string[];
  contributors?: ContributorRecord[];
  exportedAt: string;
  format: typeof ARCHIVE_FORMAT;
  releaseRecords: UserReleaseRecord[];
  schemaVersion: typeof ARCHIVE_SCHEMA_VERSION;
  scope: LocalArchiveScope;
  series?: SeriesRecord[];
  source: typeof ARCHIVE_SOURCE;
  tierBoardAssets?: TierBoardAssetRecord[];
  tierBoardCards?: TierBoardCardRecord[];
  tierBoards?: TierBoardRecord[];
  tierLanes?: TierLaneRecord[];
  timelineEntries: TimelineEntryRecord[];
  version: typeof ARCHIVE_VERSION;
  workContributors?: WorkContributorRecord[];
  workRelations?: WorkRelationRecord[];
  works: WorkRecord[];
  workSeriesLinks?: WorkSeriesLinkRecord[];
}

export interface LocalArchiveImportPreview {
  addContributorCount: number;
  addReleaseRecordCount: number;
  addSeriesCount: number;
  addTierBoardAssetCount: number;
  addTierBoardCardCount: number;
  addTierBoardCount: number;
  addTierLaneCount: number;
  addTimelineEntryCount: number;
  addWorkContributorCount: number;
  addWorkCount: number;
  addWorkRelationCount: number;
  addWorkSeriesLinkCount: number;
  conflictWorkCount: number;
  contributorCount: number;
  duplicateTimelineEntryCount: number;
  duplicateTitleCount: number;
  duplicateWorkCount: number;
  idCollisionCount: number;
  releaseRecordCount: number;
  seriesCount: number;
  skippedContributorCount: number;
  skippedReleaseRecordCount: number;
  skippedSeriesCount: number;
  skippedTierBoardAssetCount: number;
  skippedTierBoardCardCount: number;
  skippedTierBoardCount: number;
  skippedTierLaneCount: number;
  skippedTimelineEntryCount: number;
  skippedWorkContributorCount: number;
  skippedWorkCount: number;
  skippedWorkRelationCount: number;
  skippedWorkSeriesLinkCount: number;
  tierBoardAssetCount: number;
  tierBoardCardCount: number;
  tierBoardCount: number;
  tierLaneCount: number;
  timelineEntryCount: number;
  updateWorkCount: number;
  workContributorCount: number;
  workCount: number;
  workRelationCount: number;
  workSeriesLinkCount: number;
}

export interface LocalArchiveImportResult extends LocalArchiveImportPreview {
  importedContributorCount: number;
  importedReleaseRecordCount: number;
  importedSeriesCount: number;
  importedTierBoardAssetCount: number;
  importedTierBoardCardCount: number;
  importedTierBoardCount: number;
  importedTierLaneCount: number;
  importedTimelineEntryCount: number;
  importedWorkContributorCount: number;
  importedWorkCount: number;
  importedWorkRelationCount: number;
  importedWorkSeriesLinkCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/[^0-9a-z가-힣]+/g, '');
}

function createTitleDuplicateKey(work: Pick<WorkRecord, 'title' | 'type'>) {
  return `${work.type}:${normalizeTitle(work.title)}`;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      )
    : [];
}

function normalizeArchiveScope(value: unknown): LocalArchiveScope {
  return typeof value === 'string' &&
    ARCHIVE_SCOPES.includes(value as LocalArchiveScope)
    ? (value as LocalArchiveScope)
    : 'simple';
}

function normalizeRecordArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeArchiveWork(work: WorkRecord): WorkRecord {
  return {
    ...work,
    startedAt: work.startedAt ?? null,
    completedAt: work.completedAt ?? null,
    droppedAt: work.droppedAt ?? null,
    lastConsumedAt: work.lastConsumedAt ?? null,
    genres: normalizeStringArray(work.genres),
    personalTags: normalizeStringArray(
      (work as Partial<WorkRecord>).personalTags,
    ),
  };
}

function stripLocalOnlyWorkFields(
  work: WorkRecord & { _deletedAtScope?: unknown },
): WorkRecord {
  const { _deletedAtScope: _localOnlyIndex, ...archiveWork } = work;

  return normalizeArchiveWork(archiveWork);
}

function stripLocalOnlyTierBoardAssetFields(
  asset: StoredTierBoardAssetRecord,
): TierBoardAssetRecord {
  const { blob: _blob, dataUrl: _dataUrl, ...archiveAsset } = asset;

  return archiveAsset;
}

function prepareImportedWorkForStorage(work: WorkRecord) {
  return {
    ...work,
    _deletedAtScope: work.deletedAt === null ? 'active' : 'deleted',
  };
}

function cloneWorkForImport(work: WorkRecord, id: string): WorkRecord {
  const normalizedWork = normalizeArchiveWork(work);

  return {
    ...normalizedWork,
    genres: [...normalizedWork.genres],
    personalTags: [...normalizedWork.personalTags],
    id,
    importDraft: normalizedWork.importDraft
      ? { ...normalizedWork.importDraft }
      : null,
    serverVersion: 0,
    syncStatus: 'local-only',
  };
}

function cloneReleaseRecordForImport(
  releaseRecord: UserReleaseRecord,
  id: string,
  userWorkRecordId: string,
): UserReleaseRecord {
  return {
    ...releaseRecord,
    id,
    serverVersion: 0,
    syncStatus: 'local-only',
    userWorkRecordId,
  };
}

function normalizeTimelineEntry(
  entry: TimelineEntryRecord,
): TimelineEntryRecord {
  return {
    ...entry,
    deletedAt: entry.deletedAt ?? null,
    note: typeof entry.note === 'string' ? entry.note : '',
    serverVersion: Number.isInteger(entry.serverVersion)
      ? entry.serverVersion
      : 0,
    syncStatus: entry.syncStatus ?? 'local-only',
    type: TIMELINE_ENTRY_TYPES.includes(entry.type) ? entry.type : 'note',
  };
}

function cloneTimelineEntryForImport(
  entry: TimelineEntryRecord,
  id: string,
  workId: string,
): TimelineEntryRecord {
  return {
    ...normalizeTimelineEntry(entry),
    id,
    workId,
  };
}

function cloneSyncEntityForImport<T extends SyncQueuePayload>(
  entity: T,
  id: string,
): T {
  return {
    ...entity,
    id,
    serverVersion: 'serverVersion' in entity ? 0 : undefined,
    syncStatus: 'syncStatus' in entity ? 'local-only' : undefined,
  } as T;
}

function parseArchive(rawValue: string): LocalArchiveExport {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    throw new Error('JSON 백업 파일을 읽지 못했습니다.');
  }

  if (
    !isRecord(parsedValue) ||
    parsedValue.format !== ARCHIVE_FORMAT ||
    parsedValue.version !== ARCHIVE_VERSION ||
    !Array.isArray(parsedValue.works) ||
    !Array.isArray(parsedValue.releaseRecords)
  ) {
    throw new Error('Work Archive JSON 백업 파일 형식이 아닙니다.');
  }

  const scope = normalizeArchiveScope(parsedValue.scope);
  const shouldReadFullArchiveData = scope === 'full';

  return {
    appMeta: Array.isArray(parsedValue.appMeta)
      ? (parsedValue.appMeta as AppMetaRecord[])
      : [],
    backupExclusions: Array.isArray(parsedValue.backupExclusions)
      ? normalizeStringArray(parsedValue.backupExclusions)
      : [...BACKUP_EXCLUSIONS],
    contributors: shouldReadFullArchiveData
      ? normalizeRecordArray<ContributorRecord>(parsedValue.contributors)
      : [],
    exportedAt:
      typeof parsedValue.exportedAt === 'string'
        ? parsedValue.exportedAt
        : new Date().toISOString(),
    format: ARCHIVE_FORMAT,
    releaseRecords: parsedValue.releaseRecords as UserReleaseRecord[],
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    scope,
    series: shouldReadFullArchiveData
      ? normalizeRecordArray<SeriesRecord>(parsedValue.series)
      : [],
    source: ARCHIVE_SOURCE,
    tierBoardAssets: shouldReadFullArchiveData
      ? normalizeRecordArray<TierBoardAssetRecord>(parsedValue.tierBoardAssets)
      : [],
    tierBoardCards: shouldReadFullArchiveData
      ? normalizeRecordArray<TierBoardCardRecord>(parsedValue.tierBoardCards)
      : [],
    tierBoards: shouldReadFullArchiveData
      ? normalizeRecordArray<TierBoardRecord>(parsedValue.tierBoards)
      : [],
    tierLanes: shouldReadFullArchiveData
      ? normalizeRecordArray<TierLaneRecord>(parsedValue.tierLanes)
      : [],
    timelineEntries: Array.isArray(parsedValue.timelineEntries)
      ? (parsedValue.timelineEntries as TimelineEntryRecord[]).map(
          normalizeTimelineEntry,
        )
      : [],
    version: ARCHIVE_VERSION,
    workContributors: shouldReadFullArchiveData
      ? normalizeRecordArray<WorkContributorRecord>(
          parsedValue.workContributors,
        )
      : [],
    workRelations: shouldReadFullArchiveData
      ? normalizeRecordArray<WorkRelationRecord>(parsedValue.workRelations)
      : [],
    works: (parsedValue.works as WorkRecord[]).map(normalizeArchiveWork),
    workSeriesLinks: shouldReadFullArchiveData
      ? normalizeRecordArray<WorkSeriesLinkRecord>(parsedValue.workSeriesLinks)
      : [],
  };
}

function escapeCsvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function createCsvRows(works: WorkRecord[]) {
  const header = [
    'title',
    'type',
    'status',
    'rating',
    'personalTags',
    'shortReview',
    'review',
    'progress',
    'startedAt',
    'completedAt',
    'droppedAt',
    'lastConsumedAt',
    'favorite',
    'updatedAt',
  ];
  const rows = works.map((work) => {
    const progress = [
      work.progressCurrent ?? '',
      work.progressTotal ?? '',
      work.progressUnit ?? '',
      work.lastConsumedLabel ?? '',
    ]
      .filter((part) => String(part).trim() !== '')
      .join(' / ');

    return [
      work.title,
      work.type,
      work.status,
      work.rating ?? '',
      work.personalTags.join('; '),
      work.shortReview,
      work.review,
      progress,
      work.startedAt ?? '',
      work.completedAt ?? '',
      work.droppedAt ?? '',
      work.lastConsumedAt ?? '',
      work.favorite ? 'true' : 'false',
      work.updatedAt,
    ];
  });

  return [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
}

function createQueueItem<TPayload extends SyncQueuePayload>(
  entityType: SyncQueueItemRecord<TPayload>['entityType'],
  entityId: string,
  operation: SyncOperation,
  payload: TPayload,
): SyncQueueItemRecord<TPayload> {
  return {
    createdAt: new Date().toISOString(),
    entityId,
    entityType,
    id: crypto.randomUUID(),
    lastError: null,
    operation,
    payload,
    retryCount: 0,
    source: 'archive_migration',
  };
}

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
    const existingWorks = await db.works.toArray();
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
      (await db.timelineEntries.toArray()).map((entry) => entry.id),
    );
    const timelineEntryCount = archive.timelineEntries.filter((entry) =>
      importedWorkIds.has(entry.workId),
    ).length;
    const duplicateTimelineEntryCount = archive.timelineEntries.filter(
      (entry) => existingTimelineEntryIds.has(entry.id),
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
        importedWorkIds.has(link.workId) &&
        importedSeriesIds.has(link.seriesId),
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
    const existingWorkIds = new Set(existingWorks.map((work) => work.id));
    const existingReleaseRecordIds = new Set(
      existingReleaseRecords.map((record) => record.id),
    );
    const existingTimelineEntryIds = new Set(
      existingTimelineEntries.map((entry) => entry.id),
    );
    const usedWorkIds = new Set(existingWorkIds);
    const usedReleaseRecordIds = new Set(existingReleaseRecordIds);
    const usedTimelineEntryIds = new Set(existingTimelineEntryIds);
    const usedSeriesIds = new Set(existingSeries.map((entry) => entry.id));
    const usedContributorIds = new Set(
      existingContributors.map((entry) => entry.id),
    );
    const usedWorkSeriesLinkIds = new Set(
      existingWorkSeriesLinks.map((entry) => entry.id),
    );
    const usedWorkContributorIds = new Set(
      existingWorkContributors.map((entry) => entry.id),
    );
    const usedWorkRelationIds = new Set(
      existingWorkRelations.map((entry) => entry.id),
    );
    const usedTierBoardIds = new Set(
      existingTierBoards.map((entry) => entry.id),
    );
    const usedTierLaneIds = new Set(existingTierLanes.map((entry) => entry.id));
    const usedTierBoardCardIds = new Set(
      existingTierBoardCards.map((entry) => entry.id),
    );
    const usedTierBoardAssetIds = new Set(
      existingTierBoardAssets.map((entry) => entry.id),
    );
    const workIdMap = new Map<string, string>();
    const seriesIdMap = new Map<string, string>();
    const contributorIdMap = new Map<string, string>();
    const tierBoardIdMap = new Map<string, string>();
    const tierLaneIdMap = new Map<string, string>();
    const tierBoardCardIdMap = new Map<string, string>();
    const tierBoardAssetObjectUrlMap = new Map<string, string>();
    const createMappedId = (usedIds: Set<string>, id: string) => {
      let nextId = id;

      if (usedIds.has(nextId)) {
        nextId = crypto.randomUUID();
      }

      usedIds.add(nextId);

      return nextId;
    };
    const worksToImport = archive.works.map((work) => {
      const nextId = createMappedId(usedWorkIds, work.id);
      workIdMap.set(work.id, nextId);

      return cloneWorkForImport(work, nextId);
    });
    const worksToImportById = new Map(
      worksToImport.map((work) => [work.id, work]),
    );
    const releaseRecordsToImport = archive.releaseRecords.flatMap(
      (releaseRecord) => {
        const mappedWorkId = workIdMap.get(releaseRecord.userWorkRecordId);

        if (!mappedWorkId) {
          return [];
        }

        let nextId = releaseRecord.id;

        if (usedReleaseRecordIds.has(nextId)) {
          nextId = crypto.randomUUID();
        }

        usedReleaseRecordIds.add(nextId);

        return [
          cloneReleaseRecordForImport(releaseRecord, nextId, mappedWorkId),
        ];
      },
    );
    const timelineEntriesToImport = archive.timelineEntries.flatMap((entry) => {
      const mappedWorkId = workIdMap.get(entry.workId);

      if (!mappedWorkId) {
        return [];
      }

      let nextId = entry.id;

      if (usedTimelineEntryIds.has(nextId)) {
        nextId = crypto.randomUUID();
      }

      usedTimelineEntryIds.add(nextId);

      return [cloneTimelineEntryForImport(entry, nextId, mappedWorkId)];
    });
    const archiveSeries = archive.series ?? [];

    for (const series of archiveSeries) {
      seriesIdMap.set(series.id, createMappedId(usedSeriesIds, series.id));
    }

    const seriesToImport = archiveSeries.map((series) => {
      const nextId = seriesIdMap.get(series.id)!;
      seriesIdMap.set(series.id, nextId);

      return {
        ...cloneSyncEntityForImport(series, nextId),
        parentId: series.parentId
          ? (seriesIdMap.get(series.parentId) ?? null)
          : null,
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
        const mappedLaneId = card.laneId
          ? tierLaneIdMap.get(card.laneId)
          : null;
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
