# ADR 0004: Standalone Tier Board Maker

## Status

Accepted

## Context

Tier boards are an archive companion feature. They reference local works, support JSON export/import, and should be usable without creating a public community surface. The public sharing/feed concept is intentionally disabled until ownership, moderation, abuse handling, and privacy controls are mature.

## Decision

Keep Tier Board Maker as a standalone personal tool.

- Tier boards remain enabled by default.
- Tier board work references must be ownership-checked during sync/import/API handling.
- JSON export/import remains a personal data portability path.
- Public community/share feed remains behind a disabled feature flag.

## Alternatives

- Public community launch: rejected because moderation and privacy operations are not ready.
- Merge tier boards into works CRUD: rejected because board layout, lanes, cards, and assets have a separate editing model.
- Remove tier boards from the runtime: rejected because existing local tier board workflows are part of the product.

## Consequences

- Release smoke tests must include creating and exporting a tier board.
- Security review must include `work_ref` ownership.
- Feature flags must allow the public share surface to stay disabled independently from tier board editing.
