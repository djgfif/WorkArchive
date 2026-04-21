import type { CookieOptions } from 'express';

import { readApiRuntimeConfig } from '../../config/api-runtime-config';

export const REFRESH_TOKEN_COOKIE_NAME = 'work_archive_refresh_token';
const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function getRefreshTokenCookieOptions(): CookieOptions {
  const config = readApiRuntimeConfig();

  return {
    httpOnly: true,
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/api/auth',
    sameSite: 'lax',
    secure: config.cookieSecure,
  };
}
