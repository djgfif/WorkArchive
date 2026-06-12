import { randomBytes } from 'node:crypto';

import type { Request } from 'express';

import {
  readApiRuntimeConfig,
  type ApiRuntimeConfig,
} from '../../config/api-runtime-config';
import { getRequestId } from '../../security/security-audit.service';
import { verifySecret } from './auth-crypto';
import type { GoogleOAuthFlowRecord } from './google-oauth-flow-store.service';

export const GOOGLE_OAUTH_FLOW_COOKIE = 'wa_google_oauth_flow';
export const GOOGLE_OAUTH_COOKIE_MAX_AGE_MS = 1000 * 60 * 10;

export type GoogleOAuthFailureReason =
  | 'invalid_oauth_state'
  | 'missing_oauth_code'
  | 'missing_oauth_flow_cookie'
  | 'missing_oauth_state'
  | 'oauth_flow_not_found';

export type GoogleOAuthFlowConsumeResult =
  | {
      failureReason: null;
      flow: GoogleOAuthFlowRecord;
    }
  | {
      failureReason: GoogleOAuthFailureReason;
      flow: null;
    };

export function generateOAuthSecret() {
  return randomBytes(32).toString('base64url');
}

export function getGoogleOAuthCookieOptions(
  config: Pick<ApiRuntimeConfig, 'cookieSecure'> = readApiRuntimeConfig(),
) {
  return {
    httpOnly: true,
    path: '/api/auth/google',
    sameSite: 'lax' as const,
    secure: config.cookieSecure,
  };
}

export function getGoogleOAuthFlowCookieOptions(
  config: Pick<ApiRuntimeConfig, 'cookieSecure'> = readApiRuntimeConfig(),
) {
  return {
    ...getGoogleOAuthCookieOptions(config),
    maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE_MS,
  };
}

export function getAllowedOAuthReturnOrigin(
  returnOrigin: unknown,
  config: Pick<ApiRuntimeConfig, 'corsOrigin' | 'webBaseUrl'> = readApiRuntimeConfig(),
) {
  const fallbackOrigin = new URL(config.webBaseUrl).origin;

  if (typeof returnOrigin !== 'string' || returnOrigin.trim() === '') {
    return fallbackOrigin;
  }

  let requestedOrigin: string;

  try {
    const parsedOrigin = new URL(returnOrigin.trim());

    if (!['http:', 'https:'].includes(parsedOrigin.protocol)) {
      return fallbackOrigin;
    }

    requestedOrigin = parsedOrigin.origin;
  } catch {
    return fallbackOrigin;
  }

  const allowedOrigins = new Set([
    fallbackOrigin,
    ...config.corsOrigin.map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        return '';
      }
    }),
  ]);

  return allowedOrigins.has(requestedOrigin)
    ? requestedOrigin
    : fallbackOrigin;
}

export function getGoogleLoginSuccessRedirectUrl(
  returnOrigin?: unknown,
  config?: Pick<ApiRuntimeConfig, 'corsOrigin' | 'webBaseUrl'>,
) {
  const origin = getAllowedOAuthReturnOrigin(returnOrigin, config).replace(
    /\/$/,
    '',
  );

  return `${origin}/auth/google/complete`;
}

export function getGoogleLoginFailureRedirectUrl(
  reason: 'failed' | 'unconfigured',
  returnOrigin?: unknown,
  config?: Pick<ApiRuntimeConfig, 'corsOrigin' | 'webBaseUrl'>,
) {
  const origin = getAllowedOAuthReturnOrigin(returnOrigin, config).replace(
    /\/$/,
    '',
  );

  return `${origin}/auth/login?google=${reason}`;
}

export function getAuthSessionMetadata(request: Request) {
  const rawUserAgent = request.headers['user-agent'];

  return {
    ipAddress: request.ip ?? null,
    requestId: getRequestId(request),
    userAgent: Array.isArray(rawUserAgent)
      ? rawUserAgent.join(' ')
      : (rawUserAgent ?? null),
  };
}

export async function consumeGoogleOAuthFlow(
  flowId: unknown,
  state: unknown,
  consumeFlow: (flowId: string) => Promise<GoogleOAuthFlowRecord | null>,
): Promise<GoogleOAuthFlowConsumeResult> {
  if (typeof flowId !== 'string' || flowId.trim() === '') {
    return {
      failureReason: 'missing_oauth_flow_cookie',
      flow: null,
    };
  }

  if (typeof state !== 'string' || state.trim() === '') {
    return {
      failureReason: 'missing_oauth_state',
      flow: null,
    };
  }

  const flow = await consumeFlow(flowId);

  if (!flow) {
    return {
      failureReason: 'oauth_flow_not_found',
      flow: null,
    };
  }

  if (!(await verifySecret(state, flow.stateHash))) {
    return {
      failureReason: 'invalid_oauth_state',
      flow: null,
    };
  }

  return {
    failureReason: null,
    flow,
  };
}
