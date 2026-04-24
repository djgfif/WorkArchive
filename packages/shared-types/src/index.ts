export type ISODateString = string;

export interface AuditFields {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type EntityId = string;

export const SYNC_ENTITY_TYPES = ['work', 'release_record'] as const;

export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];

export const SYNC_OPERATIONS = ['create', 'update', 'delete'] as const;

export type SyncOperation = (typeof SYNC_OPERATIONS)[number];

export const WORK_TYPES = [
  'novel',
  'anime',
  'manga',
  'light_novel',
  'web_novel',
  'webtoon',
  'movie',
  'drama',
  'other',
] as const;

export type WorkType = (typeof WORK_TYPES)[number];

export type CatalogMediumType = WorkType;

export const CATALOG_SEARCH_MEDIUM_TYPES = ['all', ...WORK_TYPES] as const;

export type CatalogSearchMediumType =
  (typeof CATALOG_SEARCH_MEDIUM_TYPES)[number];

export interface WorkImportContributor {
  name: string;
}

export interface WorkImportExternalRef {
  provider: string;
  externalId: string;
  rawType?: string;
  url?: string;
}

export interface WorkImportReleaseCandidate {
  displayLabel?: string;
  externalRefs?: WorkImportExternalRef[];
  isbn?: string | null;
  releaseDate?: ISODateString | null;
  releaseType?: string;
  sequence?: number | null;
  thumbnailUrl?: string;
  title?: string;
}

export interface WorkImportDraft {
  catalogTitle?: string;
  mediumType: WorkType;
  franchiseName?: string | null;
  subType?: string | null;
  releaseYear?: number | null;
  contributors?: WorkImportContributor[];
  externalRefs?: WorkImportExternalRef[];
  releaseCandidates?: WorkImportReleaseCandidate[];
}

export const WORK_STATUSES = [
  'planned',
  'in_progress',
  'completed',
  'paused',
  'dropped',
] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

export const WORK_TIERS = ['S', 'A', 'B', 'C', 'D'] as const;

export type WorkTier = (typeof WORK_TIERS)[number];

export const WORK_SYNC_STATUSES = [
  'local-only',
  'pending',
  'synced',
  'conflict',
] as const;

export type WorkSyncStatus = (typeof WORK_SYNC_STATUSES)[number];

export const USER_ROLES = ['user', 'moderator', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const CATALOG_VERIFICATION_STATUSES = [
  'draft',
  'pending',
  'verified',
  'rejected',
  'merged',
] as const;

export type CatalogVerificationStatus =
  (typeof CATALOG_VERIFICATION_STATUSES)[number];

export const CATALOG_RELATION_TYPES = [
  'original',
  'adaptation',
  'spin_off',
  'sequel',
  'prequel',
  'side_story',
  'remake',
  'compilation',
  'alternate_version',
] as const;

export type CatalogRelationType = (typeof CATALOG_RELATION_TYPES)[number];

export const RECORDING_UNIT = 'catalog_title' as const;

export type RecordingUnit = typeof RECORDING_UNIT;

export const VOLUME_RECORDABLE_TYPES = [
  'novel',
  'light_novel',
  'manga',
] as const satisfies readonly WorkType[];

export type VolumeRecordableType = (typeof VOLUME_RECORDABLE_TYPES)[number];

export const PROGRESS_ONLY_TYPES = [
  'anime',
  'drama',
  'web_novel',
  'webtoon',
] as const satisfies readonly WorkType[];

export type ProgressOnlyType = (typeof PROGRESS_ONLY_TYPES)[number];

export const TITLE_SEPARATE_TYPES = [
  'anime',
  'drama',
  'web_novel',
  'webtoon',
  'movie',
] as const satisfies readonly WorkType[];

export type TitleSeparateType = (typeof TITLE_SEPARATE_TYPES)[number];

export const PROGRESS_UNITS = ['volume', 'episode', 'chapter'] as const;

export type ProgressUnit = (typeof PROGRESS_UNITS)[number];

export function isVolumeRecordableWorkType(
  type: WorkType,
): type is VolumeRecordableType {
  return VOLUME_RECORDABLE_TYPES.includes(type as VolumeRecordableType);
}

export function isProgressOnlyWorkType(
  type: WorkType,
): type is ProgressOnlyType {
  return PROGRESS_ONLY_TYPES.includes(type as ProgressOnlyType);
}

export function isTitleSeparateWorkType(
  type: WorkType,
): type is TitleSeparateType {
  return TITLE_SEPARATE_TYPES.includes(type as TitleSeparateType);
}

export function isWebPartSplitEnabled(type: WorkType) {
  return type !== 'web_novel' && type !== 'webtoon';
}

export function getDefaultProgressUnitForWorkType(
  type: WorkType,
): ProgressUnit | null {
  if (type === 'anime' || type === 'drama') {
    return 'episode';
  }

  if (type === 'web_novel' || type === 'webtoon') {
    return 'chapter';
  }

  if (isVolumeRecordableWorkType(type)) {
    return 'volume';
  }

  return null;
}

export function canUseProgressUnitForWorkType(
  type: WorkType,
  unit: ProgressUnit,
) {
  if (type === 'anime' || type === 'drama') {
    return unit === 'episode';
  }

  if (type === 'web_novel' || type === 'webtoon') {
    return unit === 'chapter';
  }

  if (isVolumeRecordableWorkType(type)) {
    return unit === 'volume' || unit === 'chapter';
  }

  return false;
}

export interface WorkRecord extends AuditFields {
  id: EntityId;
  catalogTitleId?: EntityId | null;
  importDraft?: WorkImportDraft | null;
  type: WorkType;
  title: string;
  author: string;
  genres: string[];
  description: string;
  thumbnailUrl: string;
  status: WorkStatus;
  rating: number | null;
  shortReview: string;
  review: string;
  tier: WorkTier | null;
  favorite: boolean;
  progressCurrent?: number | null;
  progressTotal?: number | null;
  progressUnit?: ProgressUnit | null;
  lastConsumedLabel?: string | null;
  deletedAt: ISODateString | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
}

export interface UserReleaseRecord extends AuditFields {
  id: EntityId;
  userWorkRecordId: EntityId;
  catalogReleaseId: EntityId;
  status: WorkStatus;
  rating: number | null;
  shortReview: string;
  review: string;
  favorite: boolean;
  deletedAt: ISODateString | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
}

export type SyncQueuePayload = WorkRecord | UserReleaseRecord;

export interface SyncQueueItemRecord<TPayload = SyncQueuePayload> {
  id: EntityId;
  entityType: SyncEntityType;
  entityId: EntityId;
  operation: SyncOperation;
  payload: TPayload;
  createdAt: ISODateString;
  retryCount: number;
  lastError: string | null;
}

export interface AppMetaRecord {
  key: string;
  value: string;
}
