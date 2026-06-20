# Security Checklist

Use this checklist before releases that touch auth, sync, imports, tier boards, export/import, or file handling.

## Secrets and Auth

- OAuth authorization codes are never logged.
- OAuth access, ID, and refresh tokens are never logged.
- Session cookies and refresh token identifiers are redacted in logs.
- API keys are never exported in local archive JSON, tier board JSON, diagnostics, or logs.
- Google OAuth is the only account login path.
- `/work-archive-config.js` contains only non-secret runtime UI config such as feature flags.

## Ownership

- Sync payloads are scoped to the authenticated user before create, update, delete, or conflict resolution.
- Tier board card sync verifies board/lane ownership while treating source work ids as non-authoritative metadata.
- Import provider credentials are read only for the owning user.
- Guest/local archive data is not attached to an authenticated account without explicit transfer.

## Import and Export

- Local archive JSON import is schema-validated before applying changes.
- Tier board JSON import is schema-validated before applying changes.
- Unknown or future schema versions fail closed with an actionable error.
- Export files do not include secrets, cookies, provider API keys, or OAuth tokens.

## File and Content Safety

- Image upload MIME type is restricted to supported image types.
- Image upload size is capped.
- Image metadata and data URLs are not written to logs.
- User-provided text that renders in the UI is escaped or sanitized.
- HTML injection and scriptable URL inputs are rejected.

## Observability

- Structured logs redact cookie, authorization, token, code, and API key fields.
- Provider diagnostics report readiness and reason codes without exposing raw credentials.
- Security events use stable non-secret identifiers; metadata drops sensitive
  keys, strips URL query/fragment values, redacts inline bearer/basic
  credentials, removes control characters, and caps stored string length.
