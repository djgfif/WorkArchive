# Observability

Gate 1 adds a Prometheus-compatible `/metrics` endpoint. It is disabled by
default with `METRICS_ENABLED=false`.

## Metrics Endpoint

Production rule:

- keep `METRICS_ENABLED=false` unless the endpoint is reachable only from an
  internal network, reverse-proxy allowlist, or trusted monitoring collector;
- never expose `/metrics` publicly without access control;
- do not put user IDs, emails, tokens, request bodies, raw entity IDs, or raw
  path IDs in metric labels.

Enable for an internal deployment:

```bash
METRICS_ENABLED=true
```

The endpoint is outside the API prefix:

```bash
curl -fsS http://localhost:18731/metrics
```

## Metrics

- `work_archive_api_request_total`
- `work_archive_api_request_duration_seconds`
- `work_archive_auth_refresh_total`
- `work_archive_sync_total`
- `work_archive_sync_conflict_total`
- `work_archive_sync_failed_validation_total`
- `work_archive_imports_provider_failure_total`
- `work_archive_imports_provider_circuit_open_total`
- `work_archive_readyz_failure_total`

Labels are bounded to low-cardinality values such as method, normalized route,
status class, sync direction, entity type, result, code, provider, and reason.

## Alert Rule Drafts

- readyz failure: `increase(work_archive_readyz_failure_total[5m]) > 0`
- auth refresh failure spike:
  `sum(increase(work_archive_auth_refresh_total{result="failure"}[10m])) > 20`
- sync conflict spike:
  `sum(increase(work_archive_sync_conflict_total[15m])) > 50`
- provider failure spike:
  `sum by (provider) (increase(work_archive_imports_provider_failure_total[15m])) > 20`
- 5xx spike:
  `sum(increase(work_archive_api_request_total{status_class="5xx"}[5m])) > 5`
- high request latency:
  `histogram_quantile(0.95, sum by (le) (rate(work_archive_api_request_duration_seconds_bucket[5m]))) > 1`

Tune thresholds after beta traffic establishes a baseline.
