# Community Alpha Plan

<!-- prettier-ignore -->
| Field | Value |
| --- | --- |
| Status | `implemented in repository; production exposure pending evidence` |
| Role | `community alpha product, privacy, and moderation contract` |
| Source of truth | explicit user request on 2026-08-25, local-first product direction, public permission boundary |
| When to update | community visibility, author identity, moderation, API, or private-record publication semantics change |

## Product Position

Community is an additive online plane. It does not replace the local-first
personal archive and does not make login mandatory for archive use.

The alpha supports one deliberate action: a signed-in user writes a new short
reflection, optionally connects a display snapshot of one local work, and
presses `공개하기`. The feed is readable without an account. Reactions and
publishing require authentication.

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

- `GET /community/posts`: public, published posts only, cursor pagination,
  latest or popular ordering.
- `POST /community/posts`: authenticated explicit publication.
- `DELETE /community/posts/:id`: owner-only soft deletion.
- `POST /community/posts/:id/reactions`: authenticated idempotent reaction.
- `DELETE /community/posts/:id/reactions`: authenticated reaction removal.
- `POST /community/posts/:id/reports`: authenticated one-report-per-user
  submission.
- `GET /community/moderation/reports`: moderator/admin only.
- `POST /community/moderation/posts/:id/hide`: moderator/admin only.
- `POST /community/moderation/posts/:id/restore`: moderator/admin only.
- `POST /community/moderation/reports/:id/resolve`: moderator/admin only;
  resolve or dismiss with a bounded note.

Public responses use opaque post IDs and bounded public author fields. They do
not expose raw user IDs, email, OAuth identifiers, session data, report details,
reporter identity, or moderation notes.

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

The alpha has repository-level implementation and local verification only.
Production exposure remains pending until host smoke, database migration,
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
  column and keeps Community available in bottom navigation.

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
