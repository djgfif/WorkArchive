import type {
  AuthRefreshSessionsResponse,
  AuthSessionResponse as SharedAuthSessionResponse,
  UpdateAuthProfileRequest,
  AuthUserResponse,
} from '@work-archive/shared-types';

import {
  ApiRequestError,
  getApiBaseUrl,
  requestApi,
  requestApiJson,
  requestAuthenticatedApi,
  requestAuthenticatedApiJson,
} from '../../../shared/services/api-client';
import {
  clearLegacyStoredAuthTokens,
  type MemoryAuthTokens,
} from './auth-storage';

interface RestoredSession {
  tokens: MemoryAuthTokens;
  user: AuthUserResponse;
}

const REFRESH_UNAVAILABLE_UNTIL_KEY =
  'work-archive.auth.refreshUnavailableUntil';
const REFRESH_UNAVAILABLE_TTL_MS = 60_000;

interface GoogleAuthStatusResponse {
  configured: boolean;
}

interface RestoreStoredSessionOptions {
  force?: boolean;
}

export type AuthSessionResponse = SharedAuthSessionResponse;
export type AuthRefreshSessions = AuthRefreshSessionsResponse;
export type AuthUser = AuthUserResponse;

export {
  ApiRequestError,
  getApiBaseUrl,
  requestApiJson,
  requestAuthenticatedApi,
  requestAuthenticatedApiJson,
};

export async function refreshSession() {
  return requestApiJson<AuthSessionResponse>('/auth/refresh', {
    method: 'POST',
  });
}

export async function fetchCurrentUser(accessToken: string) {
  return requestApiJson<AuthUser>(
    '/auth/me',
    {
      method: 'GET',
    },
    accessToken,
  );
}

export async function updateAuthProfile(input: UpdateAuthProfileRequest) {
  return requestAuthenticatedApiJson<AuthUser>('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function logoutSession() {
  await requestApi('/auth/logout', {
    method: 'POST',
  });
}

export async function fetchAuthSessions() {
  return requestAuthenticatedApiJson<AuthRefreshSessions>('/auth/sessions', {
    method: 'GET',
  });
}

export async function revokeAuthSession(sessionId: string) {
  await requestAuthenticatedApi(`/auth/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

export async function revokeAllAuthSessions() {
  await requestAuthenticatedApi('/auth/sessions/revoke-all', {
    method: 'POST',
  });
}

export function getGoogleLoginStartUrl() {
  return `${getApiBaseUrl()}/auth/google/start`;
}

export async function fetchGoogleAuthStatus() {
  return requestApiJson<GoogleAuthStatusResponse>('/auth/google/status', {
    method: 'GET',
  });
}

function getRefreshUnavailableUntil() {
  if (typeof window === 'undefined') {
    return 0;
  }

  const rawValue = window.sessionStorage.getItem(
    REFRESH_UNAVAILABLE_UNTIL_KEY,
  );
  const parsedValue = Number.parseInt(rawValue ?? '', 10);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function markRefreshUnavailable() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(
    REFRESH_UNAVAILABLE_UNTIL_KEY,
    String(Date.now() + REFRESH_UNAVAILABLE_TTL_MS),
  );
}

function clearRefreshUnavailable() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(REFRESH_UNAVAILABLE_UNTIL_KEY);
}

export async function restoreStoredSession(
  options: RestoreStoredSessionOptions = {},
): Promise<RestoredSession | null> {
  clearLegacyStoredAuthTokens();

  if (!options.force && Date.now() < getRefreshUnavailableUntil()) {
    return null;
  }

  try {
    const { response, responseBody: session } =
      await requestApi<AuthSessionResponse>('/auth/refresh', {
        method: 'POST',
      });

    if (response.status === 204) {
      markRefreshUnavailable();
      return null;
    }

    if (session === null) {
      markRefreshUnavailable();
      return null;
    }

    const nextTokens = {
      accessToken: session.accessToken,
    };

    clearRefreshUnavailable();

    return {
      tokens: nextTokens,
      user: session.user,
    };
  } catch {
    clearLegacyStoredAuthTokens();
    markRefreshUnavailable();
    return null;
  }
}
