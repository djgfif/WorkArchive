import type {
  AppMetaRecord,
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

import type { WorkArchiveDatabase } from '../../works/storage';

export const ARCHIVE_FORMAT = 'work-archive.local-archive';
export const ARCHIVE_VERSION = 1;
export const ARCHIVE_SCHEMA_VERSION = 2;
export const ARCHIVE_SOURCE = 'work-archive-web';
export const ARCHIVE_SCOPES = ['simple', 'full'] as const;
export const BACKUP_EXCLUSIONS = [
  'syncQueue',
  'authTokens',
  'refreshCookie',
  'providerApiKeys',
];

export type LocalArchiveScope = (typeof ARCHIVE_SCOPES)[number];
export type DatabaseResolver = () => WorkArchiveDatabase;
export type StoredTierBoardAssetRecord = TierBoardAssetRecord & {
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
