# Data Retention And Privacy

## Server Retention

`retention-cleanup` is explicit and dry-run by default.

- `SecurityEvent` (`security_events`): default retention is 180 days.
- `UserRefreshSession` (`user_refresh_sessions`): revoked and expired sessions
  default to 30 days.
- `UserSyncAppliedMutation` (`user_sync_applied_mutations`): applied replay rows expire after 180 days;
  conflict and validation replay rows expire after 24 hours. Cleanup removes
  rows after their `expiresAt` timestamp.
- `NotionPullPreviewSnapshot` (`notion_pull_preview_snapshots`): preview
  snapshots expire after 15 minutes. Cleanup removes rows after their
  `expiresAt` timestamp.

Production deletion requires:

```bash
RETENTION_CLEANUP_DRY_RUN=false
RETENTION_CLEANUP_CONFIRM=delete-expired-operational-data
```

`RETENTION_CLEANUP_DRY_RUN` accepts only explicit boolean values (`true` or
`false`). Aliases such as `1`, `0`, `yes`, `no`, `on`, or `off` fail before
cleanup targets are counted or deleted.

## Sensitive Data

- Provider API keys are stored through the credential service and encrypted with
  `EXTERNAL_API_KEY_ENCRYPTION_SECRET`.
- `SecurityEvent` stores hashed IP and user-agent values. Metadata is restricted
  to primitive values, drops sensitive keys, strips URL query/fragment values,
  redacts inline bearer/basic credentials, removes control characters, and caps
  stored string length.
- `UserRefreshSession` stores masked IP addresses and coarse device/browser
  summaries for session management display. Raw request IP and User-Agent values
  are not returned by the session management API.
- PostgreSQL backups include private user records, account identifiers, refresh
  session metadata, encrypted provider credentials, security events, sync
  mutation results, short-lived Notion preview snapshots, and catalog data.

## Historical Client Metadata Policy

`UserRefreshSession.ipAddress` and `UserRefreshSession.userAgent` keep legacy
column names for migration stability, but current writes store masked IP
addresses and coarse browser/device summaries. The session management API
returns only these privacy-reduced values.

The migration `20260606120000_drop_legacy_password_auth` removed the legacy
`password_reset_tokens` table, so retention cleanup no longer targets password
reset rows. If a hosted environment ever accepted raw client IP or raw
User-Agent values before the masking helpers were deployed, the beta release
owner must choose one of these documented mitigations before commercial launch:

- prove no such production data exists for that environment;
- delete or revoke old refresh sessions with `retention-cleanup` after a dry-run
  count review;
- run a reviewed one-off sanitization migration that rewrites those columns to
  masked IP and coarse user-agent summary values.

Do not backfill raw IP or raw User-Agent values into any new column. A future
schema rename may make the privacy-reduced meaning explicit, but it must not
increase retained client metadata.

## Backup Sensitivity Policy

PostgreSQL backups are sensitive infrastructure artifacts:

- encrypt or otherwise protect backups at the selected storage layer;
- keep backup access limited to operators who can perform restore or incident
  response;
- record backup creation, verification, off-host copy, restore drill, and
  deletion evidence without committing dump contents;
- delete expired backups according to the hosting provider retention policy or a
  documented operator procedure.

## IndexedDB Export vs PostgreSQL Backup

- IndexedDB JSON export is user-controlled archive portability and local
  recovery. It must not contain cookies, OAuth tokens, provider API keys, or
  server operational state.
- `GET /api/auth/data-export` is authenticated server-side account data
  portability. It returns account, sync, and user-owned backend records while
  omitting refresh token hashes, external provider encrypted keys, provider
  encryption IV/auth tags, security event hashes, security event metadata, and
  OAuth provider account ids. See
  [`USER_DATA_RIGHTS_POLICY.md`](./USER_DATA_RIGHTS_POLICY.md).
- `GET /api/auth/account/deletion-preview` returns count-only
  `cascadeDeletedRecords`, `anonymizedRecords`, and `omittedSensitiveFields`
  before irreversible deletion.
- `DELETE /api/auth/account` removes the authenticated server-side account after
  explicit email confirmation and irreversible acknowledgement. Account-owned
  rows are deleted by Prisma cascade; retained operational records detach
  `userId`, `sessionId`, reviewer, or actor references as documented in
  [`USER_DATA_RIGHTS_POLICY.md`](./USER_DATA_RIGHTS_POLICY.md). Successful
  deletion attempts record `auth.account.delete` before the retained security
  event reference is anonymized; rejected confirmations record
  `auth.account.delete_failed` with a bounded reason such as `http_400` and no
  submitted email or request body.
- PostgreSQL backup is operator recovery for the whole deployment. It is
  sensitive infrastructure data and should not be shared as a user export.

## Remaining Improvements

- Add hosted account-deletion rehearsal and restore evidence before commercial
  launch approval.
- Optionally rename legacy `user_refresh_sessions.ip_address` and `user_agent`
  columns to explicit masked/summary names after a migration rehearsal.
- Attach hosted backup encryption, storage location, access review, deletion,
  and retention cleanup evidence to the release ledger.
