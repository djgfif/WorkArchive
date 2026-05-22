# Insights Implementation Plan

| Field | Value |
| --- | --- |
| Status | `planned` |
| Role | personal-only Insights v1 scope |
| Source of truth | Product direction lock and current local-first archive model |
| Last updated | 2026-05-22 |

## Summary

Insights v1 is a private, local-first statistics view for the user's own archive. It must not introduce recommendations, public statistics, community feeds, social comparison, ranking, or catalog promotion workflows.

## V1 Scope

- Personal record totals: active works, completed works, in-progress works, dropped works, favorites, and average rating.
- Rating distribution: count works by 0.5-point rating buckets and keep unrated works separate.
- Genre and tag aggregation: count local `genres` and personal tags from active works only.
- Monthly record volume: count works recorded, completed, or updated by month using local timestamps.

## Explicitly Deferred

- Recommendations or taste prediction.
- Public aggregate statistics.
- Community, follow, comment, feed, or public profile integration.
- Cross-user comparisons, rankings, leaderboards, or catalog moderation signals.

## Implementation Notes

- Reuse the existing hidden `personal-insights.service` calculations where they match v1 scope.
- Keep all queries local-first against Dexie data unless a later sync-specific plan changes this.
- Drill-down links may point back to filtered Works views, but Insights must not mutate work records.
- Empty states should guide users to add works, ratings, genres, and tags rather than implying missing community data.

## Acceptance Criteria

- The visible page, when implemented, only describes private personal archive statistics.
- No visible navigation or route copy presents Insights as a community or recommendation feature.
- Tests cover empty archive, unrated works, 0.5 rating buckets, genre/tag counts, and monthly boundaries.
