# Quick Add Source Coverage Candidate UI

- Stitch project: `projects/13367329108525978615`
- Stitch screen: `projects/13367329108525978615/screens/c4089f1eb0944b9a981681288382d653`
- Date: 2026-04-26

## Purpose

Make merged import candidates visibly trustworthy without changing the import DTO or local-first save contract.

## UI Decisions

- Candidate rows show source coverage as text badges, not color-only status.
- Provider chips are derived from `sourceLabel`, `externalRefs.provider`, and `releaseCandidates[].externalRefs.provider`.
- Selected preview adds a `검색 근거` block with confidence, reason, catalog match state, provider list, external identifier count, and release candidate count.
- The existing provider source URL link remains in the supporting information block.

## Implementation Notes

- No shared type change.
- No backend ranking or merge change.
- `catalogTitleId` and `importDraft` save behavior remains unchanged.
