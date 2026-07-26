# Public Feature Permission Boundary

| Field                 | Value                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Status                | `canonical`                                                                                                                              |
| Role                  | `default-private public feature boundary`                                                                                                |
| Source of truth       | current API routes, Prisma visibility enums, BOLA matrix, commercial Gate 1 scope                                                        |
| Last verified against | `2026-07-03` private-first Tier Board UI and public-boundary gate                                                                        |
| When to update        | any public/share/community route, tier-board visibility semantic, catalog-publication flow, moderation role, or owner-scope rule changes |

Work Archive is a private, local-first personal archive in Gate 1. Public
profiles, public records, social feeds, comments, follows, recommendations, and
community browsing are not active backend service surfaces.

This document is the permission boundary for any future public or share feature.
It must be updated before adding a public API route, a hosted share URL, a
community controller, or a moderation/admin browsing workflow.

## Gate 1 Rule

Gate 1 is default-private:

- User-owned archive records are private to the authenticated owner.
- Sync payloads are accepted only in the authenticated user's scope.
- Public/community/social features are out of scope.
- Tier boards may store `private`, `link_only`, and `exported` visibility
  values for schema/sync compatibility, but Gate 1 user-facing settings expose
  only private/local-export wording. There is no public community feed or hosted
  public browse surface attached to them in Gate 1.
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
present, the Prisma tier-board visibility enum still matches the documented
Gate 1 semantics, tier boards remain non-exposed outside sync in the BOLA
matrix, and the commercial repo gate runs the check.
