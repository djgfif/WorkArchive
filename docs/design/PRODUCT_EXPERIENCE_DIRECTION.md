# Product Experience Direction

| Field         | Value                                                                            |
| ------------- | -------------------------------------------------------------------------------- |
| Status        | Canonical                                                                        |
| Owner         | Web product experience                                                           |
| Last reviewed | 2026-07-22                                                                       |
| Update when   | The core archive loop, privacy posture, or default information hierarchy changes |

This document defines the product experience Work Archive should preserve while
individual screens evolve. Visual implementation follows
[Studio](./STUDIO_PHILOSOPHY.md); this document governs what the interface
prioritizes.

## Product promise

Work Archive is a private, local-first place to capture and revisit a personal
media history. IndexedDB remains the client source of truth. Account sync,
imports, and external providers extend the archive but must not become a
prerequisite for starting or maintaining it.

The product is intentionally not a social feed. Public profiles, follows,
comments, and recommendation-network mechanics are outside the default
experience. Any future sharing feature must remain explicit, scoped, reversible,
and default-private.

## Primary experience

The first-use loop is:

1. Enter a title from Home.
2. Confirm the media type and save locally.
3. Add status, rating, notes, cover, and metadata only when useful.
4. See the saved work immediately and retain a clear path to backup.

Home should feel like an archive desk, not an analytics dashboard. Quick capture
and the user's records lead; aggregate statistics become prominent only after
enough records exist to be meaningful.

## Progressive disclosure

Work Archive serves both first-time and experienced users with the same data
model:

- Keep title, media type, primary action, and data-safety status visible.
- Put optional metadata behind a clear disclosure on full-page creation.
- Keep modal capture dense enough for experienced repeat entry.
- Keep common settings visible; group providers, diagnostics, security, and
  destructive controls under advanced navigation.
- Keep search, sort, and filter visible in large libraries; place display
  density and other presentation controls under view options.
- Never hide data loss, sync conflict, or destructive-action warnings.

Progressive disclosure changes presentation only. It must not remove an
existing capability or alter local-first storage semantics.

## Low-data behavior

- Zero works: teach the three safe starting paths—direct entry, assisted search,
  and backup/import.
- One to three works: show the small archive and the next useful actions without
  empty dashboards.
- Fewer than five works in Insights: show a transparent milestone and recent
  records instead of statistically weak charts.
- Established archives: reveal shelves, trends, filters, and advanced
  organization tools.

## Product review checklist

- Can a guest save a minimal record without network access?
- Does the primary task remain above the first fold at desktop and mobile sizes?
- Are optional or technical controls discoverable without competing with the
  primary action?
- Does every data-changing action communicate where the record is stored?
- Are backup and recovery reachable from Home and Settings?
- Are local-first, private-by-default, Korean-first, and Studio design rules
  preserved?
