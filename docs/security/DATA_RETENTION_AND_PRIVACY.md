# Data Retention And Privacy

## Server Retention

`retention-cleanup` is explicit and dry-run by default.

- `SecurityEvent`: default retention is 180 days.
- `UserRefreshSession`: revoked and expired sessions default to 30 days.
- `UserSyncAppliedMutation`: expired sync idempotency rows are removed after
  their `expiresAt` timestamp.

Production deletion requires:

```bash
RETENTION_CLEANUP_DRY_RUN=false
RETENTION_CLEANUP_CONFIRM=delete-expired-operational-data
```

## Sensitive Data

- Provider API keys are stored through the credential service and encrypted with
  `EXTERNAL_API_KEY_ENCRYPTION_SECRET`.
- `SecurityEvent` stores hashed IP and user-agent values.
- `UserRefreshSession` stores masked IP addresses and coarse device/browser
  summaries for session management display. Raw request IP and User-Agent values
  are not returned by the session management API.
- PostgreSQL backups include private user records, account identifiers, refresh
  session metadata, encrypted provider credentials, security events, sync
  mutation results, and catalog data.

## IndexedDB Export vs PostgreSQL Backup

- IndexedDB JSON export is user-controlled archive portability and local
  recovery. It must not contain cookies, OAuth tokens, provider API keys, or
  server operational state.
- PostgreSQL backup is operator recovery for the whole deployment. It is
  sensitive infrastructure data and should not be shared as a user export.

## Remaining Improvements

- Add account deletion and user data export policy before commercial launch.
- Add a migration to rename legacy `user_refresh_sessions.ip_address` and
  `user_agent` columns to explicit masked/summary names.
- Define backup encryption, storage location, access review, and deletion
  procedure in the hosting environment.
