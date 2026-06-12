# ADR 0002: Google-Only Auth

## Status

Accepted

## Context

Work Archive previously carried routes and concepts for email/password auth, but the current operating model is Google OAuth only. Reducing auth modes lowers account recovery complexity, password storage risk, session branching, and support load.

## Decision

Use Google OAuth as the only login and account creation path.

- Do not restore email/password login.
- Keep legacy email/password entry points disabled. Server password-reset APIs
  stay removed; compatibility UI routes should guide users to Google OAuth.
- Treat OAuth code, OAuth token, refresh token, and session cookie values as secrets.
- Maintain guest/local archive mode separately from authenticated Google accounts.

## Alternatives

- Email/password plus Google OAuth: rejected because it expands credential handling and recovery risk.
- Magic link auth: deferred because it introduces email delivery operations.
- Anonymous server accounts: rejected because local guest mode already covers unauthenticated use.

## Consequences

- Google OAuth redirect URI configuration is release-critical.
- Auth session contract tests must cover the Google-authenticated and guest states.
- Support documentation should explain that local export remains available without account login.
