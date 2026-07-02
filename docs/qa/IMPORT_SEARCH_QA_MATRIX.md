# Import/Search QA Matrix

Last updated: 2026-07-01

The canonical import/search QA matrix is
[`IMPORT_SEARCH_QA_CASES.json`](./IMPORT_SEARCH_QA_CASES.json). The QA runner
and offline Jest matrix contract both read that file; this document is the
human runbook and coverage index.

This QA scope is provider import/search only. It must not change sync behavior
or add public features. Live provider QA is optional, redacted, and separate
from CI because live provider output changes over time.

## Expert Feedback Implementation Lock

Expert feedback from 2026-06-04 maps to this matrix as an executable search
quality contract. The accepted scope is provider search QA, ranking weight
tuning, source merge/dedupe visibility, and manual fallback safety. Do not use
this track to add public catalog promotion, community, social recommendation,
mobile/Tauri, or i18n work.

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

## Canonical Coverage

The source file currently covers these required media types:

- `novel`
- `light_novel`
- `manga`
- `webtoon`
- `anime`
- `movie`
- `drama`
- `web_novel`

The source file also covers every non-manual provider currently exposed by the
import provider contract:

- `aladin`
- `anilist`
- `brave_search`
- `google_books`
- `kakao_book`
- `kakao_web`
- `kobis`
- `naver_book`
- `naver_web`
- `open_library`
- `tavily_search`
- `tmdb`
- `tvmaze`
- `wikidata`

The source file also covers these required assertion dimensions:

- `korean_title`
- `english_title`
- `original_title`
- `alias`
- `ambiguous_title`
- `typo_spacing`
- `creator_boost`
- `wrong_medium_guard`
- `source_coverage`
- `merge_dedupe`
- `duplicate_detection`
- `manual_fallback`

## Case Index

| ID | Medium | Query dimension | Query |
| --- | --- | --- | --- |
| novel-ko-title | novel | Korean title + author | `채식주의자 한강` |
| novel-en-title | novel | English title | `The Vegetarian Han Kang` |
| novel-ambiguous | novel | Ambiguous title | `Dune Frank Herbert` |
| light-novel-ko-title | light_novel | Korean title | `소드 아트 온라인` |
| light-novel-original | light_novel | Japanese/original title | `ソードアート・オンライン 川原礫` |
| light-novel-typo | light_novel | Typo/spacing variant | `Re 제로부터 시작하는 이세계 생활` |
| manga-ko-title | manga | Korean title | `진격의 거인` |
| manga-original-title | manga | Japanese/original title | `進撃の巨人` |
| manga-author | manga | Creator included | `원피스 오다 에이치로` |
| webtoon-ko-title | webtoon | Korean title | `유미의 세포들` |
| webtoon-spacing | webtoon | Typo/spacing variant | `외모 지상 주의` |
| webtoon-low-confidence | webtoon | Low-confidence fallback | `Gate1 Search QA Webtoon Synthetic` |
| anime-ko-title | anime | Korean title | `너의 이름은` |
| anime-original-title | anime | Japanese/original title | `君の名は。 新海誠` |
| anime-wrong-medium | anime | Wrong medium guard | `진격의 거인 애니메이션` |
| movie-ko-title | movie | Korean title | `기생충 봉준호` |
| movie-en-title | movie | English title | `Parasite Bong Joon-ho` |
| movie-ambiguous | movie | Ambiguous title | `Dune 2021` |
| drama-ko-title | drama | Korean title | `오징어 게임` |
| drama-spacing | drama | Typo/spacing variant | `이상한 변호사 우 영우` |
| drama-low-confidence | drama | Low-confidence fallback | `Gate1 Search QA Drama Synthetic` |
| web-novel-brave-search | web_novel | Web serialization provider coverage | `전지적 독자 시점 싱숑` |
| webtoon-kakao-web | webtoon | Kakao web provider coverage | `나 혼자만 레벨업 장성락` |
| book-kakao-book | novel | Kakao book provider coverage | `아몬드 손원평` |
| book-korean-provider-merge | novel | Korean book provider merge/dedupe | `불편한 편의점 김호연` |
| anime-season-variant-demotion | anime | Season or variant title demotion | `스파이 패밀리` |
| movie-kobis | movie | KOBIS provider coverage | `헤어질 결심 박찬욱` |
| low-confidence-fallback | novel | Low-confidence fallback | `Gate1 Search QA Unlikely Synthetic Title` |

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

Provider-focused live QA, for isolating a provider family or credential mode:

```bash
IMPORT_SEARCH_QA_LIVE=true \
IMPORT_QA_BASE_URL=https://beta.example.com \
IMPORT_QA_ACCESS_TOKEN=<disposable-test-account-token> \
IMPORT_SEARCH_QA_PROVIDERS=aladin,kakao_book,naver_book \
npm run qa:import-search
```

Full live matrix runs are intentionally paced to avoid exercising the guest
import-search rate limit instead of search quality. The runner defaults to a
longer delay for unauthenticated full-matrix runs and retries one `429` response
after the server-provided reset window. Override only for controlled staging
checks:

```bash
IMPORT_SEARCH_QA_LIVE=true \
IMPORT_SEARCH_QA_FULL_MATRIX=true \
IMPORT_QA_BASE_URL=https://beta.example.com \
IMPORT_SEARCH_QA_DELAY_MS=3100 \
IMPORT_SEARCH_QA_RATE_LIMIT_RETRIES=1 \
npm run qa:import-search
```

Reports are written to `tmp/import-search-qa/` by default. Do not commit
generated reports wholesale. The runner records only redacted summaries,
diagnostics, result counts, and top candidate labels, but live outputs are still
operator artifacts. By default, live QA executes the `liveSmoke` subset from the
canonical matrix; set `IMPORT_SEARCH_QA_FULL_MATRIX=true` only when
intentionally covering every case. `IMPORT_SEARCH_QA_PROVIDERS` accepts a
comma-separated list of fixture provider IDs and filters either the smoke subset
or full matrix to matching cases.

The default smoke subset must remain runnable as a useful staging check even
before a tester has saved personal provider keys. Its static contract includes
at least one manual-fallback safety case and at least three distinct
credential-free provider-quality media types. Credentialed providers can still
improve the live report, but the default smoke gate must not rely on them alone.
Each QA report includes a Live Smoke Manifest section that lists the exact smoke
case IDs, expected provider IDs, credential modes, manual fallback cases, and
credential-free provider-quality media types before any live request results.
Use that manifest as the operator checklist for deciding whether a staging run
covered credential-free quality, credentialed provider reach, and fallback
safety separately.
