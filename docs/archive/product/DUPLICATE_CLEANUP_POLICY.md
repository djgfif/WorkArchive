# Duplicate Cleanup Policy

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `product-policy` |
| Last verified against | `2026-05-26` duplicate cleanup implementation |
| When to update | Duplicate detection rules, merge safety behavior, or local archive storage policy changes |

Duplicate Cleanup is a private local-first archive maintenance tool. It works
for guest and authenticated local archives, and it does not publish, share, or
promote user records.

## Detection Policy

Candidate groups are built only from active local work records. Rules are
applied conservatively:

- Same `catalogTitleId`.
- Same `importDraft.externalRefs` identity.
- Same normalized `title + type + author`.
- Fuzzy title fallback only when type and normalized author match and title
  similarity is at least high-confidence.

User "not duplicate" decisions are stored in local `appMeta` under a
duplicate-cleanup namespace. Those decisions are local metadata and are not sync
entities.

## Merge Safety

Merges require an explicit target work and selected source records.

- `personalTags` and `genres` are unioned.
- Timeline entries and release records from source works are copied to the
  target and the source-owned originals are soft-deleted, so parent IDs are not
  rewritten for already-synced child records.
- Work scalar disagreements require an explicit user choice before merge.
  This includes reviews, ratings, status, progress, dates, title, author,
  catalog/import metadata, and other scalar fields.
- `updatedAt` is refreshed on changed local records. Newest `updatedAt` is only
  used as a UI suggestion for conflicting scalar choices; it does not override
  personal content automatically.
- Source works are soft-deleted, not hard-deleted.

## Boundaries

Duplicate Cleanup does not change public/community/share flags and does not add
public catalog promotion behavior. It uses the existing local archive database,
export format, and sync queue semantics for changed personal records.
