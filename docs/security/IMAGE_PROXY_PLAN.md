# Image Proxy / Allowlist Plan

Last reviewed: 2026-05-25.

Work Archive already has a first-pass `/api/image-proxy` path for known cover
providers. This document defines the hardening target before CSP `img-src` is
narrowed. It does not authorize a new implementation in this step.

## Risk Model

External cover and poster URLs can create:

- browser tracking through arbitrary third-party image hosts;
- mixed-content or downgrade pressure if HTTP images are rendered directly;
- SSRF risk if the API fetches user-provided URLs without host, scheme, DNS, and
  redirect controls;
- DNS rebinding or redirect-to-private-address attacks;
- oversized response memory pressure;
- content-type confusion and SVG script/parser risks;
- cache poisoning if URL normalization and cache keys are inconsistent;
- secret leakage if upstream URLs with query credentials are logged.

## Current State

Current code evidence:

- API route: `apps/api/src/modules/image-proxy/image-proxy.controller.ts`.
- Proxy service: `apps/api/src/modules/image-proxy/image-proxy.service.ts`.
- Web URL selection: `apps/web/src/shared/utils/image-proxy.ts`.

Implemented now:

- provider host suffix allowlist;
- HTTPS-only upstream URLs;
- DNS resolution with localhost, private, reserved, and IPv4-mapped private IPv6
  address rejection before fetch and after redirects;
- fetch timeout;
- redirect target revalidation;
- max body size;
- `image/*` allowlist that excludes SVG;
- ETag and cache-control response headers;
- in-memory cache and optional Redis cache.

Known hardening gaps before CSP narrowing:

- allowlist changes are code changes rather than runtime-configured operations;
- report-only telemetry is needed to remove direct HTTPS image fallback safely.

## Target Requirements

The hardened proxy must enforce all of the following:

| Requirement | Target behavior |
| --- | --- |
| HTTPS only | Accept only `https://` upstream URLs. Any legacy HTTP provider must be normalized by a provider-specific trusted URL builder or rejected. |
| Localhost/private IP block | Reject localhost, loopback, link-local, RFC1918, unique-local IPv6, multicast, and metadata service ranges after DNS resolution and after every redirect. |
| Provider allowlist | Keep an explicit provider host allowlist. Prefer exact hosts where stable; allow suffixes only for providers that require subdomains. |
| Timeout | Keep a short fetch timeout, currently 5 seconds, with no unbounded retry loop. |
| Max bytes | Enforce `Content-Length` and streamed byte limits. Current cap is 8 MiB; revisit if thumbnails can be capped lower. |
| Content type | Require an allowed raster image content type such as AVIF, GIF, JPEG, PNG, or WebP. |
| SVG | Block SVG by default. Sanitization is a separate design and must not be treated as equivalent to raster image proxying. |
| Redirects | Limit redirect count and re-apply scheme, host allowlist, DNS, and private IP checks on every hop. |
| Cache-control | Return deterministic cache headers such as `public, max-age=86400, stale-while-revalidate=604800`; avoid caching failed responses. |
| Logging | Log provider host and error code only; do not log full image URLs or query strings. |

## Provider Allowlist Candidates

Start from the currently proxied provider suffixes:

- `anilist.co`
- `books.google.com`
- `covers.openlibrary.org`
- `daumcdn.net`
- `googleusercontent.com`
- `image.aladin.co.kr`
- `image.tmdb.org`
- `kakaocdn.net`
- `pstatic.net`
- `static.tvmaze.com`
- `wikimedia.org`

Each addition must include:

- provider owner;
- sample URL shape;
- whether subdomains are required;
- expected content types;
- whether direct browser fallback is still needed.

## Implementation Sequence

1. Add DNS resolution and private IP rejection to the existing proxy.
2. Change proxy validation to HTTPS-only and handle legacy provider HTTP URLs
   through explicit normalization, not generic `http:` acceptance.
3. Add focused unit tests for private IP, redirect-to-private-IP, HTTPS-only,
   SVG rejection, max bytes, and full URL logging avoidance.
4. Add staging report-only CSP telemetry for direct image loads.
5. Remove web direct HTTPS fallback for allowlisted providers after telemetry
   shows no breakage.
6. Narrow CSP `img-src` in report-only, then enforce in a later release.
