# Import/Search QA Matrix

Last updated: 2026-05-26

This matrix defines broad import/search assertions for Gate 1. It is not a
snapshot of live provider truth. Live provider output can change and must be
recorded separately in a generated evidence report.

## Assertions Used For Every Case

- The requested medium type should appear in the top N results when provider
  quality is sufficient.
- Exact title or alias matches should rank above weak token matches.
- Candidates should expose source/provider coverage when available.
- Manual fallback must remain available when provider quality is low, providers
  are unavailable, or credentials are missing.
- Duplicate detection should prefer `catalogTitleId`/catalog match, then
  external references, then conservative title/year/contributor fallback.
- Provider failure must not block direct manual add.
- Wrong-medium candidates for ambiguous titles should be demoted below stronger
  requested-medium matches.

## Golden Query Cases

| ID | Medium | Query dimension | Query | Expected assertion |
| --- | --- | --- | --- | --- |
| novel-ko-title | novel | Korean title + author | `채식주의자 한강` | Novel candidate appears in top results; author/creator signal strengthens confidence. |
| novel-en-title | novel | English title | `The Vegetarian Han Kang` | English title or alias can match the same novel; manual fallback remains available if providers are weak. |
| novel-ambiguous | novel | Ambiguous title | `Dune Frank Herbert` | Novel result ranks above movie result when author and requested medium indicate novel. |
| light-novel-ko-title | light_novel | Korean title | `소드 아트 온라인` | Light novel candidate appears; anime/manga adaptations are not merged into the book identity. |
| light-novel-original | light_novel | Japanese/original title | `ソードアート・オンライン 川原礫` | Original title/creator alias can match; creator signal ranks above weak token matches. |
| light-novel-typo | light_novel | Typo/spacing variant | `Re 제로부터 시작하는 이세계 생활` | Normalization tolerates punctuation/spacing drift; manual fallback remains visible. |
| manga-ko-title | manga | Korean title | `진격의 거인` | Manga candidate appears in top N; anime candidate is guarded when medium is manga. |
| manga-original-title | manga | Japanese/original title | `進撃の巨人` | Original title alias can match manga candidates and expose provider refs when available. |
| manga-author | manga | Creator included | `원피스 오다 에이치로` | Creator included query improves ranking over weak same-title matches. |
| webtoon-ko-title | webtoon | Korean title | `유미의 세포들` | Webtoon candidate appears; book/movie/drama candidates stay below stronger webtoon matches. |
| webtoon-spacing | webtoon | Typo/spacing variant | `외모 지상 주의` | Spacing normalization should not remove manual fallback or provider diagnostics. |
| webtoon-low-confidence | webtoon | Low-confidence fallback | `Gate1 Search QA Webtoon Synthetic` | Manual fallback remains available when provider quality is low. |
| anime-ko-title | anime | Korean title | `너의 이름은` | Anime candidate appears in top N and movie/book variants do not outrank it solely by tokens. |
| anime-original-title | anime | Japanese/original title | `君の名は。 新海誠` | Original title and creator/director signal should rank exact/alias match above weak matches. |
| anime-wrong-medium | anime | Wrong medium guard | `진격의 거인 애니메이션` | Anime result ranks above manga when query and requested medium indicate anime. |
| movie-ko-title | movie | Korean title | `기생충 봉준호` | Movie candidate appears; director signal helps; source coverage is shown when available. |
| movie-en-title | movie | English title | `Parasite Bong Joon-ho` | English title alias should connect to the movie candidate. |
| movie-ambiguous | movie | Ambiguous title | `Dune 2021` | Movie candidate ranks above novel candidates for the same title/year. |
| drama-ko-title | drama | Korean title | `오징어 게임` | Drama candidate appears; movie or game token matches should not outrank it. |
| drama-spacing | drama | Typo/spacing variant | `이상한 변호사 우 영우` | Spacing variant still gives a drama candidate or manual fallback. |
| drama-low-confidence | drama | Low-confidence fallback | `Gate1 Search QA Drama Synthetic` | Manual fallback remains available and provider failures are diagnostics, not blockers. |

## How To Run

Offline/static QA:

```bash
npm run qa:import-search
```

Live QA, only against a beta/staging host:

```bash
IMPORT_SEARCH_QA_LIVE=true \
IMPORT_QA_BASE_URL=https://beta.example.com \
IMPORT_QA_ACCESS_TOKEN=<disposable-test-account-token> \
npm run qa:import-search
```

Reports are written to `tmp/import-search-qa/` by default. Do not commit
generated reports wholesale. The runner records only redacted summaries,
diagnostics, result counts, and top candidate labels, but live outputs are still
operator artifacts. By default, live QA executes a smoke subset of this matrix;
set `IMPORT_SEARCH_QA_FULL_MATRIX=true` only when intentionally covering every
case.
