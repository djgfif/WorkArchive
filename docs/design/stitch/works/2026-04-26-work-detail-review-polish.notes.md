# Work Detail Review Polish

- Stitch project: `projects/13367329108525978615`
- Stitch screen: `projects/13367329108525978615/screens/15001466fb744767b0cdae461a213dfe`
- Date: 2026-04-26

## Purpose

Make the detail page read as a private personal record, not a public work profile or catalog page.

## UI Decisions

- The hero keeps poster, title, status, rating, favorite, sync state, and progress summary.
- The main column leads with `내 기록` and separates one-line review from detailed review.
- Empty personal review state gets a direct `감상 기록 추가` CTA.
- Work description, source identity, catalog/release, and related title information remain secondary.

## Implementation Notes

- No data model change.
- No local-first, user-records, release-records, or sync contract change.
- Progress display reads existing `progressCurrent`, `progressTotal`, and `lastConsumedLabel` fields.
