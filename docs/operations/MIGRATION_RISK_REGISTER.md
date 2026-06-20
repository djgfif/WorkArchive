# Migration Risk Register

This register is the machine-checked record for Prisma migrations that contain
high-risk SQL. `npm run qa:migrations` fails when a migration includes high-risk
patterns but does not appear here with an approved status.

High-risk patterns currently include `DROP TABLE`, `DROP COLUMN`, `DROP TYPE`,
`TRUNCATE`, `DELETE FROM`, enum rewrites through `ALTER TYPE ... RENAME TO`, and
mass `UPDATE` statements without a `WHERE` clause.

## Registered Prisma Migration Risks

| Migration | Risk class | Approval | Notes |
| --- | --- | --- | --- |
| `20260421091500_release_domain_split` | `drop-table` | `approved-historical` | Split the original flat `works` table into catalog and user record tables after backfilling rows. Future re-runs require restore-ready backup evidence before deployment. |
| `20260520000100_tier_boards` | `drop-column`, `drop-type` | `approved-historical` | Contracted the legacy per-work tier field after copying tier data into tier board snapshots. |
| `20260520143000_drop_paused_work_status` | `enum-rewrite`, `drop-type` | `approved-historical` | Rewrote `WorkStatus` after converting `paused` records to `dropped`. |
| `20260521090000_tier_board_cards_contract` | `drop-column`, `drop-type`, `update-without-where` | `approved-historical` | Contracted tier board/card storage after renaming tables and converting source type values. |
| `20260604120000_add_on_hold_work_status` | `enum-rewrite`, `drop-type` | `approved-historical` | Rewrote `WorkStatus` to add `on_hold` while preserving existing values. |
| `20260606120000_drop_legacy_password_auth` | `drop-table`, `drop-column` | `approved-historical` | Removed email/password authentication artifacts after Google OAuth became the only supported provider. |

## New Risk Entry Requirements

Before adding a new `approved-release` entry:

- Prefer expand/migrate/contract and avoid destructive SQL when possible.
- Confirm backup and restore evidence for the target environment.
- Document affected data and expected loss boundaries.
- Link the release checklist item or incident plan that approved the risk.
- Run `npm run qa:migrations`, `npm run check:docs-links`, and the standard
  release gates before deployment.
