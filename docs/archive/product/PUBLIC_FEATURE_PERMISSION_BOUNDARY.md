# Public Feature Permission Boundary

Current product state: Work Archive is a private local-first personal archive.
Public profile, public record, social feed, and community features are not an
active service surface. `/community` is a placeholder direction, and product
docs keep public/community expansion out of the current scope.

Tier boards have visibility states (`private`, `link_only`, `exported`), but
there is no public community feed attached to them in Gate 1.

## Rules Before Any Public Feature

- Default must be private.
- Public/share visibility must be explicit opt-in.
- Private reviews, personal tags, sync metadata, provider credentials, refresh
  session metadata, and raw user identifiers must never be exposed.
- `private`, `link_only`, `public`, and `exported` must have separate semantics:
  - `private`: visible only to the owner.
  - `link_only`: accessible only through an unguessable share link after opt-in.
  - `public`: indexable or browsable public surface after opt-in and moderation
    readiness.
  - `exported`: local JSON/file artifact, not a hosted public permission.
- Moderator permissions must not grant access to private records unless an
  explicit abuse, support, or legal workflow exists.
- Admin permissions must be audited and separated from normal product browsing.
- Catalog submission data and private user records must stay separate. A catalog
  contribution can promote public metadata, but it must not publish the user's
  private review, status, rating, tags, or sync history.

Do not implement community or public sharing as part of Gate 1.
