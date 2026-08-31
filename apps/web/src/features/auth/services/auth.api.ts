import type {
  AuthRefreshSessionsResponse,
  AuthSessionResponse as SharedAuthSessionResponse,
  UpdateAuthProfileRequest,
  AuthUserResponse,
} from '@work-archive/shared-types';

import {
  AUTH_REFRESH_TIMEOUT_MS,
  ApiRequestError,
  getApiBaseUrl,
  requestApi,
  requestApiJson,
  requestAuthenticatedApi,
  requestAuthenticatedApiJson,
} from '@shared/services/api-client';
import {
  clearLegacyStoredAuthTokens,
  type MemoryAuthTokens,
} from './auth-storage';

export type RestoreStoredSessionResult =
  | {
      status: 'authenticated';
      tokens: MemoryAuthTokens;
      user: AuthUserResponse;
    }
  | {
      status: 'expired';
    }
  | {
      reason: 'network' | 'server';
      status: 'unavailable';
    };

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
    timeoutMs: AUTH_REFRESH_TIMEOUT_MS,
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

export function getGoogleLoginStartUrl(returnOrigin?: string) {
  const baseOrigin = getGoogleLoginStartBaseOrigin(returnOrigin);
  const startUrl = new URL(
    `${getApiBaseUrl()}/auth/google/start`,
    baseOrigin,
  );

  if (returnOrigin) {
    startUrl.searchParams.set('return_origin', returnOrigin);
  }

  return startUrl.toString();
}

function getGoogleLoginStartBaseOrigin(returnOrigin?: string) {
  if (!returnOrigin) {
    return window.location.origin;
  }

  try {
    return new URL(returnOrigin).origin;
  } catch {
    return window.location.origin;
  }
}

export async function fetchGoogleAuthStatus() {
  return requestApiJson<GoogleAuthStatusResponse>('/auth/google/status', {
    method: 'GET',
  });
}


export async function restoreStoredSession(
  options: RestoreStoredSessionOptions = {},
): Promise<RestoreStoredSessionResult> {
  clearLegacyStoredAuthTokens();

  try {
    const { response, responseBody: session } =
      await requestApi<AuthSessionResponse>('/auth/refresh', {
        method: 'POST',
        timeoutMs: AUTH_REFRESH_TIMEOUT_MS,
      });

    if (response.status === 204 || session === null) {
      return {
        status: 'expired',
      };
    }

    const nextTokens = {
      accessToken: session.accessToken,
    };

    return {
      status: 'authenticated',
      tokens: nextTokens,
      user: session.user,
    };
  } catch (error) {
    clearLegacyStoredAuthTokens();

    if (options.force) {
      throw error;
    }

    if (error instanceof ApiRequestError) {
      if (error.status === 401 || error.status === 403) {
        return {
          status: 'expired',
        };
      }

      if (error.status === 0) {
        return {
          reason: 'network',
          status: 'unavailable',
        };
      }
    }

    return {
      reason: 'server',
      status: 'unavailable',
    };
  }
}
