# Data Retention And Privacy

## Server Retention

`retention-cleanup` is explicit and dry-run by default.

- `SecurityEvent`: default retention is 180 days.
- `UserRefreshSession`: revoked and expired sessions default to 30 days.
- `PasswordResetToken`: used and expired tokens default to 7 days.

Production deletion requires:

```bash
RETENTION_CLEANUP_DRY_RUN=false
RETENTION_CLEANUP_CONFIRM=delete-expired-operational-data
```

## Sensitive Data

- Provider API keys are stored through the credential service and encrypted with
  `EXTERNAL_API_KEY_ENCRYPTION_SECRET`.
- `SecurityEvent` stores hashed IP and user-agent values.
- `UserRefreshSession` currently stores raw `ipAddress` and `userAgent` for
  session management display and audit context. Minimizing or hashing these is a
  remaining commercial-launch privacy improvement.
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
- Minimize raw refresh-session client metadata.
- Define backup encryption, storage location, access review, and deletion
  procedure in the hosting environment.
