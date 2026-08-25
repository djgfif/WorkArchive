# User Data Rights Policy

Status: Gate 1 policy baseline.

Work Archive is local-first. The browser IndexedDB archive remains the primary
user-controlled export surface for reading records, but the backend also stores
account, sync, credential metadata, and operational records for signed-in users.

## Server-Side User Data Export

Authenticated users can request a server-side account export from:

```text
GET /api/auth/data-export
```

The endpoint is guarded by the access token, scoped to the current `userId`, and
rate limited by both the global `/api` bucket and the sensitive auth operation
bucket (`auth_sensitive`) configured by `AUTH_SENSITIVE_RATE_LIMIT_MAX`. Each
successful request records a `SecurityAudit` event:

```text
auth.user_data.export
```

The export includes server-owned user data such as:

- profile and non-secret OAuth account metadata;
- refresh-session metadata after privacy reduction;
- sync applied mutation receipt metadata without the result JSON body;
- user work, release, timeline, graph, series, contributor, and tier-board
  records;
- Notion mapping rows and preview snapshot metadata without preview change
  payloads;
- catalog submission metadata without submission payloads or notes;
- community posts authored by the user, reactions made by the user, and reports
  submitted by the user without moderator assignment or moderator notes;
- security event summaries tied to the user.

The export intentionally omits:

- refresh token hashes and previous refresh token hashes;
- external provider encrypted keys;
- external provider encryption IV/auth tags;
- security event IP and user-agent hashes;
- security event metadata;
- OAuth provider account ids.
- sync mutation result payloads;
- Notion preview change payloads;
- catalog submission payloads and notes.

The server-side export is not a replacement for the local archive JSON export.
It exists to make backend-held account data portable and reviewable without
leaking provider credentials, token material, or operational security hashes.
When metrics are enabled, export success and failure are counted in
`work_archive_user_data_rights_total` with only `operation="export"` and
`result` labels.

## Account Deletion

Account deletion is available for authenticated server-side accounts.

Users can preview server-side deletion impact without row contents from:

```text
GET /api/auth/account/deletion-preview
```

The preview returns `cascadeDeletedRecords`, `anonymizedRecords`, and
`omittedSensitiveFields`. It intentionally uses count queries and does not
return provider keys, token hashes, security hashes, security metadata, or row
payload contents.

Authenticated users can delete their server-side account from:

```text
DELETE /api/auth/account
```

Both account deletion endpoints are guarded by the access token, scoped to the
current `userId`, and rate limited by both the global `/api` bucket and the
sensitive auth operation bucket (`auth_sensitive`) configured by
`AUTH_SENSITIVE_RATE_LIMIT_MAX`. The deletion request must include the current
account email and an explicit irreversible acknowledgement:

```json
{
  "confirmEmail": "user@example.com",
  "acknowledgeIrreversible": true
}
```

Each successful request records a `SecurityAudit` event before deletion:

```text
auth.account.delete
```

Rejected deletion confirmations record a separate warning event without logging
the submitted email or request body:

```text
auth.account.delete_failed
```

The failure metadata stores a bounded reason such as `http_400`, not user input.

Deletion removes the `users` row and relies on reviewed Prisma cascade behavior
for account-owned records:

- OAuth accounts, refresh sessions, external provider credentials, sync applied
  mutations, work records, timeline entries, Notion mappings and preview
  snapshots, user series, user contributors, user work relations, tier boards,
  and catalog submissions made by the user are deleted by cascade.
- Community posts authored by the user, reactions made by the user, and reports
  submitted by the user are deleted by cascade.
- Community reports assigned to the deleted moderator keep the report but set
  `moderatorId` to `null`.
- Community moderation audit logs keep the action record but set `actorId` to
  `null`.
- Catalog submissions reviewed by the deleted user keep their moderation record
  but set `reviewerId` to `null`.
- Catalog audit logs keep the moderation audit record but set `actorId` to
  `null`.
- Security events tied to the deleted user keep operational event evidence but
  set `userId` and `sessionId` to `null`.

The response returns only deletion metadata and anonymized retained-record
counts. Refresh cookies are cleared, and existing access tokens stop validating
after the underlying refresh session is removed.
When metrics are enabled, deletion preview and deletion outcomes are counted in
`work_archive_user_data_rights_total` with only bounded `operation` values
(`deletion_preview` or `delete`) and `result` labels. Do not add user IDs,
email addresses, confirmation values, request bodies, or raw row identifiers to
metrics, alerts, dashboards, or operator evidence.
Rejected confirmation checks are counted by `AuthController` before the delete
service runs; service execution failures are counted by `AuthService` so a
single failed deletion attempt is not double-counted.

## Smoke Evidence

Repository and release operators can run a non-destructive user data rights
smoke:

```bash
npm run qa:user-data-rights-smoke
```

Default dry-run mode writes a report to `tmp/user-data-rights-smoke/` and
verifies the smoke contract without calling a host. Live mode requires a
disposable authenticated account token:

```bash
USER_DATA_RIGHTS_SMOKE_LIVE=true \
USER_DATA_RIGHTS_SMOKE_BASE_URL=https://beta.example.com \
USER_DATA_RIGHTS_SMOKE_ACCESS_TOKEN=<disposable-test-account-token> \
npm run qa:user-data-rights-smoke
```

Live mode calls only `GET /api/auth/data-export` and
`GET /api/auth/account/deletion-preview`, then verifies JSON shape,
`Cache-Control: no-store`, absence of known secret field names, and absence of
row payload contents in the deletion preview. The smoke intentionally never
calls `DELETE /api/auth/account`; destructive account deletion evidence must
use the separate disposable-account rehearsal:

```bash
npm run qa:account-deletion-rehearsal
```

Default dry-run mode writes a report to `tmp/account-deletion-rehearsal/`
without calling a host. Live mode is destructive and requires all safeguards:

```bash
ACCOUNT_DELETION_REHEARSAL_LIVE=true \
ACCOUNT_DELETION_REHEARSAL_BASE_URL=https://beta.example.com \
ACCOUNT_DELETION_REHEARSAL_ACCESS_TOKEN=<disposable-test-account-token> \
ACCOUNT_DELETION_REHEARSAL_CONFIRM_EMAIL=<disposable-account-email> \
ACCOUNT_DELETION_REHEARSAL_DISPOSABLE_ACCOUNT_ACK=true \
ACCOUNT_DELETION_REHEARSAL_CONFIRM=delete-disposable-account \
npm run qa:account-deletion-rehearsal
```

The live rehearsal previews deletion impact first, sends the deletion request
with the production client header and allowed Origin, then verifies the same
token can no longer export account data. Copy only the redacted report summary
into release evidence.

Remaining commercial-launch follow-up evidence:

- prove a backup and restore drill for a deletion rehearsal target;
- record the deletion rehearsal in the public beta/commercial evidence ledger.

Do not use database dumps, backup files, or operator diagnostics as user export
artifacts.
