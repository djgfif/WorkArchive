# Poster Privacy Threat Model

Last reviewed: 2026-07-28.

## Overview

This threat model covers poster and cover rendering in the Work Archive web
client, the same-origin image proxy, the browser poster cache, and tier-board
image previews. It protects a local-first archive against an image URL revealing
the user, the page being viewed, or archive contents to an arbitrary third
party.

The primary assets are the user's IP address and network metadata, referrer and
route information, private archive titles and browsing patterns, locally cached
poster bytes, and the API server's outbound-network capability. Availability of
remote artwork is secondary to preventing an unapproved disclosure.

## Threat Model, Trust Boundaries, and Assumptions

### Trust boundaries

1. **Archive metadata to browser renderer.** Imported, synced, searched, or
   manually entered poster URLs are attacker-controlled strings.
2. **Browser to same-origin API.** The browser may request `/api/image-proxy`,
   but must not contact the upstream image host itself.
3. **API to provider network.** The proxy crosses into an untrusted network and
   must revalidate scheme, port, allowlist, DNS results, redirects, size, and
   content type.
4. **Browser to IndexedDB.** Cached proxy responses remain local data and must be
   bounded, expirable, and removable with local app data.
5. **Tier-board local assets.** User-selected files become local `blob:` URLs;
   they do not cross the external-provider boundary.

### Security invariants

- Arbitrary external poster hosts never receive a browser request.
- An allowlisted poster has exactly one network candidate: the same-origin
  proxy URL.
- Proxy, decode, and policy failures end at a local placeholder with no upstream
  fallback.
- Poster requests carry `no-referrer` even when a future rendering path changes
  origin behavior.
- The proxy accepts only HTTPS on the default port, public-network destinations,
  bounded redirects and bytes, and explicit raster content types.
- The browser cache stores only successful same-origin proxy responses and is
  bounded by age, item size, entry count, and total bytes.

### Assumptions and out of scope

The application and API origins, release artifacts, and provider allowlist code
are trusted after review. A fully compromised same-origin application or
browser, malicious extension, host OS compromise, upstream provider account
compromise, and availability of third-party providers are out of scope. CSP
narrowing is defense in depth and remains an operationally unverified follow-up.

## Attack Surface, Mitigations, and Attacker Stories

| Attacker story                                                                                           | Impact                                                             | Mitigation and evidence                                                                                                                             | Residual risk                                                                                                       |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| An imported record contains `https://tracker.example/pixel?id=...` and the user opens the archive.       | High: IP and archive-view timing disclosure.                       | Unknown origins produce no render candidate; archive and tier-board tests assert a local placeholder and no external source.                        | A new image component could bypass the shared utility; code review and CSP narrowing reduce this risk.              |
| An allowlisted provider or network failure makes the proxy return an error, encouraging a raw URL retry. | High: the fallback would reveal the user directly to the provider. | The browser receives one proxy candidate only; component failure tests assert immediate local placeholder recovery.                                 | Poster availability may decrease during proxy outages by design.                                                    |
| A crafted proxy URL resolves or redirects to localhost, private infrastructure, or metadata services.    | Critical: server-side request forgery.                             | HTTPS/default-port allowlist, public DNS resolution before fetch and after every redirect, redirect cap, and proxy policy tests.                    | DNS and network-policy defects remain high-value review targets.                                                    |
| A provider sends SVG, mislabeled content, or an oversized body.                                          | High: parser exposure or memory pressure.                          | Explicit raster content types, `nosniff`, content-length plus streamed 8 MiB cap, and API tests.                                                    | Browser image decoder vulnerabilities are not eliminated.                                                           |
| A poster URL embeds credentials or sensitive fragments that appear in logs or cache keys.                | High: secret disclosure.                                           | Browser strips credentials/fragments before proxying; API logs provider host and safe code only; regression tests cover full URL logging avoidance. | Non-secret provider query parameters remain part of the proxy cache key but are not logged.                         |
| Long-lived local poster cache reveals old viewing history on a shared device.                            | Medium: local privacy disclosure.                                  | Thirty-day expiry, 8 MiB per item, 100 MiB/500-entry LRU bounds, and local-data deletion.                                                           | Anyone with access to the same browser profile can inspect local app data; shared-PC logout guidance still matters. |
| The broad production `img-src https:` CSP masks a future direct-image regression.                        | Medium: defense-in-depth gap.                                      | Shared rendering policy and tests are enforced now; CSP report-only rollout is documented separately.                                               | CSP tightening remains pending until staging telemetry and production-mode coverage are actually run.               |

## Severity Calibration

- **Critical:** proxy access to private/metadata networks or another primitive
  that can compromise server confidentiality or integrity.
- **High:** silent disclosure of a user's IP, referrer, archive activity, or URL
  secrets to an unapproved origin; unsafe active/parser content; unbounded body
  consumption.
- **Medium:** local shared-profile exposure, bounded storage exhaustion, or a
  defense-in-depth regression without a demonstrated disclosure.
- **Low:** poster availability or visual degradation that preserves the privacy
  invariants.

Required regression coverage lives in `image-proxy.test.ts`,
`ArtworkPoster.test.tsx`, `poster-image-cache.test.ts`,
`TierBoardCanvas.test.tsx`, and the API image-proxy policy/service suites. The
canonical commands are maintained in `IMAGE_PROXY_PLAN.md`.

Repository: 1b410fdb8fa3f043e56138cdc24c658eeab081567a160ef7eedd3d1de8dc1887
Version: ca69ab65758dcce1ad2ee7a6111b9dc56345eab0
