# Documentation Index

This index mirrors [`../README.md`](../README.md) and is the canonical place for
documentation navigation and maintenance rules.

## Current Docs

| Area                                      | Primary document                                                                                  | Use it when                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [`getting-started/`](../getting-started/) | [`LOCAL_DEVELOPMENT.md`](../getting-started/LOCAL_DEVELOPMENT.md)                                 | setting up the project locally                       |
| [`architecture/`](../architecture/)       | [`FEATURE_FIRST_STRUCTURE.md`](../architecture/FEATURE_FIRST_STRUCTURE.md)                        | checking web/API/package boundaries                  |
| [`commercial/`](../commercial/)           | [`COMMERCIAL_LAUNCH_READINESS.md`](../commercial/COMMERCIAL_LAUNCH_READINESS.md)                  | checking public beta and launch readiness gates      |
| [`operations/`](../operations/)           | [`RUNBOOK.md`](../operations/RUNBOOK.md)                                                          | running, deploying, recovering, or releasing the app |
| [`sync/`](../sync/)                       | [`SYNC_AUTO_MERGE_POLICY.md`](../sync/SYNC_AUTO_MERGE_POLICY.md)                                  | checking sync auto-merge and lease policy            |
| [`security/`](../security/)               | [`PUBLIC_REPOSITORY_READINESS.md`](../security/PUBLIC_REPOSITORY_READINESS.md)                    | preparing for public GitHub visibility               |
| [`security/`](../security/)               | [`GITHUB_SECURITY_SETTINGS_CHECKLIST.md`](../security/GITHUB_SECURITY_SETTINGS_CHECKLIST.md)      | enabling GitHub branch protection, CodeQL, Dependabot, secret scanning |
| [`project/`](../project/README.md)        | [`CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md) | checking current implementation state                |

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
