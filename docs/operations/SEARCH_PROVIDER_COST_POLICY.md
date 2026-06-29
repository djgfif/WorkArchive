# Search Provider Cost Policy

Work Archive can run high-impact free search providers from operator-managed
server keys, while keeping cost-bearing web search on user keys.

## Policy

- Providers with broad free/non-commercial API access can use operator-managed
  server keys when configured.
- Server-key providers are available to guest Quick Add search in production
  only when both `IMPORT_SERVER_SEARCH_GUEST_ENABLED=true` and
  `IMPORT_SERVER_SEARCH_GUEST_APPROVED=true` are set.
- One API search request runs at most 3 provider lookups concurrently. This
  protects upstream quotas and keeps a single request from fanning out to every
  configured external provider at once.
- Brave Search and Tavily Search use each user's personal API key.
- Guests cannot use Brave Search or Tavily Search, even when guest
  server-key search is approved.
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

## Provider Quota Register

Record the actual production quota, plan, owner, and fallback decision in the
Gate 1 evidence ledger before enabling a server key for public beta traffic.
The repository policy defaults below are the maximum allowed exposure until that
evidence exists.

| Provider class | Providers | Default public-beta exposure | Required quota/cost evidence |
| --- | --- | --- | --- |
| No-key public | AniList, Google Books, Open Library, TVmaze, Wikidata | Guest and authenticated search may use these behind endpoint rate limits, provider timeout, 3-way provider concurrency, short cache, and circuit breaker controls. | Confirm non-commercial use is acceptable for the beta scope; record any published rate guidance that affects alert thresholds. |
| Free server-key capable | TMDB, Naver Book, Naver Web, Kakao Book, Kakao Web, KOBIS | Authenticated search only by default. Production guest search requires `IMPORT_SERVER_SEARCH_GUEST_ENABLED=true`, `IMPORT_SERVER_SEARCH_GUEST_APPROVED=true`, and a recorded operator approval. KOBIS also requires `KOBIS_HTTP_PROVIDER_ENABLED=true` in production. | Record key owner, plan name, per-second or per-minute quota, daily/monthly quota, paid overage behavior, and fallback provider. |
| User credential | Aladin, Naver Book, Naver Web, Kakao Book, Kakao Web, TMDB, KOBIS, Brave Search, Tavily Search | Authenticated user opt-in only; never available to guests through the guest server-search toggle. | Record that usage bills or throttles against the user's key, not the operator account. |
| Cost-bearing web search | Brave Search, Tavily Search | User credential only. No operator-managed guest access. | Record user-facing credential guidance and confirm logs never include the key or raw provider request URL. |

If a provider's live quota is lower than the endpoint rate limit or the 3-way
provider concurrency cap can safely respect, lower the API endpoint rate limit
or disable that provider for guest/default search before launch. Do not raise
rate limits to compensate for provider throttling without a new cost review.
