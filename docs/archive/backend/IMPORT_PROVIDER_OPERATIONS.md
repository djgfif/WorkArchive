# Import Provider Operations

## Current Provider Controls

- Default provider timeout is 5 seconds.
- Provider calls use `AbortController`.
- HTTP 429 can retry once when the provider-specific `Retry-After` value is
  inside the allowed retry window.
- Repeated provider failures open a provider circuit after 3 consecutive
  failures for 60 seconds.
- Circuit state and provider cache use Redis when `REDIS_URL` is configured;
  non-production environments fall back to process memory when Redis is absent.
- KOBIS uses an HTTP upstream endpoint and sends the user-scoped key as a query
  parameter because the provider API requires it.

## Operational Risk

Memory fallback circuits do not coordinate across multiple API instances. Keep
production on Redis-backed provider runtime state so rolling restarts and
parallel instances share cooldowns.

KOBIS should remain disabled for guest access and only be used where outbound
traffic is within an acceptable network boundary. Prefer an egress proxy or
provider wrapper before broad public beta use.

## Metrics

Gate 1 records provider failures and circuit openings:

- `work_archive_imports_provider_failure_total`
- `work_archive_imports_provider_circuit_open_total`

Labels are `provider` and bounded reason code only.

## Backlog

- Add an operator command to clear one provider circuit.
- Add per-provider latency histograms after traffic patterns are known.
- Document provider-specific quota and cost limits before commercial launch.
