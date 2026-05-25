# Quick Add Search QA

Last updated: 2026-05-24

## Scope

Quick Add search is verified with deterministic mock candidates. Tests must not call external provider APIs and must not include provider credentials, API keys, or secrets.

## Mock Fixture Set

The ranking fixture set covers Korean display titles, Japanese original titles, English titles, web serial titles, same-title works, and movie/drama/anime/manga/novel cases:

- 나 혼자만 레벨업
- 전지적 독자 시점
- 괴담동아리
- 장송의 프리렌
- 葬送のフリーレン
- Sousou no Frieren
- Steins;Gate
- Dune
- Dune Messiah
- 너의 이름은
- 君の名は。
- 오징어 게임

Expected contract:

- The intended candidate appears in the top 1-3 ranked results.
- Exact title, normalized title, alias match, contributor, release year, medium type, external identity count, release candidate count, and provider coverage affect the score.
- Same work candidates from multiple providers merge without losing external refs, release refs, aliases, or provider coverage.
- Same-title candidates with different media types remain separate unless a stronger shared identity proves they are the same candidate.

## Provider Limits

- Google Books and Open Library are useful for books, but web serial metadata may be sparse.
- AniList is strong for anime and manga titles and aliases, but does not cover every Korean web serial adaptation.
- TMDB, TVmaze, and KOBIS are screen-oriented; same-title novels and screen adaptations must be separated by medium type and release year.
- Wikidata is enrichment quality, not primary ranking authority. It can improve aliases and external identities, but domain providers should rank above it when title quality is otherwise equal.
- Naver, Kakao, Aladin, Brave, and Tavily may require configured credentials or network availability depending on deployment.

## Guest vs Authenticated

- Guests can use no-key public providers and direct add fallback.
- Authenticated users can use personal provider keys where supported.
- Search failure, partial provider failure, or no results must still leave a clear direct-add path.
- Provider group settings stay collapsed by default, but no-result or low-result states should invite changing search sources.

## User API Key Providers

User-scoped provider keys are required for:

- Aladin Book
- Naver Book
- Kakao Book
- Naver Web
- Kakao Web
- Brave Search
- Tavily Search
- TMDB
- KOBIS

No user key is expected for:

- AniList
- Google Books
- Open Library
- TVmaze
- Wikidata
- Manual/direct add

## Manual QA Checklist

- Search each fixture title and confirm the intended candidate is easy to identify from title, aliases, contributor, release year, and medium type.
- Confirm an empty result shows "직접 추가로 계속" and "검색 출처를 바꿔보기".
- Confirm low or partial results show a natural prompt to change search sources without opening provider settings by default.
- Confirm a candidate with likely local duplicates shows a visible archive warning in the row and preview.
- Apply a candidate and confirm the save screen summary shows provider coverage, external identity count, release candidate count, and filled/missing fields.
- Save catalog-matched, importDraft, manual, and preview-manual candidates and confirm their identity payloads stay distinct.
