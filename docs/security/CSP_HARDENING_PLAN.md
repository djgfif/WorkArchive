# CSP Hardening Plan

Last reviewed: 2026-05-31.

The enforced production CSP in `apps/web/nginx.conf` must not be tightened until
report-only telemetry and browser coverage show that the UI and imported images
continue to work.

Current enforced header:

```text
default-src 'self'; connect-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
```

## Current Exceptions

| Directive | Why it remains | Risk |
| --- | --- | --- |
| `style-src 'self' 'unsafe-inline'` | The current React/Mantine UI still depends on runtime inline style attributes and injected style blocks. Removing it now can break layouts, modals, and component styling. | If an HTML injection bug appears, inline style execution gives an attacker more presentation control and can assist UI redress or data exfiltration through CSS side channels. |
| `style-src https://cdn.jsdelivr.net https://fonts.googleapis.com`; `font-src https://cdn.jsdelivr.net https://fonts.gstatic.com` | The production HTML loads Pretendard from jsDelivr and display/mono fonts from Google Fonts. These hosts must match `apps/web/index.html` until fonts are self-hosted. | Third-party font styles and font files reveal page-load metadata to those providers and add external availability dependencies. |
| `img-src 'self' data: https:` | The app displays imported catalog covers and user-entered poster URLs from multiple external HTTPS providers. Placeholders may use `data:`. | Arbitrary HTTPS image hosts can receive request metadata and can be abused for tracking; SVG or mislabeled images can increase parser attack surface if not proxied and type-checked. |

## Report-Only Rollout

1. Keep the current enforced CSP unchanged.
2. Add a `Content-Security-Policy-Report-Only` header in staging first with the
   next candidate policy.
3. Collect reports for at least one full beta test window covering:
   - login and Google callback completion;
   - works list, detail, create, edit, and trash views;
   - import search candidate previews;
   - tier board list and editor image rendering;
   - offline/local-first reload flows.
4. Promote only directives with zero known false positives, or document each
   false positive with the owning component and removal plan.

Candidate report-only policy:

```text
default-src 'self'; connect-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; report-to work-archive-csp; report-uri /api/security/csp-report
```

## Report Endpoint Candidates

Preferred endpoint:

- `POST /api/security/csp-report`
- unauthenticated;
- accepts only CSP report JSON up to a small body limit;
- rate limited separately from auth and sync;
- stores summarized fields only: blocked URI origin, violated directive,
  effective directive, document URI origin/path, disposition, user agent hash,
  request id if present;
- never stores full URLs with query strings.

Fallback during staging:

- nginx access log sampling for report-only violation posts to an internal
  collector;
- external report collector only if data processing and retention terms are
  approved.

## Removing `unsafe-inline`

1. Inventory inline style usage from Mantine and local components.
2. Prefer component/library configuration or build output that avoids inline
   styles where practical.
3. If nonce or hash support is used, implement it end to end in nginx/API HTML
   delivery first; do not mix static `index.html` caching with per-request
   nonces without a full delivery design.
4. Run Playwright smoke coverage and visual checks against the report-only
   policy.
5. Remove `'unsafe-inline'` from report-only first, then enforced CSP in a later
   release.

## Self-Hosting Fonts

1. Add license-compatible font assets to the web build or a documented asset
   package.
2. Replace external stylesheet links in `apps/web/index.html` with local
   `@font-face` declarations.
3. Remove `cdn.jsdelivr.net`, `fonts.googleapis.com`, and `fonts.gstatic.com`
   from the enforced CSP after Playwright visual checks pass in production mode.

## Image Proxy / Allowlist Transition

1. Measure how often web rendering uses `/api/image-proxy` versus direct HTTPS
   fallback.
2. Harden the proxy plan in `docs/security/IMAGE_PROXY_PLAN.md`, especially
   HTTPS-only upstreams and private IP rejection.
3. Move known provider hosts behind the proxy and remove direct HTTPS fallback
   after coverage is proven.
4. Narrow `img-src` toward:

```text
img-src 'self' data:
```

5. Keep any direct provider exceptions temporary, listed, and dated.
