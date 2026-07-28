# Poster Image Proxy and Privacy Policy

Last reviewed: 2026-07-28.

Work Archive treats poster URLs as untrusted metadata. The browser must not make
requests to arbitrary external image origins. Known cover providers are fetched
only through the same-origin `/api/image-proxy`; a rejected URL or failed proxy
request ends at a local placeholder and never falls back to the original URL.

## Private-First Browser Policy

| Input                                                | Browser behavior                                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Same-origin path, `blob:` URL                        | Render locally.                                                                                      |
| Raster `data:` URL (AVIF, GIF, JPEG, PNG, WebP)      | Render locally; SVG data URLs are rejected.                                                          |
| Allowlisted external provider                        | Render one same-origin proxy candidate. Legacy provider HTTP is normalized to HTTPS before proxying. |
| Unknown, malformed, credentialed, or unsupported URL | Render the deterministic local placeholder and make no external request.                             |
| Proxy or image decode failure                        | Render the local placeholder; do not try the upstream URL.                                           |

All poster `<img>` elements and cache fills use `Referrer-Policy: no-referrer`.
This policy covers archive posters, tier-board cards, tier-board view/export,
and tier-board cover previews.

## Proxy Boundary

The API proxy enforces:

- a provider host suffix allowlist;
- HTTPS-only upstream URLs on the Default port only;
- DNS resolution with localhost, private, reserved, and IPv4-mapped private IPv6
  address rejection before fetch and after redirects;
- redirect target revalidation with a bounded redirect count;
- a 5-second timeout and an 8 MiB streamed response limit;
- an explicit AVIF, GIF, JPEG, PNG, and WebP content-type allowlist; SVG is
  rejected;
- per-host concurrency and request-window limits;
- ETag, deterministic cache-control, and no caching of failed responses;
- provider-host and safe error-code logging only, with full URL logging avoidance.

Allowlist changes are code-reviewed policy changes. Each added provider needs a
focused URL-policy test and a safe sample that proves its hostname and content
type requirements.

## Cache Strategy

- API memory/optional Redis cache responses advertise one day fresh and seven
  days stale-while-revalidate.
- Browser IndexedDB caches only successful same-origin proxy responses.
- Browser entries accept the same raster types, cap each image at 8 MiB, expire
  after 30 days, and are trimmed least-recently-used to at most 500 entries and
  100 MiB total.
- Clearing local app data removes the poster cache. A cache miss or expired
  entry never authorizes a direct external request.

## Failure Placeholder

A blocked URL, proxy error, unsupported content type, decode error, or expired
cache entry uses the existing deterministic local poster/card placeholder. The
placeholder contains no remote resource and preserves the surrounding layout.

## Verification

Run the smallest policy and rendering tests first:

```bash
npm run test --workspace @work-archive/web -- --run \
  src/shared/utils/image-proxy.test.ts \
  src/shared/components/ArtworkPoster.test.tsx \
  src/shared/services/poster-image-cache.test.ts \
  src/features/tier-boards/components/TierBoardCanvas.test.tsx
npm run qa:image-proxy-policy
```

Changes to proxy URL parsing, network resolution, redirects, content type,
cache behavior, or logging must also run the API proxy suites selected by
`npm run qa:image-proxy-policy` and the repository completion gates.

## CSP Status

The runtime behavior is private-first now, but the enforced production CSP
still contains broad `img-src https:` compatibility. Removing it remains an
operational rollout: staging report-only telemetry and production-mode browser
coverage must pass before the header is tightened. Until that evidence exists,
CSP narrowing is pending and must not be reported as PASS.
