# Documentation Index

This index mirrors [`../README.md`](../README.md) and is the canonical place for
documentation navigation and maintenance rules.

## Current Docs

| Area                                      | Primary document                                                                                  | Use it when                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`getting-started/`](../getting-started/) | [`LOCAL_DEVELOPMENT.md`](../getting-started/LOCAL_DEVELOPMENT.md)                                 | setting up the project locally                                         |
| [`architecture/`](../architecture/)       | [`FEATURE_FIRST_STRUCTURE.md`](../architecture/FEATURE_FIRST_STRUCTURE.md)                        | checking web/API/package boundaries                                    |
| [`architecture/`](../architecture/)       | [`API_BOUNDARY_GUIDE.md`](../architecture/API_BOUNDARY_GUIDE.md)                                  | deciding where new API behavior belongs                                |
| [`architecture/`](../architecture/)       | [`I18N_LOCALIZATION.md`](../architecture/I18N_LOCALIZATION.md)                                    | checking web i18n string ownership and locale policy                   |
| [`design/`](../design/)                   | [`PRODUCT_EXPERIENCE_DIRECTION.md`](../design/PRODUCT_EXPERIENCE_DIRECTION.md)                    | checking the local-first product and progressive-disclosure direction  |
| [`design/`](../design/)                   | [`STUDIO_PHILOSOPHY.md`](../design/STUDIO_PHILOSOPHY.md)                                          | checking the current visual philosophy                                 |
| [`commercial/`](../commercial/)           | [`COMMERCIAL_LAUNCH_READINESS.md`](../commercial/COMMERCIAL_LAUNCH_READINESS.md)                  | checking public beta and launch readiness gates                        |
| [`operations/`](../operations/)           | [`RUNBOOK.md`](../operations/RUNBOOK.md)                                                          | running, deploying, recovering, or releasing the app                   |
| [`sync/`](../sync/)                       | [`SYNC_AUTO_MERGE_POLICY.md`](../sync/SYNC_AUTO_MERGE_POLICY.md)                                  | checking sync auto-merge and lease policy                              |
| [`security/`](../security/)               | [`PUBLIC_REPOSITORY_READINESS.md`](../security/PUBLIC_REPOSITORY_READINESS.md)                    | preparing for public GitHub visibility                                 |
| [`security/`](../security/)               | [`PUBLIC_FEATURE_PERMISSION_BOUNDARY.md`](../security/PUBLIC_FEATURE_PERMISSION_BOUNDARY.md)      | checking default-private public/share feature rules                    |
| [`security/`](../security/)               | [`API_AUTHORIZATION_SURFACE.md`](../security/API_AUTHORIZATION_SURFACE.md)                        | checking API controller authentication boundaries                      |
| [`security/`](../security/)               | [`API_INPUT_CONTRACTS.md`](../security/API_INPUT_CONTRACTS.md)                                    | checking API DTO input-validation boundaries                           |
| [`security/`](../security/)               | [`API_CACHE_POLICY.md`](../security/API_CACHE_POLICY.md)                                          | checking API cache-control boundaries                                  |
| [`security/`](../security/)               | [`LOG_REDACTION_POLICY.md`](../security/LOG_REDACTION_POLICY.md)                                  | checking log and security-event redaction boundaries                   |
| [`security/`](../security/)               | [`USER_DATA_RIGHTS_POLICY.md`](../security/USER_DATA_RIGHTS_POLICY.md)                            | checking user data export and deletion policy                          |
| [`security/`](../security/)               | [`POSTER_PRIVACY_THREAT_MODEL.md`](../security/POSTER_PRIVACY_THREAT_MODEL.md)                    | checking private-first poster rendering and proxy boundaries           |
| [`security/`](../security/)               | [`GITHUB_SECURITY_SETTINGS_CHECKLIST.md`](../security/GITHUB_SECURITY_SETTINGS_CHECKLIST.md)      | enabling GitHub branch protection, CodeQL, Dependabot, secret scanning |
| [`project/`](../project/README.md)        | [`CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md) | checking current implementation state                                  |
| [`project/`](../project/README.md)        | [`EXECUTION_ROADMAP.md`](../project/EXECUTION_ROADMAP.md)                                         | checking current execution sequencing                                  |
| [`project/`](../project/README.md)        | [`ROADMAP_FEEDBACK_2026-06.md`](../project/ROADMAP_FEEDBACK_2026-06.md)                           | checking structural debt advisory sequencing                           |

## Archived References

Historical plans, completed audits, raw design exports, and superseded product
strategy documents live under [`../archive/`](../archive/README.md). Treat them
as context, not current implementation direction.

## Maintenance Rule

When moving or renaming docs, update:

1. [`../README.md`](../README.md)
2. this file
3. [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)
4. the affected folder README
