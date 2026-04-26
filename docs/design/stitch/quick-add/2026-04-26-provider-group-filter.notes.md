# Quick Add Provider Group Filter

- Stitch project: `projects/13367329108525978615`
- Stitch screen: `projects/13367329108525978615/screens/3e45d5cdefa841ba9ee2f8ff3a5d98b5`
- Date: 2026-04-26

## Purpose

Let users narrow external search scope without exposing a full provider checkbox matrix.

## Provider Groups

- `전체`: omit the `providers` search parameter.
- `도서`: `google_books`, `open_library`, `aladin`, `naver_book`, `kakao_book`.
- `애니·만화`: `anilist`, `google_books`, `open_library`.
- `영상`: `tmdb`, `tvmaze`, `kobis`.
- `직접 추가`: `manual`.

## UI Decisions

- The group filter is shown as compact segmented buttons inside the search flow.
- Provider readiness remains visible and separate from the filter.
- Guest users see a scoped warning that only some providers may need login or server setup.

## Implementation Notes

- Backend provider policy is unchanged.
- `importsService.searchCandidates(query, { providers })` is used as-is.
- `catalogTitleId`, `importDraft`, Dexie, and sync queue behavior are unchanged.
