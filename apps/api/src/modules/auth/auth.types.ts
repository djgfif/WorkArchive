export type AuthTokenKind = 'access' | 'refresh';
export const AUTH_JWT_ALGORITHM = 'HS256' as const;
export const AUTH_JWT_AUDIENCE = 'work-archive-web';
export const AUTH_JWT_ISSUER = 'work-archive-api';
export const AUTH_ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
export const AUTH_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
export const AUTH_JWT_CLOCK_SKEW_SECONDS = 60;
const AUTH_JWT_IDENTIFIER_CLAIM_PATTERN = /^[A-Za-z0-9_-]+$/;
const AUTH_JWT_EMAIL_CLAIM_MAX_LENGTH = 320;
const AUTH_JWT_IDENTIFIER_CLAIM_MAX_LENGTH = 128;

export function hasRequiredAuthJwtClaims(payload: {
  exp?: unknown;
  iat?: unknown;
  jti?: unknown;
}) {
  return (
    typeof payload.exp === 'number' &&
    typeof payload.iat === 'number' &&
    typeof payload.jti === 'string' &&
    isSafeAuthTokenIdentifierClaim(payload.jti)
  );
}

export function hasExpectedAuthTokenKindClaims(
  payload: object,
  type: AuthTokenKind,
) {
  const maybeRememberedPayload = payload as { rememberMe?: unknown };

  return type === 'access'
    ? !('rememberMe' in payload)
    : typeof maybeRememberedPayload.rememberMe === 'boolean';
}

export function hasExpectedAuthTemporalClaims(
  payload: {
    exp?: unknown;
    iat?: unknown;
  },
  type: AuthTokenKind,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') {
    return false;
  }

  const maxLifetimeSeconds =
    type === 'access'
      ? AUTH_ACCESS_TOKEN_TTL_SECONDS
      : AUTH_REFRESH_TOKEN_TTL_SECONDS;

  return (
    Number.isSafeInteger(payload.exp) &&
    Number.isSafeInteger(payload.iat) &&
    payload.exp > payload.iat &&
    payload.exp - payload.iat <= maxLifetimeSeconds &&
    payload.iat <= nowSeconds + AUTH_JWT_CLOCK_SKEW_SECONDS &&
    payload.exp <=
      nowSeconds + maxLifetimeSeconds + AUTH_JWT_CLOCK_SKEW_SECONDS
  );
}

export function hasExpectedAuthIdentityClaims(payload: {
  email?: unknown;
  sid?: unknown;
  sub?: unknown;
}) {
  return (
    isSafeAuthTokenIdentifierClaim(payload.sub) &&
    isSafeAuthTokenIdentifierClaim(payload.sid) &&
    isSafeAuthTokenEmailClaim(payload.email)
  );
}

function isSafeAuthTokenIdentifierClaim(value: unknown) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= AUTH_JWT_IDENTIFIER_CLAIM_MAX_LENGTH &&
    AUTH_JWT_IDENTIFIER_CLAIM_PATTERN.test(value)
  );
}

function isSafeAuthTokenEmailClaim(value: unknown) {
  return (
    typeof value === 'string' &&
    value.length > 2 &&
    value.length <= AUTH_JWT_EMAIL_CLAIM_MAX_LENGTH &&
    !hasWhitespaceOrControlCharacter(value) &&
    value.includes('@')
  );
}

function hasWhitespaceOrControlCharacter(value: string) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);

    if (
      codePoint === undefined ||
      codePoint <= 0x20 ||
      codePoint === 0x7f
    ) {
      return true;
    }
  }

  return false;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  sid: string;
  type: AuthTokenKind;
  rememberMe?: boolean;
}

export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
}
