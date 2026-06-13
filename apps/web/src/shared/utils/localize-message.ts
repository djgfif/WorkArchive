import type {
  SyncQueueSource,
  SyncResultCode,
} from '@work-archive/shared-types';

import { appI18n } from '@app/i18n';

export function localizeSyncResultCode(
  code: SyncResultCode | null | undefined,
  fallback: string = appI18n.t('serverMessage.fallback'),
) {
  switch (code) {
    case 'already_applied':
      return appI18n.t('serverMessage.alreadyApplied');
    case 'applied_change':
      return appI18n.t('serverMessage.appliedChange');
    case 'applied_tombstone':
      return appI18n.t('serverMessage.appliedTombstone');
    case 'created':
      return appI18n.t('serverMessage.created');
    case 'missing_remote_delete_noop':
      return appI18n.t('serverMessage.missingRemoteDeleteNoop');
    case 'conflict_remote_newer':
      return appI18n.t('serverMessage.conflictRemote');
    case 'conflict_remote_missing':
      return appI18n.t('serverMessage.conflictRemote');
    case 'conflict_ownership_mismatch':
      return appI18n.t('serverMessage.conflictOwnership');
    case 'conflict_parent_changed':
      return appI18n.t('serverMessage.conflictParent');
    case 'failed_validation':
      return appI18n.t('serverMessage.validationFailed');
    case 'failed_missing_catalog_title':
      return appI18n.t('serverMessage.missingCatalogTitle');
    case 'failed_import_draft_unresolved':
      return appI18n.t('serverMessage.importDraftUnresolved');
    case 'pull_conflict_local_queue':
      return appI18n.t('serverMessage.pullConflict');
    case 'result_missing':
      return appI18n.t('serverMessage.resultMissing');
    case 'unknown':
      return fallback;
    default:
      return fallback;
  }
}

export function localizeSyncQueueSource(source: SyncQueueSource | undefined) {
  switch (source ?? 'unknown') {
    case 'quick_add':
      return 'Quick Add';
    case 'manual_create':
      return appI18n.t('serverMessage.manualCreate');
    case 'edit_form':
      return appI18n.t('serverMessage.editForm');
    case 'restore':
      return appI18n.t('serverMessage.restore');
    case 'progress_update':
      return appI18n.t('serverMessage.progressUpdate');
    case 'timeline_entry_update':
      return appI18n.t('serverMessage.timelineEntryUpdate');
    case 'release_record_update':
      return appI18n.t('serverMessage.releaseRecordUpdate');
    case 'archive_migration':
      return appI18n.t('serverMessage.archiveMigration');
    case 'unknown':
    default:
      return appI18n.t('serverMessage.unknownSource');
  }
}

function getGenericRequestErrorMessage(status: number): string {
  if (status === 400) {
    return appI18n.t('serverMessage.generic400');
  }

  if (status === 401) {
    return appI18n.t('serverMessage.generic401');
  }

  if (status === 404) {
    return appI18n.t('serverMessage.generic404');
  }

  if (status === 409) {
    return appI18n.t('serverMessage.generic409');
  }

  if (status >= 500) {
    return appI18n.t('serverMessage.generic500');
  }

  return appI18n.t('serverMessage.genericRequestFailed');
}

export function localizeServerMessage(
  message: string,
  fallback: string = appI18n.t('serverMessage.fallback'),
) {
  const normalized = message.trim();

  if (!normalized) {
    return fallback;
  }

  if (!/[A-Za-z]/.test(normalized)) {
    return normalized;
  }

  const conflictMatch = normalized.match(
    /^Conflict: server version (\d+) updated at (.+) won\.$/,
  );

  if (conflictMatch) {
    return appI18n.t('serverMessage.conflictGeneric');
  }

  if (/^Work with id ".+" was not found\.$/.test(normalized)) {
    return appI18n.t('serverMessage.workMissing');
  }

  if (/must be an email/i.test(normalized)) {
    return appI18n.t('serverMessage.emailInvalid');
  }

  if (/must be longer than or equal to 8 characters/i.test(normalized)) {
    return appI18n.t('serverMessage.passwordTooShort');
  }

  if (/title must not be empty/i.test(normalized)) {
    return appI18n.t('serverMessage.titleRequired');
  }

  if (/rating must be a valid number/i.test(normalized)) {
    return appI18n.t('serverMessage.ratingInvalid');
  }

  switch (normalized) {
    case 'The server returned an empty JSON response.':
      return appI18n.t('api.emptyJson');
    case 'Missing Bearer access token.':
    case 'Malformed Bearer access token.':
    case 'Invalid or expired token.':
    case 'Invalid or expired refresh token.':
    case 'Session is no longer valid.':
      return appI18n.t('serverMessage.loginExpired');
    case 'An account with this email already exists.':
      return appI18n.t('serverMessage.accountExists');
    case 'Invalid email or password.':
      return appI18n.t('serverMessage.invalidCredentials');
    case 'Queued record created on the server.':
      return appI18n.t('serverMessage.created');
    case 'Queued change applied on the server.':
      return appI18n.t('serverMessage.appliedChange');
    case 'Queued tombstone applied on the server.':
      return appI18n.t('serverMessage.appliedTombstone');
    case 'Remote record already matches the queued change.':
      return appI18n.t('serverMessage.alreadyApplied');
    case 'Remote delete was a no-op because the server record is missing.':
      return appI18n.t('serverMessage.missingRemoteWorkDeleteNoop');
    case 'Server mismatch: the record cannot be modified remotely.':
      return appI18n.t('serverMessage.serverMismatch');
    case 'Server mismatch: the record does not exist remotely anymore.':
      return appI18n.t('serverMessage.conflictRemote');
    case 'Server mismatch: the record was already missing remotely when a previously synced delete was pushed.':
      return appI18n.t('serverMessage.conflictRemote');
    case 'Sync server is unavailable.':
      return appI18n.t('serverMessage.syncServerUnavailable');
    default:
      return fallback;
  }
}

export function localizeApiErrorMessage(
  status: number,
  message?: string | null,
) {
  if (message) {
    return localizeServerMessage(
      message,
      getGenericRequestErrorMessage(status),
    );
  }

  return getGenericRequestErrorMessage(status);
}
