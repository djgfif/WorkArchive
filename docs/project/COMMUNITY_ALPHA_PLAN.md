# Community Alpha Plan

<!-- prettier-ignore -->
| Field | Value |
| --- | --- |
| Status | `production blocked; repository implementation exceeds approved alpha` |
| Role | `community alpha product, privacy, and moderation contract` |
| Source of truth | [`PRODUCT_CONSTITUTION.md`](../product/PRODUCT_CONSTITUTION.md), explicit 2026-08-25 reflection-alpha approval, public permission boundary |
| When to update | community visibility, author identity, moderation, API, or private-record publication semantics change |

## Product Position

Community is an additive online plane. It does not replace the local-first
personal archive and does not make login mandatory for archive use.

The alpha supports one deliberate action: a signed-in user writes a new short
reflection, optionally connects a display snapshot of one local work, and
presses `공개하기`. The feed is readable without an account. Reactions and
publishing require authentication.

## Approved Scope And Implementation Drift

승인된 alpha는 짧은 공개 감상, 단일 feed, 단일 reaction, post delete,
report와 moderation뿐이다. 현재 저장소에는 이 계약을 넘어선 boards, public
profiles, comments, follows, taste/trending surface와 관련 route/API가 존재한다.

이 확장은 제품 헌법 변경이나 별도 승인 없이 같은 alpha로 간주할 수 없다.
개인 아카이브 release profile에서는 노출하지 않으며, 별도 decision record,
데이터 권리 검토, 성공·중단 기준, browser/host evidence를 갖추기 전까지
**production blocked** 상태를 유지한다.

승인된 web route allowlist는 Community feed와 feed 안의 publish/reaction/
report/delete 흐름이다. public profile, board detail, taste/trending route는
approved alpha allowlist에 포함되지 않는다.

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
follows, notifications, taste, and trending endpoints belong to the separate
`community-social-experiment` surface. They are not aliases for the approved
reflection alpha.

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

The approved reflection alpha has repository-level implementation and local verification only.
The broader social expansion is not part of this approval. Production exposure remains pending until host smoke, database migration,
moderation-operator, retention, and takedown evidence are recorded for the
release commit.

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
