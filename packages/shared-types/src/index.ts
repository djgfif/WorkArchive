export type ISODateString = string;

export interface AuditFields {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type EntityId = string;

export const SYNC_ENTITY_TYPES = ['work'] as const;

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

export interface WorkRecord extends AuditFields {
  id: EntityId;
  catalogTitleId?: EntityId | null;
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
  deletedAt: ISODateString | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
}

export interface SyncQueueItemRecord<TPayload = WorkRecord> {
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
