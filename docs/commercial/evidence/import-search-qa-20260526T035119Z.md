# Import/Search QA Report

- Timestamp UTC: 2026-05-26T03:51:19.635Z
- Mode: offline
- Git commit: 3d3c3fcfa9ba44e15e1949e23ee58c2cf72a0163
- Working tree: dirty
- Overall status: PASS

## Checks

| Check | Status | Summary |
| --- | --- | --- |
| offline import/search Jest fixtures | PASS | Focused ranking, merge/dedupe, provider diagnostics, and manual fallback tests passed. |
| golden matrix shape | PASS | 8 cases cover novel, light_novel, manga, webtoon, anime, movie, drama. |

## Matrix Coverage

- novel-ko-title: novel, "채식주의자 한강" -> novel candidate in top results; author signal improves confidence
- light-novel-alias: light_novel, "Sword Art Online 카와하라 레키" -> light novel exact or alias match outranks weak anime/manga token matches
- manga-original-title: manga, "進撃の巨人" -> manga candidate can expose Japanese/original title aliases
- webtoon-ko-title: webtoon, "유미의 세포들" -> webtoon candidate appears; book/movie candidates stay below stronger type matches
- anime-ambiguous-title: anime, "너의 이름은" -> anime candidate appears in top N with provider/source coverage when available
- movie-wrong-medium-guard: movie, "Dune 2021" -> movie candidate ranks above novel candidates for the same title/year query
- drama-spacing-variant: drama, "이상한 변호사 우 영우" -> spacing variant still produces a drama candidate or manual fallback
- low-confidence-fallback: novel, "Gate1 Search QA Unlikely Synthetic Title" -> manual fallback remains available when provider quality is low or providers fail
