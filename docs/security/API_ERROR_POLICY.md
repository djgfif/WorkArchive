# API Error Response Policy

Status: Gate 1 policy baseline.
Last reviewed: 2026-06-25.

Production API errors must be useful for operators without disclosing internal
runtime details to clients. Request IDs are the correlation handle between
client-visible failures and server-side logs.

## Runtime Contract

- `apps/api/src/configure-app.ts` must register `ApiExceptionFilter` globally.
- Body parser failures before controller handling must use the API JSON error
  shape with `requestId`; malformed JSON returns `400`, oversized request
  bodies return `413`, and neither response may echo raw submitted body text.
- Unsupported request body media types on non-empty unsafe `/api/*` requests
  return sanitized `415` JSON responses and must not echo raw submitted body
  text.
- Security middleware rejections that bypass Nest exception filters, including
  CSRF guard `403`, request-target `414`, unsupported media type `415`, and
  rate-limit `429` responses, must include `requestId` in the JSON body and
  `x-request-id` response header.
- Known `HttpException` responses keep their public status/message shape, with
  `requestId` added to the JSON body.
- `/readyz` failure responses must include only safe failed `checks` names and
  `requestId`; raw dependency error text belongs in neither the response nor the
  `health.ready.failed` operator log event.
- Unexpected runtime exceptions return only `statusCode: 500`,
  `error: "Internal Server Error"`, `message: "Internal server error."`, and
  `requestId`.
- Error response bodies must not include stack traces, internal exception
  messages, credentials, provider tokens, database URLs, or filesystem paths.
- Unhandled runtime exceptions are logged server-side as the bounded
  `api.exception.unhandled` event with request ID, exception type, method, and
  sanitized path. The log entry must not include raw exception messages, stack
  frames, query strings, credentials, or filesystem paths.
- Feature-level provider errors, including partial batch results from Notion or
  other external integrations, must return stable localized failure messages and
  reason codes instead of raw provider exceptions, database errors, credentials,
  tokens, or request payload text.

## Release Gate

Run this check before public beta approval and after changing global app
middleware, exception filters, request ID handling, or controller error
contracts:

```bash
npm run qa:api-error-policy
```

The gate verifies the runtime filter wiring, focused e2e assertions, policy
documentation, body parser and request media type failure sanitization, and
direct security-middleware rejection request IDs, readiness failure request IDs,
and commercial Gate 1 wiring.
