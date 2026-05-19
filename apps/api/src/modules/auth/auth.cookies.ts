import type { CookieOptions } from 'express';

import { readApiRuntimeConfig } from '../../config/api-runtime-config';

export const REFRESH_TOKEN_COOKIE_NAME = 'work_archive_refresh_token';
const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

interface RefreshTokenCookieOptionsInput {
  rememberMe?: boolean;
}

export function getRefreshTokenCookieOptions({
  rememberMe = true,
}: RefreshTokenCookieOptionsInput = {}): CookieOptions {
  const config = readApiRuntimeConfig();
  const options: CookieOptions = {
    httpOnly: true,
    path: '/api/auth',
    sameSite: config.isProduction ? 'strict' : 'lax',
    secure: config.cookieSecure,
  };

  if (rememberMe) {
    options.maxAge = REFRESH_TOKEN_TTL_MS;
  }

  return options;
}

export function getRefreshTokenClearCookieOptions(): CookieOptions {
  const { maxAge: _maxAge, ...options } = getRefreshTokenCookieOptions();

  return options;
}
