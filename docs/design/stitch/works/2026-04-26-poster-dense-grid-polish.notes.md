# Works List Poster-Dense Grid Polish

- Stitch project: `projects/13367329108525978615`
- Stitch screen: `projects/13367329108525978615/screens/3952a1241d294eff8086a0508c7bf5b9`
- Date: 2026-04-26

## Purpose

Make the saved works list feel like a personal archive library, with poster artwork as the primary scanning surface.

## UI Decisions

- The active works page opens in grid view by default.
- Grid cards emphasize a full-width 3:4 poster, status, type, rating, favorite state, short review, recent update, genres, and progress when available.
- List view remains available for dense scanning and quick status/rating edits.
- Trash scope keeps the existing restore-oriented list behavior.

## Implementation Notes

- No data model change.
- No `WorksRepository`, Dexie, sync, or Quick Add save contract change.
- Progress is read from existing `progressCurrent`, `progressTotal`, and `lastConsumedLabel` fields.
