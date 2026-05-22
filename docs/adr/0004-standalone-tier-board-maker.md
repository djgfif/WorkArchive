# ADR 0004: Standalone Tier Board Maker

## Status

Accepted

## Context

Tier boards are an archive companion feature. They can create cards from local
work snapshots, support JSON export/import, and should be usable without
creating a public community surface. The public sharing/feed concept is
intentionally disabled until ownership, moderation, abuse handling, and privacy
controls are mature.

## Decision

Keep Tier Board Maker as a standalone personal tool.

- Tier boards remain enabled by default.
- Cards created from the works list are snapshots. The source work id is
  metadata only, not an automatic link.
- Original work edits or soft deletes must not block tier-board card sync.
- Tier board sync validates board/lane/card ownership, not source work
  liveness.
- JSON export/import remains a board portability path and must not include the
  private source WorkRecord or require that source record to exist.
- Public community/share feed remains behind a disabled feature flag.

## Alternatives

- Public community launch: rejected because moderation and privacy operations are not ready.
- Merge tier boards into works CRUD: rejected because board layout, lanes, cards, and assets have a separate editing model.
- Remove tier boards from the runtime: rejected because existing local tier board workflows are part of the product.

## Consequences

- Release smoke tests must include creating and exporting a tier board.
- Security review must confirm tier-board board/lane/card ownership while
  treating source work ids as non-authoritative metadata.
- Feature flags must allow the public share surface to stay disabled independently from tier board editing.
