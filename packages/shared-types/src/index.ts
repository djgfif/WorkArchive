export type ISODateString = string;

export interface AuditFields {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type EntityId = string;

export const SYNC_ENTITY_TYPES = [
  'work',
  'release_record',
  'timeline_entry',
  'series',
  'work_series_link',
  'contributor',
  'work_contributor',
  'work_relation',
  'tier_board',
  'tier_lane',
  'tier_board_card',
  'tier_board_asset',
] as const;

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

export interface ImportCatalogMatch {
  id: EntityId;
  title: string;
  verificationStatus: CatalogVerificationStatus | string;
}

export interface ImportExistingRecord {
  id: EntityId;
  status: string;
}

export interface ImportCandidate {
  author: string;
  catalogMatch: ImportCatalogMatch | null;
  confidence: number;
  confidenceLabel: string;
  contributors: Array<{
    name: string;
    role: string;
  }>;
  countLabel: string;
  description: string;
  externalId: string;
  existingRecord: ImportExistingRecord | null;
  externalRefs: WorkImportExternalRef[];
  formatLabel: string;
  franchiseName: string | null;
  genresText: string;
  id: EntityId;
  mediumType: WorkType;
  note: string;
  reason: string;
  relationsHint: Array<{
    relationType: string;
    targetTitle: string;
  }>;
  releaseCandidates: WorkImportReleaseCandidate[];
  releaseYear: number | null;
  sourceId: string;
  sourceLabel: string;
  sourceUrl: string;
  subType: string | null;
  thumbnailUrl: string;
  title: string;
  titleAliases?: string[];
  type: WorkType;
  scoreBreakdown?: Array<{
    label: string;
    weight: number;
  }>;
  sourceCoverage?: {
    externalIdentityCount: number;
    providerCount: number;
    providers: string[];
    releaseCandidateCount: number;
  };
}

export interface ImportProviderStatus {
  configured: boolean;
  credentialFields?: ImportProviderCredentialField[];
  credentialMode?: 'none' | 'server' | 'user';
  label?: string;
  mediumTypes?: WorkType[];
  provider: string;
}

export type ImportProviderKeyTestFailureReason =
  | 'missing_key'
  | 'provider_unavailable'
  | 'unauthorized'
  | 'unknown';

export interface ImportProviderKeyTestResponse {
  checkedAt: ISODateString;
  message: string;
  ok: boolean;
  provider: string;
  reason: ImportProviderKeyTestFailureReason | null;
}

export interface ImportProviderCredentialField {
  description?: string;
  label: string;
  name: string;
  secret?: boolean;
}

export type ImportSearchDiagnosticStatus = 'searched' | 'skipped' | 'failed';

export interface ImportSearchProviderDiagnostic {
  configured: boolean;
  credentialMode: 'none' | 'server' | 'user';
  message: string;
  provider: string;
  reasonCode:
    | 'circuit_open'
    | 'guest_provider_not_allowed'
    | 'provider_failed'
    | 'server_credential_missing'
    | 'unsupported_medium'
    | 'user_credential_missing'
    | null;
  resultCount: number;
  status: ImportSearchDiagnosticStatus;
}

export interface ImportSearchDiagnostics {
  providers: ImportSearchProviderDiagnostic[];
}

export interface ImportSearchResponse {
  candidates: ImportCandidate[];
  diagnostics?: ImportSearchDiagnostics;
  provider: string;
  providers: string[];
  query: string;
}

export const WORK_STATUSES = [
  'planned',
  'in_progress',
  'completed',
  'dropped',
] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

export const WORK_SYNC_STATUSES = [
  'local-only',
  'pending',
  'synced',
  'conflict',
] as const;

export type WorkSyncStatus = (typeof WORK_SYNC_STATUSES)[number];

export const USER_ROLES = ['user', 'moderator', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface ApiErrorResponse {
  message?: string | string[];
}

export interface AuthUserResponse {
  authAccounts?: Array<{
    email: string;
    emailVerified: boolean;
    name: string;
    pictureUrl: string;
    provider: string;
  }>;
  avatarUrl: string;
  email: string;
  handle?: string | null;
  id: EntityId;
  nickname: string;
  role?: UserRole;
}

export interface UpdateAuthProfileRequest {
  avatarUrl: string;
  handle: string | null;
  nickname: string;
}

export interface AuthSessionResponse {
  accessToken: string;
  user: AuthUserResponse;
}

export interface AuthRefreshSessionResponse {
  id: EntityId;
  current: boolean;
  rememberMe: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: ISODateString;
  lastUsedAt: ISODateString | null;
  rotatedAt: ISODateString | null;
  expiresAt: ISODateString;
}

export interface AuthRefreshSessionsResponse {
  sessions: AuthRefreshSessionResponse[];
}

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

export const SERIES_KINDS = [
  'series',
  'franchise',
  'universe',
  'arc',
  'collection',
] as const;

export type SeriesKind = (typeof SERIES_KINDS)[number];

export const WORK_SERIES_ROLES = [
  'main',
  'season',
  'arc',
  'movie',
  'ova',
  'spin_off',
  'side_story',
] as const;

export type WorkSeriesRole = (typeof WORK_SERIES_ROLES)[number];

export const CONTRIBUTOR_ENTITY_TYPES = [
  'person',
  'organization',
  'group',
] as const;

export type ContributorEntityType = (typeof CONTRIBUTOR_ENTITY_TYPES)[number];

export const WORK_CONTRIBUTOR_ROLES = [
  'author',
  'illustrator',
  'director',
  'studio',
  'publisher',
  'screenwriter',
  'original_creator',
  'artist',
  'translator',
  'platform',
  'production_company',
] as const;

export type WorkContributorRole = (typeof WORK_CONTRIBUTOR_ROLES)[number];

export const WORK_RELATION_TYPES = [
  ...CATALOG_RELATION_TYPES,
  'same_universe',
  'season_next',
  'season_previous',
] as const;

export type WorkRelationType = (typeof WORK_RELATION_TYPES)[number];

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
  personalTags: string[];
  description: string;
  thumbnailUrl: string;
  status: WorkStatus;
  rating: number | null;
  shortReview: string;
  review: string;
  favorite: boolean;
  progressCurrent?: number | null;
  progressTotal?: number | null;
  progressUnit?: ProgressUnit | null;
  lastConsumedLabel?: string | null;
  startedAt?: ISODateString | null;
  completedAt?: ISODateString | null;
  droppedAt?: ISODateString | null;
  lastConsumedAt?: ISODateString | null;
  deletedAt: ISODateString | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
}

export const TIER_BOARD_VISIBILITIES = [
  'private',
  'link_only',
  'exported',
] as const;

export type TierBoardVisibility = (typeof TIER_BOARD_VISIBILITIES)[number];

export const TIER_BOARD_TYPES = [
  'classic_tier',
  'ranking',
  'freeform',
] as const;

export type TierBoardType = (typeof TIER_BOARD_TYPES)[number];

export const TIER_BOARD_CARD_SOURCE_TYPES = [
  'custom',
  'image_upload',
  'image_url',
  'library_work',
] as const;

export type TierBoardCardSourceType =
  (typeof TIER_BOARD_CARD_SOURCE_TYPES)[number];

export const TIER_BOARD_ASSET_KINDS = ['image'] as const;

export type TierBoardAssetKind = (typeof TIER_BOARD_ASSET_KINDS)[number];

export const TIER_BOARD_ASSET_STORAGE_TYPES = [
  'local_blob',
  'remote_url',
] as const;

export type TierBoardAssetStorageType =
  (typeof TIER_BOARD_ASSET_STORAGE_TYPES)[number];

export interface TierBoardRecord extends AuditFields {
  id: EntityId;
  title: string;
  description: string;
  slug: string;
  boardType: TierBoardType;
  visibility: TierBoardVisibility;
  coverImageUrl: string;
  deletedAt: ISODateString | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
}

export interface TierLaneRecord extends AuditFields {
  id: EntityId;
  boardId: EntityId;
  title: string;
  description: string;
  colorToken: string;
  orderIndex: number;
  deletedAt: ISODateString | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
}

export interface TierBoardCardRecord extends AuditFields {
  id: EntityId;
  boardId: EntityId;
  laneId: EntityId | null;
  cardSourceType: TierBoardCardSourceType;
  workId: EntityId | null;
  orderIndex: number;
  title: string;
  subtitle: string;
  imageUrl: string;
  note: string;
  deletedAt: ISODateString | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
}

export interface TierBoardAssetRecord extends AuditFields {
  id: EntityId;
  boardId: EntityId;
  cardId: EntityId | null;
  kind: TierBoardAssetKind;
  storageType: TierBoardAssetStorageType;
  objectUrl: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  deletedAt: ISODateString | null;
}

export const TIMELINE_ENTRY_TYPES = [
  'note',
  'started',
  'completed',
  'dropped',
  'rewatch',
  'progress',
] as const;

export type TimelineEntryType = (typeof TIMELINE_ENTRY_TYPES)[number];

export interface TimelineEntryRecord extends AuditFields {
  id: EntityId;
  workId: EntityId;
  type: TimelineEntryType;
  occurredAt: ISODateString;
  note: string;
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

export interface SeriesRecord extends AuditFields {
  id: EntityId;
  title: string;
  normalizedTitle: string;
  aliases: string[];
  kind: SeriesKind;
  parentId: EntityId | null;
  description: string;
  thumbnailUrl: string;
  deletedAt: ISODateString | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
}

export interface WorkSeriesLinkRecord extends AuditFields {
  id: EntityId;
  workId: EntityId;
  seriesId: EntityId;
  role: WorkSeriesRole;
  orderIndex: number | null;
  orderLabel: string;
  deletedAt: ISODateString | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
}

export interface ContributorRecord extends AuditFields {
  id: EntityId;
  name: string;
  normalizedName: string;
  aliases: string[];
  entityType: ContributorEntityType;
  deletedAt: ISODateString | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
}

export interface WorkContributorRecord extends AuditFields {
  id: EntityId;
  workId: EntityId;
  contributorId: EntityId;
  role: WorkContributorRole;
  displayOrder: number;
  deletedAt: ISODateString | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
}

export interface WorkRelationRecord extends AuditFields {
  id: EntityId;
  sourceWorkId: EntityId;
  targetWorkId: EntityId;
  relationType: WorkRelationType;
  note: string;
  deletedAt: ISODateString | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
}

export interface UserRecordView {
  catalog: {
    contributors: Array<{
      id: EntityId | null;
      name: string;
      role: string;
    }>;
    franchise: {
      id: EntityId;
      name: string;
    } | null;
    genres: string[];
    id: EntityId;
    mediumType: WorkType;
    originalTitle: string | null;
    relations: Array<{
      relationType: string;
      targetTitle: string;
      targetTitleId: EntityId;
    }>;
    releaseYear: number | null;
    status: string;
    subType: string | null;
    summary: string;
    thumbnailUrl: string;
    title: string;
    verificationStatus: CatalogVerificationStatus | string;
  };
  record: {
    createdAt: ISODateString;
    deletedAt: ISODateString | null;
    favorite: boolean;
    id: EntityId;
    personalTags: string[];
    lastConsumedLabel?: string | null;
    startedAt?: ISODateString | null;
    completedAt?: ISODateString | null;
    droppedAt?: ISODateString | null;
    lastConsumedAt?: ISODateString | null;
    progressCurrent?: number | null;
    progressTotal?: number | null;
    progressUnit?: ProgressUnit | null;
    rating: number | null;
    review: string;
    serverVersion: number;
    shortReview: string;
    status: WorkStatus;
    syncStatus: WorkSyncStatus;
    updatedAt: ISODateString;
  };
}

export interface UserRecordGroupResponse {
  count: number;
  key: string;
  label: string;
  records: UserRecordView[];
}

export interface CatalogReleaseWithUserRecord {
  displayLabel: string;
  id: EntityId;
  isbn: string | null;
  releaseDate: ISODateString | null;
  releaseType: string;
  sequence: number | null;
  summary: string;
  thumbnailUrl: string;
  title: string;
  userReleaseRecord: UserReleaseRecord | null;
}

export interface UserRecordReleasePolicy {
  defaultProgressUnit: ProgressUnit | null;
  mediumType: WorkType;
  progressOnly: boolean;
  recordingUnit: RecordingUnit;
  releaseRecordsSupported: boolean;
  webPartSplitEnabled: boolean;
}

export interface UserRecordReleasesResponse {
  policy: UserRecordReleasePolicy;
  releases: CatalogReleaseWithUserRecord[];
}

export interface RelatedCatalogTitle {
  franchise: {
    id: EntityId;
    name: string;
  } | null;
  id: EntityId;
  mediumType: WorkType;
  relationDirection?: 'incoming' | 'outgoing' | null;
  relationType?: string | null;
  releaseYear: number | null;
  subType: string | null;
  thumbnailUrl: string;
  title: string;
}

export interface RelatedCatalogRelation {
  relationDirection: 'incoming' | 'outgoing';
  relationType: string;
  targetTitle: RelatedCatalogTitle;
}

export interface RelatedCatalogTitlesResponse {
  catalogTitleId: EntityId;
  currentTitle: {
    displayTitle: string;
    franchise: {
      canonicalName: string;
      id: EntityId;
      name: string;
    } | null;
    id: EntityId;
    mediumType: WorkType;
    releaseYear: number | null;
    subType: string | null;
    thumbnailUrl: string;
  };
  relations: RelatedCatalogRelation[];
  sameFranchiseTitles: RelatedCatalogTitle[];
}

export type PushResultStatus = 'applied' | 'conflict' | 'failed';

export const PUSH_RESULT_STATUSES = [
  'applied',
  'conflict',
  'failed',
] as const satisfies readonly PushResultStatus[];

export type PullSyncOperation = 'upsert' | 'delete';

export const PULL_SYNC_OPERATIONS = [
  'upsert',
  'delete',
] as const satisfies readonly PullSyncOperation[];

export type SyncQueuePayload =
  | WorkRecord
  | UserReleaseRecord
  | TimelineEntryRecord
  | SeriesRecord
  | WorkSeriesLinkRecord
  | ContributorRecord
  | WorkContributorRecord
  | WorkRelationRecord
  | TierBoardRecord
  | TierLaneRecord
  | TierBoardCardRecord
  | TierBoardAssetRecord;

export const SYNC_SCHEMA_VERSION = 5 as const;

export type SyncSchemaVersion = typeof SYNC_SCHEMA_VERSION;

export const SYNC_RESULT_CODES = [
  'already_applied',
  'applied_change',
  'applied_tombstone',
  'created',
  'missing_remote_delete_noop',
  'conflict_remote_newer',
  'conflict_remote_missing',
  'conflict_ownership_mismatch',
  'conflict_parent_changed',
  'failed_validation',
  'failed_missing_catalog_title',
  'failed_import_draft_unresolved',
  'pull_conflict_local_queue',
  'result_missing',
  'unknown',
] as const;

export type SyncResultCode = (typeof SYNC_RESULT_CODES)[number];

export const SYNC_QUEUE_SOURCES = [
  'quick_add',
  'manual_create',
  'edit_form',
  'restore',
  'progress_update',
  'timeline_entry_update',
  'release_record_update',
  'series_update',
  'work_series_link_update',
  'contributor_update',
  'work_contributor_update',
  'work_relation_update',
  'tier_board_create',
  'tier_board_update',
  'tier_board_import',
  'tier_board_migration',
  'tier_board_asset_update',
  'archive_migration',
  'unknown',
] as const;

export type SyncQueueSource = (typeof SYNC_QUEUE_SOURCES)[number];

export interface PushSyncChangeRequest<TPayload = SyncQueuePayload> {
  clientMutationId: EntityId;
  createdAt: ISODateString;
  entityId: EntityId;
  entityType: SyncEntityType;
  operation: SyncOperation;
  payload: TPayload;
  queueId: EntityId;
}

export interface PushSyncRequest {
  changes: PushSyncChangeRequest[];
  schemaVersion: SyncSchemaVersion;
}

export interface PushSyncResult {
  code?: SyncResultCode;
  entityId: EntityId;
  entityType: SyncEntityType;
  message: string;
  queueId: EntityId;
  releaseRecord?: UserReleaseRecord | null;
  series?: SeriesRecord | null;
  tierBoard?: TierBoardRecord | null;
  tierLane?: TierLaneRecord | null;
  tierBoardCard?: TierBoardCardRecord | null;
  tierBoardAsset?: TierBoardAssetRecord | null;
  timelineEntry?: TimelineEntryRecord | null;
  workContributor?: WorkContributorRecord | null;
  workRelation?: WorkRelationRecord | null;
  workSeriesLink?: WorkSeriesLinkRecord | null;
  status: PushResultStatus;
  work?: WorkRecord | null;
  contributor?: ContributorRecord | null;
}

export interface PushSyncResponse {
  processedAt: ISODateString;
  results: PushSyncResult[];
  schemaVersion: SyncSchemaVersion;
}

export interface PullSyncRequest {
  cursor?: string | null;
  limit?: number;
  schemaVersion: SyncSchemaVersion;
  since?: ISODateString | null;
}

export interface PullSyncChange {
  entityId: EntityId;
  entityType: SyncEntityType;
  operation: PullSyncOperation;
  contributor?: ContributorRecord;
  releaseRecord?: UserReleaseRecord;
  series?: SeriesRecord;
  tierBoard?: TierBoardRecord;
  tierLane?: TierLaneRecord;
  tierBoardCard?: TierBoardCardRecord;
  tierBoardAsset?: TierBoardAssetRecord;
  timelineEntry?: TimelineEntryRecord;
  work?: WorkRecord;
  workContributor?: WorkContributorRecord;
  workRelation?: WorkRelationRecord;
  workSeriesLink?: WorkSeriesLinkRecord;
}

export interface PullSyncResponse {
  changes: PullSyncChange[];
  hasMore?: boolean;
  nextCursor?: string | null;
  nextSince: ISODateString;
  pulledAt: ISODateString;
  schemaVersion: SyncSchemaVersion;
}

export interface SyncConflictSnapshot<TPayload = SyncQueuePayload> {
  code?: SyncResultCode;
  detectedAt: ISODateString;
  message: string;
  remote: TPayload | null;
}

export interface SyncQueueItemRecord<TPayload = SyncQueuePayload> {
  id: EntityId;
  clientMutationId?: EntityId;
  entityType: SyncEntityType;
  entityId: EntityId;
  operation: SyncOperation;
  payload: TPayload;
  source?: SyncQueueSource;
  createdAt: ISODateString;
  retryCount: number;
  lastError: string | null;
  conflict?: SyncConflictSnapshot<TPayload> | null;
}

export interface AppMetaRecord {
  key: string;
  value: string;
}
