# Community Release Plan

<!-- prettier-ignore -->
| Field | Value |
| --- | --- |
| Status | `community-core approved for single-instance beta; community-full production blocked` |
| Role | `community public-plane, privacy, moderation, and release contract` |
| Source of truth | [`PRODUCT_CONSTITUTION.md`](../product/PRODUCT_CONSTITUTION.md), ADR 0006, public permission boundary |
| When to update | community visibility, author identity, moderation, API, or private-record publication semantics change |

## Product Position

Community is an additive online plane. It does not replace the local-first
personal archive and does not make login mandatory for archive use.

Community core supports deliberate publication of reflections, board posts,
reviews, and comments plus public profiles, reports, and moderation. Public
reading remains available without an account; publishing and interaction
require authentication and a unique handle. Publication never copies a private
record automatically.

## Approved Scope And Gated Expansion

승인된 `community-core`는 짧은 감상, boards, reviews, comments, public
profiles, report와 moderation을 포함한다. follows, taste와 notifications는
`community-full` capability다.

`community-full`은 export·삭제·신고·moderation·rollback, 공개 전 안내,
desktop/mobile 핵심 흐름, 전체 CI, P0/P1 결함 부재 evidence를 갖추기 전까지
**production blocked** 상태를 유지한다.

베타 기본 allowlist에는 feed, board/detail, review/comment, public profile,
report/delete/moderation이 포함된다. taste/follow/notification은 포함되지 않는다.

## Publication Contract

Only the following fields may enter the community plane:

- the newly entered community body;
- the explicit spoiler flag;
- an optional work display snapshot containing title, media type, and
  thumbnail URL;
- the author's public display name, handle when present, and avatar URL;
- post timestamps and aggregate reaction count.

The optional work selector reads the local archive to help the user choose a
title, then sends only the display snapshot above. It never sends the local
work ID, rating, status, progress, review, short review, description, personal
tags, timeline, sync state, catalog identity, or deletion state.

A work snapshot is not kept in sync with the personal record. Editing or
deleting the local record does not silently edit a public post. The user must
delete the post explicitly.

## API Surface

- `GET /community/reflections`: public, published reflection rows only,
  cursor pagination,
  latest or popular ordering.
- `POST /community/reflections`: authenticated explicit publication.
- `DELETE /community/reflections/:id`: owner-only soft deletion.
- `POST /community/reflections/:id/reactions`: authenticated idempotent
  reaction.
- `DELETE /community/reflections/:id/reactions`: authenticated reaction
  removal.
- `POST /community/reflections/:id/reports`: authenticated
  one-report-per-user
  submission.
- `GET /community/reflections/moderation/reports`: moderator/admin only.
- `POST /community/reflections/moderation/:id/hide`: moderator/admin only.
- `POST /community/reflections/moderation/:id/restore`: moderator/admin only.
- `POST /community/reflections/moderation/reports/:id/resolve`:
  moderator/admin only;
  resolve or dismiss with a bounded note.

Public responses use opaque post IDs and bounded public author fields. They do
not expose raw user IDs, email, OAuth identifiers, session data, report details,
reporter identity, or moderation notes.

The `/community/posts`, `/community/feed`, reviews, comments, profiles,
reports, and moderation endpoints belong to `community-core`. Follows,
notifications, taste, and following-feed scope require `community-full`.
Deprecated profile aliases retain their old capability sets for one quarter.

## Runtime And Storage Enforcement

- Missing configuration resolves to `personal-archive`.
- The web omits Community routes and navigation unless the active profile
  permits them. Direct navigation therefore reaches the product 404.
- API controllers return 404 when their required release capability is off.
- `CommunityPost.surface` separates `reflection` from `board` in every
  list, write, reaction, delete, report, and moderation path.
- The migration classifies all pre-existing posts as `board`; only writes
  through the reflection controller create `reflection` rows.

## Abuse And Takedown

- Any signed-in user except the post author may report a visible post once.
- A report stores a bounded category and optional detail. It does not alter the
  post automatically.
- Moderators and admins can review pending reports, hide or restore a post, and
  resolve or dismiss a report.
- Every moderator mutation creates an immutable audit row with actor, action,
  target, bounded note, and timestamp.
- Hidden and deleted posts return `404` from normal post mutations and never
  appear in the public feed.
- Moderator access applies only to community rows. It grants no access to
  private archive, sync, credential, or diagnostic data.

Community core has repository-level implementation and local verification.
Single-instance beta exposure still requires host smoke, database migration,
moderation-operator, retention, takedown, backup/restore, OAuth, and rollback
evidence for the release commit. Community full remains blocked separately.

## UI Benchmark Notes

The 2026-08-25 browser pass used live public surfaces rather than screenshots:

- [Reddit r/books](https://www.reddit.com/r/books/) informed the visible create
  action, feed-first sort control, author/time hierarchy, and consistent card
  action row.
- [GitHub Community Discussions](https://github.com/orgs/community/discussions)
  informed the distinct feed heading, restrained secondary rail, and separation
  between primary browsing controls and community guidance.
- [Goodreads](https://www.goodreads.com/) informed the pre-auth value statement:
  explain what a guest can do and what remains private before asking them to
  sign in.

The alpha intentionally does not copy Reddit voting, GitHub categories/search,
or Goodreads recommendations. Those patterns exceed the approved single-feed,
single-reaction, privacy-first scope.

## UI States

- Guests can read the feed and see a clear sign-in action for publishing.
- Signed-in users see a composer with optional local work selection, a blank
  community-specific body, a spoiler switch, and explicit publication copy.
- Loading, empty, offline/error, publishing, reporting, deletion, and spoiler
  reveal states are visible and keyboard accessible.
- The privacy line states that the archive stays private and only the selected
  work snapshot plus newly written reflection is published.
- Desktop uses a focused feed with a compact principles rail. Mobile uses one
  column and an explicit experiment entry point; Community is not required in
  the core archive bottom navigation.

## Non-goals

- public profile pages;
- importing an existing private review into the composer;
- comments, follows, direct messages, recommendations, or public rankings;
- public tier boards or public archive browsing;
- rich HTML, link previews, attachments, or editing posts;
- automatically publishing any IndexedDB or sync payload.

## Verification Status And Release Requirements

Repository implementation now includes the Prisma migration, public-read and
authenticated-write API, owner/reaction/report/moderation authorization,
immutable moderation audit writes, responsive web route, four locale resources,
and focused service/publication tests.

Before production exposure, the release still requires:

- controller or e2e evidence for guest read plus guarded writes against the
  migrated runtime;
- browser evidence for guest/authenticated composer states, spoiler reveal,
  reaction, report, delete, empty, and error states;
- `npm run lint`, `npm run typecheck`, `npm run test`, architecture checks,
  documentation links, public repository safety, and relevant security gates;
- desktop and mobile browser QA against a real migrated runtime.
