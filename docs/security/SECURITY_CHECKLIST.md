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
- Public/share/community routes stay out of Gate 1 unless
  [`PUBLIC_FEATURE_PERMISSION_BOUNDARY.md`](./PUBLIC_FEATURE_PERMISSION_BOUNDARY.md)
  is updated first with explicit opt-in semantics, BOLA coverage, and tests.

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
- Production log review uses `npm run ops:logs` redaction by default; raw
  container logs are not copied into release evidence.
- Provider diagnostics report readiness and reason codes without exposing raw credentials.
- Security events use stable non-secret identifiers; metadata drops sensitive
  keys, strips URL query/fragment values, redacts inline bearer/basic
  credentials, removes control characters, and caps stored string length.
- [`LOG_REDACTION_POLICY.md`](./LOG_REDACTION_POLICY.md) and
  `npm run qa:log-redaction-policy` stay current when logging, auth, OAuth,
  import providers, monitoring, or security audit code changes.
