# Search Provider Cost Policy

Work Archive does not run cost-bearing search traffic on operator server
accounts by default.

## Policy

- Providers that can create operator-server API cost run in `user` credential
  mode.
- Brave Search and Tavily Search use each user's personal API key.
- Guests cannot use Brave Search or Tavily Search, even when
  `IMPORT_SERVER_SEARCH_GUEST_ENABLED=true`.
- Guest search includes only public providers that do not require API keys, plus
  manual entry.
- API keys are stored in the encrypted credential vault.
- API keys are not included in local archive export/import, tier board export,
  JSON backup, CSV backup, or logs.

## Current Provider Classes

- User credential providers: Aladin, Naver Book, Naver Web, Kakao Book, Kakao
  Web, TMDB, KOBIS, Brave Search, Tavily Search.
- No-key public providers: AniList, Google Books, Open Library, TVmaze,
  Wikidata, Manual.

`IMPORT_SERVER_SEARCH_GUEST_ENABLED` remains as a reserved compatibility flag
for future server-credential providers. It does not apply to Brave Search or
Tavily Search.
