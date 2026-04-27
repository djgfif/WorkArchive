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
  credentialMode?: 'none' | 'server' | 'user';
  label?: string;
  mediumTypes?: WorkType[];
  provider: string;
}

export type ImportSearchDiagnosticStatus = 'searched' | 'skipped' | 'failed';

export interface ImportSearchProviderDiagnostic {
  configured: boolean;
  credentialMode: 'none' | 'server' | 'user';
  message: string;
  provider: string;
  reasonCode:
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

export interface ApiErrorResponse {
  message?: string | string[];
}

export interface AuthUserResponse {
  email: string;
  id: EntityId;
  nickname: string;
  role?: UserRole;
}

export interface AuthCredentialsRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthSessionResponse {
  accessToken: string;
  user: AuthUserResponse;
}

export interface PasswordResetRequestResponse {
  developmentResetUrl?: string;
  message: string;
}

export interface PasswordResetConfirmResponse {
  message: string;
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
    lastConsumedLabel?: string | null;
    progressCurrent?: number | null;
    progressTotal?: number | null;
    progressUnit?: ProgressUnit | null;
    rating: number | null;
    review: string;
    serverVersion: number;
    shortReview: string;
    status: WorkStatus;
    syncStatus: WorkSyncStatus;
    tier: WorkTier | null;
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
export type PullSyncOperation = 'upsert' | 'delete';

export type SyncQueuePayload = WorkRecord | UserReleaseRecord;

export interface PushSyncChangeRequest<TPayload = SyncQueuePayload> {
  createdAt: ISODateString;
  entityId: EntityId;
  entityType: SyncEntityType;
  operation: SyncOperation;
  payload: TPayload;
  queueId: EntityId;
}

export interface PushSyncRequest {
  changes: PushSyncChangeRequest[];
}

export interface PushSyncResult {
  entityId: EntityId;
  entityType: SyncEntityType;
  message: string;
  queueId: EntityId;
  releaseRecord?: UserReleaseRecord | null;
  status: PushResultStatus;
  work?: WorkRecord | null;
}

export interface PushSyncResponse {
  processedAt: ISODateString;
  results: PushSyncResult[];
}

export interface PullSyncRequest {
  since?: ISODateString | null;
}

export interface PullSyncChange {
  entityId: EntityId;
  entityType: SyncEntityType;
  operation: PullSyncOperation;
  releaseRecord?: UserReleaseRecord;
  work?: WorkRecord;
}

export interface PullSyncResponse {
  changes: PullSyncChange[];
  nextSince: ISODateString;
  pulledAt: ISODateString;
}

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
