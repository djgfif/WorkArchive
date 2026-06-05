# Search Provider Cost Policy

Work Archive can run high-impact free search providers from operator-managed
server keys, while keeping cost-bearing web search on user keys.

## Policy

- Providers with broad free/non-commercial API access can use operator-managed
  server keys when configured.
- Server-key providers are available to guest Quick Add search only when
  `IMPORT_SERVER_SEARCH_GUEST_ENABLED=true`.
- Brave Search and Tavily Search use each user's personal API key.
- Guests cannot use Brave Search or Tavily Search, even when
  `IMPORT_SERVER_SEARCH_GUEST_ENABLED=true`.
- Guest search includes no-key public providers, configured free server-key
  providers, and manual entry.
- API keys are stored in the encrypted credential vault.
- API keys are not included in local archive export/import, tier board export,
  JSON backup, CSV backup, or logs.

## Current Provider Classes

- Free server-key-capable providers: TMDB, Naver Book, Naver Web, Kakao Book,
  Kakao Web, KOBIS.
- User credential providers: Aladin, Naver Book, Naver Web, Kakao Book, Kakao
  Web, TMDB, KOBIS, Brave Search, Tavily Search.
- No-key public providers: AniList, Google Books, Open Library, TVmaze,
  Wikidata, Manual.

Server credential environment variables:

- `TMDB_API_READ_TOKEN` or `TMDB_API_KEY`
- `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET`
- `KAKAO_REST_API_KEY`
- `KOBIS_API_KEY`

`IMPORT_SERVER_SEARCH_GUEST_ENABLED` does not apply to Brave Search or Tavily
Search.
