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
  type WorkRecord,
  type WorkRelationRecord,
  type WorkSeriesLinkRecord,
} from '@work-archive/shared-types';

import { appI18n } from '@app/i18n';
import {
  ARCHIVE_FORMAT,
  ARCHIVE_SCHEMA_VERSION,
  ARCHIVE_SCOPES,
  ARCHIVE_SOURCE,
  ARCHIVE_VERSION,
  BACKUP_EXCLUSIONS,
  type LocalArchiveExport,
  type LocalArchiveRecordCounts,
  type LocalArchiveScope,
  type StoredTierBoardAssetRecord,
} from './local-archive.types';

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

export function createTitleDuplicateKey(
  work: Pick<WorkRecord, 'title' | 'type'>,
) {
  return `${work.type}:${normalizeTitle(work.title)}`;
}

export function createLocalArchiveRecordCounts(
  archive: LocalArchiveExport,
): LocalArchiveRecordCounts {
  return {
    appMetaCount: archive.appMeta.length,
    contributorCount: archive.contributors?.length ?? 0,
    releaseRecordCount: archive.releaseRecords.length,
    seriesCount: archive.series?.length ?? 0,
    tierBoardAssetCount: archive.tierBoardAssets?.length ?? 0,
    tierBoardCardCount: archive.tierBoardCards?.length ?? 0,
    tierBoardCount: archive.tierBoards?.length ?? 0,
    tierLaneCount: archive.tierLanes?.length ?? 0,
    timelineEntryCount: archive.timelineEntries.length,
    workContributorCount: archive.workContributors?.length ?? 0,
    workCount: archive.works.length,
    workRelationCount: archive.workRelations?.length ?? 0,
    workSeriesLinkCount: archive.workSeriesLinks?.length ?? 0,
  };
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

export function stripLocalOnlyWorkFields(
  work: WorkRecord & { _deletedAtScope?: unknown },
): WorkRecord {
  const { _deletedAtScope: _localOnlyIndex, ...archiveWork } = work;

  return normalizeArchiveWork(archiveWork);
}

export function stripLocalOnlyTierBoardAssetFields(
  asset: StoredTierBoardAssetRecord,
): TierBoardAssetRecord {
  const { blob: _blob, dataUrl: _dataUrl, ...archiveAsset } = asset;

  return archiveAsset;
}

export function prepareImportedWorkForStorage(work: WorkRecord) {
  return {
    ...work,
    _deletedAtScope: work.deletedAt === null ? 'active' : 'deleted',
  };
}

export function cloneWorkForImport(work: WorkRecord, id: string): WorkRecord {
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

export function cloneReleaseRecordForImport(
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

export function normalizeTimelineEntry(
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

export function cloneTimelineEntryForImport(
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

export function cloneSyncEntityForImport<T extends SyncQueuePayload>(
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

export function parseArchive(rawValue: string): LocalArchiveExport {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    throw new Error(appI18n.t('archive.backup.parseError'));
  }

  if (
    !isRecord(parsedValue) ||
    parsedValue.format !== ARCHIVE_FORMAT ||
    parsedValue.version !== ARCHIVE_VERSION ||
    !Array.isArray(parsedValue.works) ||
    !Array.isArray(parsedValue.releaseRecords)
  ) {
    throw new Error(appI18n.t('archive.backup.invalidFormat'));
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

export function createCsvRows(works: WorkRecord[]) {
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

export function createQueueItem<TPayload extends SyncQueuePayload>(
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
