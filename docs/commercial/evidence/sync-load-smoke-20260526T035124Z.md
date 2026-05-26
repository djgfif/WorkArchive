# Sync Load Smoke Report

- Timestamp UTC: 2026-05-26T03:51:24.949Z
- Git commit: 3d3c3fcfa9ba44e15e1949e23ee58c2cf72a0163
- Working tree: dirty
- Mode: dry-run
- Status: PASS
- Run ID: 20260526T035124Z-cea9b265
- Synthetic records: 1000
- Batch size: 200
- Pull limit: 500

## Result

- Push batches: 5
- Pull pages: 0
- Observed synthetic records: 0
- Missing synthetic records: 0
- Duplicate synthetic records: 0
- Total duration ms: 0
- Request p50 ms: 0
- Request p95 ms: 0
- Max response bytes: 0
- Conflicts: 0
- Failures: 0

Dry-run generated synthetic payloads only. No API calls were made.

## Safety Notes

- Payload titles are synthetic and prefixed with `Gate1 Sync Load QA`.
- Live mode requires `SYNC_LOAD_ACCESS_TOKEN` and `SYNC_LOAD_DISPOSABLE_ACCOUNT_ACK=true`.
- Reports do not include raw sync payloads or bearer tokens.
- Use a disposable authenticated test account; do not run this against a real user account.
