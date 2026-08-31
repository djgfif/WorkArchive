# Public Feature Permission Boundary

<!-- prettier-ignore -->
| Field | Value |
| --- | --- |
| Status | `canonical` |
| Role | `default-private public feature boundary` |
| Source of truth | current API routes, Prisma visibility enums, BOLA matrix, commercial Gate 1 scope |
| Last verified against | `2026-08-31` Community core API, release profiles, split services, and focused authorization tests |
| When to update | any public/share/community route, tier-board visibility semantic, catalog-publication flow, moderation role, or owner-scope rule changes |

Work Archive's personal archive remains private and local-first. Community is a
separate public-read, authenticated-write data plane. `community-core` includes
public profiles, posts, reviews, comments, reports, and moderation;
`community-full` alone adds follows, taste discovery, and notifications.

This document defines the active Community public boundary and remains the review
gate for any later public or share expansion.

## Gate 1 Rule

Gate 1 is default-private:

- User-owned archive records are private to the authenticated owner.
- Sync payloads are accepted only in the authenticated user's scope.
- Community accepts only an explicit, allowlisted publication payload; it
  cannot read or publish private server records or sync payloads.
- Tier boards may store `private`, `link_only`, and `exported` visibility
  values for schema/sync compatibility, but Gate 1 user-facing settings expose
  only private/local-export wording. Community does not create a hosted public
  browse surface for tier boards.
- `exported` means a local/export artifact or sync-visible state, not a hosted
  public permission.

## Visibility Semantics

The only currently implemented tier-board visibility values are:

| Value       | Gate 1 meaning                                                                                                    | Public access                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `private`   | Owner-only board state. This is the default.                                                                      | No public access.                        |
| `link_only` | Reserved opt-in share semantics for a future unguessable link flow. It is not selectable from Gate 1 settings UI. | No hosted public route exists in Gate 1. |
| `exported`  | Exportable/non-hosted state used by local-first workflows.                                                        | Not a public hosted permission.          |

Do not add a `public` visibility state without a separate public feature design,
abuse review, BOLA matrix update, owner-scope tests, and release-gate evidence.

## Data That Must Never Become Public By Accident

The following data stays private unless a later document defines an explicit,
reviewed, opt-in publication contract:

- personal reviews, ratings, status, progress, notes, tags, and timeline entries;
- sync metadata, client mutation IDs, conflict details, and deleted tombstones;
- provider credentials, provider diagnostics that imply credential ownership,
  and import history tied to a user;
- refresh-session metadata, security events, IP/user-agent hashes, OAuth account
  identifiers, and raw user IDs;
- backup, restore, export, and diagnostic artifacts that contain user records;
- catalog submission provenance when it can reveal a user's private archive.

Catalog metadata and private user records remain separate. A future catalog
contribution flow may promote public metadata, but it must not publish the
contributor's private archive state.

Community request DTOs and web publication builders must never accept or copy
personal record IDs, progress, personal tags, private reflections, sync IDs, or
timeline fields. The only work identity allowed in a Community request is a
confirmed `catalogTitleId`; a post may instead carry an explicitly reviewed
title/type/HTTPS-thumbnail snapshot.

## Community Public Plane Permission Semantics

| Operation                                            | Access                           | Required scope                                         |
| ---------------------------------------------------- | -------------------------------- | ------------------------------------------------------ |
| list published posts, reviews, comments, profiles    | public                           | published, public, and not deleted/hidden only         |
| create post/review/comment                           | authenticated with unique handle | current user plus allowlisted publication fields only  |
| update/delete own review or comment; delete own post | authenticated                    | author only; content delete is soft delete             |
| add/remove reaction                                  | authenticated                    | current user's own reaction only                       |
| report post/review/comment                           | authenticated                    | current reporter only; authors cannot self-report      |
| list reports                                         | moderator/admin                  | Community reports only                                 |
| hide/restore post/review/comment                     | moderator/admin                  | explicit action plus immutable audit row               |
| resolve/dismiss report                               | moderator/admin                  | explicit action plus immutable audit row               |
| follow, taste, notification, following feed          | authenticated                    | `community-full` only; unavailable in `community-core` |

`personal-archive` registers no Community surface. `community-core` is the
single-instance beta profile and serves the public-read/core-write rows above.
`community-full` adds only the listed later social capabilities after its Gate.
The deprecated `community-reflection-alpha` and
`community-social-experiment` aliases retain their previous narrow capability
sets for one quarter and never auto-promote to a broader profile.

`CommunityPost.surface = reflection` remains scoped to the compatibility route;
board posts stay on the core controller. Supplying an otherwise valid ID from a
different surface or a disabled capability returns `404` rather than crossing
the release boundary.

## Deprecated Alias Permission Semantics

| Operation              | Access          | Required scope                                                  |
| ---------------------- | --------------- | --------------------------------------------------------------- |
| list published posts   | public          | published and not deleted/hidden only                           |
| create post            | authenticated   | author is the current user; allowlisted publication fields only |
| delete post            | authenticated   | owner only; soft delete                                         |
| add/remove reaction    | authenticated   | current user's own reaction only                                |
| report post            | authenticated   | current reporter only; authors cannot self-report               |
| list reports           | moderator/admin | community reports only                                          |
| hide/restore post      | moderator/admin | explicit action plus immutable audit row                        |
| resolve/dismiss report | moderator/admin | explicit action plus immutable audit row                        |

이 표는 `community-reflection-alpha`의
`/community/reflections` route family에만 적용된다. 웹의 `/community`
화면과 API controller는 reflection release capability가 꺼져 있으면
등록되지 않거나 `404`를 반환한다.

`CommunityPost.surface = reflection`인 행만 이 feed, reaction, report,
delete, moderation 경로에서 읽거나 변경할 수 있다. 이전 migration에서 생성된
게시물은 `board`로 분류하며 좁은 alpha에 자동 노출하지 않는다.
이 alias 표는 `community-core`를 축소하지 않는다. Core는 posts, combined
feed, reviews, comments, public profiles, reports, and moderation을 열며,
follows, notifications, taste, following feed만 `community-full`에 남긴다.

Public author views contain display name, optional handle, and avatar URL. They
never contain email or raw user ID. Public content views contain only explicitly
entered public text, spoiler/rating fields where applicable, confirmed catalog
identity or an optional title/type/thumbnail snapshot, timestamps, and aggregate
counts. Global API validation rejects non-allowlisted request fields.

## Abuse, Takedown, And Audit

A signed-in non-author may create one report per post with a bounded reason and
optional detail. Reports do not automatically hide content. Moderators and
admins may hide or restore posts and resolve or dismiss reports. Every moderator
mutation stores actor, action, target, bounded note, and timestamp in an
append-only community audit table. Normal feed responses never expose reporters,
report details, audit actors, or moderation notes.

Deleted or hidden posts do not appear in public reads and behave as not found for
normal post mutations. Moderator authority applies only to Community rows and
does not grant access to private archive, sync, credentials, sessions, or
diagnostics.

Repository implementation does not approve production exposure by itself. The
release commit still needs migration, host smoke, rate-limit, moderator operator,
retention, abuse/takedown, and rollback evidence in the applicable release gate.

## Required Review Before Public Expansion

Before implementing any public/share/community backend surface:

1. Update this document with the exact permission semantics.
2. Update [`BOLA_MATRIX.md`](./BOLA_MATRIX.md) for every new object family or
   operation.
3. Add focused owner-scope and public-access tests before exposing the route.
4. Define abuse, takedown, moderation, and admin audit behavior.
5. Record release evidence in
   [`../commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md`](../commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md)
   or the next applicable commercial gate.

Moderator or admin privileges must not grant casual browsing access to private
records. Any support, abuse, legal, or operator override must be explicit,
audited, and separate from normal product browsing.

## Repository Gate

`npm run qa:public-boundary` verifies that this canonical boundary remains
present, Community permission wording remains explicit, the Prisma tier-board
visibility enum still matches the documented Gate 1 semantics, tier boards
remain non-exposed outside sync in the BOLA matrix, and the commercial repo gate
runs the check.
