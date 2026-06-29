# Work Archive Docs

This is the public documentation hub. Keep this level small: current operating
docs stay here, older plans and raw design material stay in
[`archive/`](./archive/).

## Read First

1. [`../README.md`](../README.md)
2. [`getting-started/LOCAL_DEVELOPMENT.md`](./getting-started/LOCAL_DEVELOPMENT.md)
3. [`security/PUBLIC_REPOSITORY_READINESS.md`](./security/PUBLIC_REPOSITORY_READINESS.md)
4. [`security/PUBLIC_FEATURE_PERMISSION_BOUNDARY.md`](./security/PUBLIC_FEATURE_PERMISSION_BOUNDARY.md)
5. [`security/API_AUTHORIZATION_SURFACE.md`](./security/API_AUTHORIZATION_SURFACE.md)
6. [`security/API_INPUT_CONTRACTS.md`](./security/API_INPUT_CONTRACTS.md)
7. [`security/API_CACHE_POLICY.md`](./security/API_CACHE_POLICY.md)
8. [`security/LOG_REDACTION_POLICY.md`](./security/LOG_REDACTION_POLICY.md)
9. [`security/USER_DATA_RIGHTS_POLICY.md`](./security/USER_DATA_RIGHTS_POLICY.md)
10. [`architecture/FEATURE_FIRST_STRUCTURE.md`](./architecture/FEATURE_FIRST_STRUCTURE.md)
11. [`operations/RUNBOOK.md`](./operations/RUNBOOK.md)

## Current Areas

| Area                                     | Purpose                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| [`getting-started/`](./getting-started/) | local setup and developer onboarding                                           |
| [`architecture/`](./architecture/)       | ADRs and current codebase structure boundaries                                 |
| [`commercial/`](./commercial/)           | public beta and commercial launch readiness gates                              |
| [`operations/`](./operations/)           | runbooks, deployment, release, migration, and backup procedures                |
| [`sync/`](./sync/)                       | sync correctness and local-first merge policies                                |
| [`security/`](./security/)               | public readiness and security checklists                                       |
| [`project/`](./project/README.md)        | current execution status and roadmap                                           |
| [`management/`](./management/)           | documentation governance and status tracking                                   |
| [`archive/`](./archive/README.md)        | historical plans, completed audits, raw design sources, and reference material |

## Documentation Rules

- Put current procedures in the smallest matching active area.
- Move completed plans, old audits, raw design exports, and superseded strategy
  documents to `archive/`.
- Update this file and
  [`management/DOCUMENTATION_INDEX.md`](./management/DOCUMENTATION_INDEX.md)
  whenever top-level docs move.
