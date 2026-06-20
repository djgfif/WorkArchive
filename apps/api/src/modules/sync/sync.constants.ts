export const SYNC_SCHEMA_VERSION = 5 as const;

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

export const SYNC_OPERATIONS = [
  'create',
  'update',
  'delete',
] as const;

export type SyncOperation = (typeof SYNC_OPERATIONS)[number];

export const PUSH_RESULT_STATUSES = [
  'applied',
  'conflict',
  'failed',
] as const;

export type PushResultStatus = (typeof PUSH_RESULT_STATUSES)[number];

export const PULL_SYNC_OPERATIONS = [
  'upsert',
  'delete',
] as const;

export type PullSyncOperation = (typeof PULL_SYNC_OPERATIONS)[number];

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
  'failed_client_mutation_reused',
  'failed_missing_catalog_title',
  'failed_import_draft_unresolved',
  'failed_server_error',
  'pull_conflict_local_queue',
  'result_missing',
  'unknown',
] as const;

export type SyncResultCode = (typeof SYNC_RESULT_CODES)[number];
