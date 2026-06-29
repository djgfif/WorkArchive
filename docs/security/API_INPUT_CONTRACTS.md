# API Input Contracts

Status: Gate 1 policy baseline.

This document defines the API input-validation boundary that must stay true for
backend commercial-readiness work. It complements
[`API_AUTHORIZATION_SURFACE.md`](./API_AUTHORIZATION_SURFACE.md): auth controls
decide who can call a route, and input contracts decide what shape a route may
accept after authorization.

## Runtime Contract

- `apps/api/src/configure-app.ts` must keep a global ValidationPipe with
  `forbidNonWhitelisted: true`, `transform: true`, `validationError.target:
  false`, `validationError.value: false`, and `whitelist: true`. Unknown DTO
  fields should fail with `400` instead of being silently stripped, and
  validation errors must not echo submitted raw values back to the client.
- `apps/api/src/security/security-middleware.ts` must keep the request target
  length guard before controller handling. Overlong path/query request targets
  fail with `414`, include `requestId`, and must not echo raw query strings in
  the response or security audit metadata.
- Body parser failures before DTO validation must stay sanitized: malformed JSON
  fails with `400`, oversized request bodies fail with `413`, and neither
  response may echo raw body text.
- Unsafe `/api/*` requests that declare a non-empty body must use a supported
  request body media type. The current supported set is `application/json` and
  `application/x-www-form-urlencoded`; unsupported types fail with sanitized
  `415` responses and `http.unsupported_media_type` audit events. Unsafe
  requests without a body may omit `Content-Type`.
- Request body DTOs on controllers must use named `*Dto` classes and must be
  documented with nearby `@ApiBody({ type: ... })` metadata.
- Query objects accepted through `@Query()` must use named `*Dto` classes.
- The sync payload validation layer must keep `whitelist: true` and
  `forbidNonWhitelisted: true` in
  `apps/api/src/modules/sync/services/sync-payload-validation.service.ts`.
- Route params that represent ids should use `ParseUUIDPipe`; provider ids are
  the current named-string exception and are validated by provider allowlists.

## Provider Credential Exception

`apps/api/src/modules/imports/imports.controller.ts` intentionally receives the
provider credential payloads as `unknown` for:

- `saveAladinKey(..., @Body() upsertAladinKeyDto: unknown)`
- `saveProviderKey(..., @Body() upsertProviderKeyDto: unknown)`

This is the only current provider credential exception. The controller still
advertises `UpsertAladinKeyDto` or `UpsertProviderKeyDto` with `@ApiBody`, then
passes the raw value through `resolveProviderCredentialValuesFromPayload` so
provider-specific credential names can be normalized in one place before
storage.

Do not add another `unknown`, `any`, or broad object body contract without a
documented exception and a validator update.

## Release Gate

Run this check before public beta approval and after adding or changing API
controllers:

```bash
npm run qa:api-input-contracts
```

The gate fails when the global pipe stops rejecting unknown DTO fields, starts
echoing validation target/value data, the request target length guard is
removed, body parser failures stop using sanitized JSON, a controller body stops
using a named DTO, unsupported body media types stop returning sanitized `415`
responses, a body DTO loses Swagger metadata, a query object is no longer typed
as a DTO, the sync strict payload validator is weakened, or the provider
credential exception drifts.
