# OAuth Policy

Status: Gate 1 policy baseline.
Last reviewed: 2026-06-25.

Google OAuth is the only account login path for Work Archive. Legacy
email/password endpoints remain disabled, and guest usage remains local-first.
This policy fixes the backend OAuth invariants that must stay true before public
beta and commercial operation.

## Runtime Contract

- `POST /api/auth/register` and `POST /api/auth/login` must return `410 Gone`.
- `GET /api/auth/google/start` must store only a generated flow id in the
  browser cookie. Raw OAuth `state` and `nonce` values must not be exposed as
  cookies.
- OAuth state and nonce values must be generated with `generateOAuthSecret`,
  hashed with `hashSecret`, stored through `GoogleOAuthFlowStoreService`, and
  consumed once through `consumeGoogleOAuthFlow`.
- `return_origin` may only redirect to `WEB_BASE_URL` or an origin present in
  `CORS_ORIGIN`; untrusted, malformed, empty, or non-http(s) origins must fall
  back to `WEB_BASE_URL`.
- OAuth callback failures must record bounded `auth.login.failure` reasons
  without OAuth codes, cookies, API keys, access tokens, refresh tokens, or ID
  tokens.
- Google token exchange and JWKS fetch failures must not log authorization
  codes or token material.
- OAuth cookies must remain `HttpOnly`, scoped to `/api/auth/google`, and
  `SameSite=Lax`; production `COOKIE_SECURE=true` adds the `Secure` attribute.
- `scripts/deploy/beta-smoke.sh` must verify that `/api/auth/google/start`
  preserves the OAuth flow cookie attributes through the deployed proxy and
  does not expose raw state or nonce cookies.

## Release Gate

Run this check before public beta approval and after changing auth controllers,
Google OAuth helper logic, OAuth flow storage, CORS/public URL config, or auth
logging:

```bash
npm run qa:oauth-policy
```

The gate verifies controller behavior, helper invariants, deployed-proxy smoke
coverage, regression tests, documentation, and commercial Gate 1 wiring.
