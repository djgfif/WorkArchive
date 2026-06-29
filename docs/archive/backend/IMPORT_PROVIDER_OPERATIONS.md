# Import Provider Operations

## Current Provider Controls

- Default provider timeout is 5 seconds.
- Provider calls use `AbortController`.
- HTTP 429 can retry once when the provider-specific `Retry-After` value is
  inside the allowed retry window.
- One import search runs at most 3 provider lookups concurrently to cap
  upstream fan-out from a single API request.
- Repeated provider failures open a provider circuit after 3 consecutive
  failures for 60 seconds.
- Circuit state and provider cache use Redis when `REDIS_URL` is configured;
  non-production environments fall back to process memory when Redis is absent.
- Redis-backed failure counts and circuit state are updated through one Lua
  script so concurrent API instances share the same open threshold.
- KOBIS uses an HTTP upstream endpoint and sends the user-scoped key as a query
  parameter because the provider API requires it.

## Operational Risk

Memory fallback circuits do not coordinate across multiple API instances. Keep
production on Redis-backed provider runtime state so rolling restarts and
parallel instances share cooldowns.

If a provider remains open after credentials, upstream status, and parser
behavior are verified, operators can dry-run and then clear one Redis-backed
provider circuit without restarting API instances:

```bash
IMPORT_PROVIDER_CIRCUIT_PROVIDER=wikidata \
  npm run ops:imports:clear-circuit --workspace @work-archive/api

IMPORT_PROVIDER_CIRCUIT_PROVIDER=wikidata \
IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN=false \
IMPORT_PROVIDER_CIRCUIT_CLEAR_CONFIRM=clear-import-provider-circuit \
  npm run ops:imports:clear-circuit --workspace @work-archive/api
```

The real clear requires `REDIS_URL`; a separate operator process cannot clear
process-local memory fallback state inside a running API instance.
`IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN` accepts only explicit boolean values
(`true` or `false`); aliases such as `1`, `0`, `yes`, `no`, `on`, or `off`
fail before any provider circuit state is read or cleared.

KOBIS should remain disabled for guest access and only be used where outbound
traffic is within an acceptable network boundary. Prefer an egress proxy or
provider wrapper before broad public beta use.

Provider cost and quota classes are documented in
[`SEARCH_PROVIDER_COST_POLICY.md`](../../operations/SEARCH_PROVIDER_COST_POLICY.md).
Do not enable guest server-key search or a new cost-bearing provider until the
operator has recorded the provider owner, credential source, rate quota, monthly
quota, paid/free plan, and fallback behavior there or in the Gate 1 evidence
ledger.

## Metrics

Gate 1 records provider failures and circuit openings:

- `work_archive_imports_provider_failure_total`
- `work_archive_imports_provider_circuit_open_total`
- `work_archive_imports_provider_duration_seconds`

Labels are bounded to `provider`, `reason`, and `result` only.
