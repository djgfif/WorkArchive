# Contract Testing Plan

Contract tests protect the local-first sync boundary and import/export portability. They should run in CI before release and whenever payload schemas change.

## Sync Push/Pull Payload

- Validate current push request schema, including `schemaVersion`, operations, entity IDs, and `clientMutationId`.
- Verify duplicate `clientMutationId` delivery is idempotent.
- Verify pull response shape for empty, changed, conflicted, and deleted records.
- Verify unsupported `schemaVersion` fails with a stable error code.
- Keep fixtures for at least one previous compatible sync version.

## Auth Session Response

- Validate guest session response.
- Validate Google-authenticated session response.
- Confirm no OAuth token, refresh token, cookie value, or provider API key appears in the response.
- Confirm legacy email/password state is not exposed as an available auth method.

## Imports Provider Diagnostics

- Validate provider readiness list.
- Validate circuit breaker `closed` and `open` states.
- Confirm reason codes are stable for missing key, provider failure, guest provider not allowed, and circuit open.
- Confirm diagnostics never include raw API keys or provider secret fields.

## Tier Board JSON Export/Import

- Validate exported board metadata, lanes, cards, assets, and snapshot card fields.
- Validate import rejects unknown schema versions and malformed card/asset payloads.
- Verify imported snapshot cards do not require or restore source work records.
- Verify export excludes source `WorkRecord` private data and source work identifiers.
- Verify export excludes API keys, cookies, OAuth tokens, and unrelated local archive data.

## Local Archive JSON Export/Import

- Validate works, release records, timeline entries, local settings, and sync-safe identifiers.
- Verify import preview reports counts and validation failures before applying.
- Verify malformed JSON and unsupported schema versions fail without partial writes.
- Verify export excludes API keys, cookies, OAuth tokens, and refresh tokens.
