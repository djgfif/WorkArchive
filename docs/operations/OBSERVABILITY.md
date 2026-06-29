# Observability

Gate 1 adds a Prometheus-compatible `/metrics` endpoint. It is disabled by
default with `METRICS_ENABLED=false`.

## Metrics Endpoint

Production rule:

- keep `METRICS_ENABLED=false` unless the endpoint is reachable only from an
  internal network, reverse-proxy allowlist, or trusted monitoring collector;
- set `METRICS_BEARER_TOKEN` to a unique 32+ character collector token before
  enabling metrics in production; the collector request must send exactly one
  `Authorization: Bearer <token>` value with no extra segments;
- never expose `/metrics` publicly; unauthenticated requests should return 404
  even when metrics are enabled;
- do not put user IDs, emails, tokens, request bodies, raw entity IDs, or raw
  path IDs in metric labels.

Enable for an internal deployment:

```bash
METRICS_ENABLED=true
METRICS_INTERNAL_ACCESS_REVIEWED=true
METRICS_BEARER_TOKEN=<unique-collector-token>
```

The endpoint is outside the API prefix:

```bash
curl -fsS -H "Authorization: Bearer $METRICS_BEARER_TOKEN" \
  http://localhost:18731/metrics
```

## Metrics

- `work_archive_api_request_total`
- `work_archive_api_request_duration_seconds`
- `work_archive_auth_refresh_total`
- `work_archive_user_data_rights_total`
- `work_archive_client_header_guard_total`
- `work_archive_sync_total`
- `work_archive_sync_duration_seconds`
- `work_archive_sync_conflict_total`
- `work_archive_sync_failed_validation_total`
- `work_archive_imports_provider_failure_total`
- `work_archive_imports_provider_circuit_open_total`
- `work_archive_imports_provider_duration_seconds`
- `work_archive_imports_search_total`
- `work_archive_imports_search_duration_seconds`
- `work_archive_readyz_failure_total`

Labels are bounded to low-cardinality values such as method, normalized route,
status class, sync direction, entity type, result, code, provider, and reason.
Matched request routes use route templates such as `/api/works/:id`; unmatched
404s are bucketed under `not_found` instead of recording raw user-supplied
paths.
Sync duration histograms use only `direction` and `result` labels, allowing
operators to compare push and pull latency without recording user IDs, raw
entity IDs, payload contents, or archive-specific dimensions.
Provider latency histograms use bounded `provider` and `result` labels so
operators can identify slow upstream providers without recording user-specific
queries or identifiers.
The client header guard counter uses only `mode`, `method`, and `result`
labels, allowing operators to compare accepted and missing authenticated unsafe
requests before promoting `WORK_ARCHIVE_CLIENT_HEADER_GUARD` from audit to
enforce.
User data rights operations use only bounded `operation` and `result` labels
for server-side export, deletion preview, and deletion outcomes; never add
user IDs, email addresses, request bodies, or deletion confirmation values to
metric labels.

## SLO Rules

Gate 1 SLO recording and burn-alert rules live at
`docs/operations/monitoring/work-archive-slo-rules.yml`.

Validate the repository copy before a release:

```bash
npm run qa:slo
```

The local validator checks the expected recording rules, 30 day target labels,
SLO burn alerts, required metric coverage, zero-traffic guards, low-cardinality
labels, and safe histogram aggregation.

Draft Gate 1 SLO targets:

- API availability: 99.5% over 30 days, measured from non-5xx API requests;
- API p95 latency: 1 second over the 30 day SLO window;
- auth refresh success: 99% over 30 days;
- sync success: 99% over 30 days;
- import search success: 95% over 30 days.

These targets are release gates only after the SLO rules are deployed to the
beta monitoring stack and the observation window contains real beta traffic.
Record the deployed SLO rule version, observed ratios, alert state, and any
approved target waivers in `docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md`.

## Alert Rules

Prometheus-compatible Gate 1 alert rules live at
`docs/operations/monitoring/work-archive-alerts.yml`.
They include readiness, API 5xx/latency, auth refresh failure, rate-limit
rejection, user data rights failure, client header guard, sync, and
import-provider alerts. Rate-limit alerts use the bounded `limiter` label from
`work_archive_rate_limit_exceeded_total`; do not add IP, path, token, or user
labels.

Validate the repository copy before a release:

```bash
npm run qa:alerts
```

The local validator checks that the rule file contains the expected Work Archive
metrics, static low-cardinality labels, summaries, descriptions, and safe
histogram aggregation. If the deployment has `promtool`, also run:

```bash
promtool check rules docs/operations/monitoring/work-archive-alerts.yml
```

Current alert coverage:

- `/readyz` dependency failure;
- API 5xx spike;
- API p95 latency above the Gate 1 draft threshold;
- auth refresh failure spike;
- user data rights failure spike by bounded operation label;
- rate-limit rejection spike by bounded limiter label;
- client header guard missing spike;
- sync conflict spike;
- sync payload validation failure spike;
- sync p95 latency above the Gate 1 draft threshold;
- import provider failure spike;
- import provider circuit open.

Tune thresholds after beta traffic establishes a baseline. Record the deployed
Prometheus/Alertmanager rule version, notification channel, and any threshold
waivers in `docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md`.

## Grafana Dashboard

The repository dashboard artifact lives at
`docs/operations/monitoring/work-archive-grafana-dashboard.json`. It is a
provisionable Grafana dashboard for the Work Archive API Prometheus metrics and
keeps queries limited to low-cardinality service labels.

Validate the repository copy before a release:

```bash
npm run qa:dashboards
```

The local validator checks the expected panels, datasource variable, metric
coverage, histogram aggregation, and absence of sensitive or high-cardinality
labels such as user IDs, emails, tokens, request IDs, raw paths, URLs, or route
labels in dashboard PromQL.

Current dashboard coverage:

- readiness failures;
- API 5xx rate;
- API request rate by status class;
- API p50/p95 latency;
- auth refresh outcomes;
- user data rights outcomes by bounded operation/result labels;
- sync push/pull outcomes;
- sync p95 latency;
- sync conflicts and validation failures by bounded entity/code labels;
- import provider failures, circuit opens, provider p95 latency, and search
  outcomes.

Import the JSON into the beta Grafana stack only after `/metrics` is reachable
from the reviewed internal collector path. Record the dashboard UID, deployed
version, Grafana folder, and any query or threshold waivers in
`docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md`.

## Monitoring Evidence Collection

After alert rules, SLO rules, and the dashboard are deployed, collect redacted
deployment evidence with:

```bash
MONITORING_PROMETHEUS_URL=https://prometheus.example.com \
MONITORING_GRAFANA_URL=https://grafana.example.com \
MONITORING_PUBLIC_BASE_URL=https://beta.example.com \
MONITORING_INTERNAL_METRICS_URL=https://internal.example.com/metrics \
npm run qa:monitoring
```

Use `MONITORING_PROMETHEUS_BEARER_TOKEN`,
`MONITORING_GRAFANA_BEARER_TOKEN`, and
`MONITORING_INTERNAL_METRICS_BEARER_TOKEN` only from the operator environment;
do not commit them. Reports are written to `tmp/monitoring-evidence/` and are
redacted before writing. Copy only the summary rows into
`docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md`.

For local script-shape validation without live network calls:

```bash
MONITORING_EVIDENCE_DRY_RUN=true npm run qa:monitoring
```

Dry-run output proves only report generation. It does not prove Prometheus
rules, SLO records, alert routing, dashboard import, or `/metrics` exposure
controls in a live environment.
