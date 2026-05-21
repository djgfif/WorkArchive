import type {
  AuthRefreshSessionsResponse,
  PasswordResetConfirmResponse,
  PasswordResetRequestResponse,
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

interface GoogleAuthStatusResponse {
  configured: boolean;
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

export async function requestPasswordReset(email: string) {
  return requestApiJson<PasswordResetRequestResponse>(
    '/auth/password-reset/request',
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    },
  );
}

export async function confirmPasswordReset(input: {
  password: string;
  token: string;
}) {
  return requestApiJson<PasswordResetConfirmResponse>(
    '/auth/password-reset/confirm',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function restoreStoredSession(): Promise<RestoredSession | null> {
  clearLegacyStoredAuthTokens();

  try {
    const session = await refreshSession();
    const nextTokens = {
      accessToken: session.accessToken,
    };

    return {
      tokens: nextTokens,
      user: session.user,
    };
  } catch {
    clearLegacyStoredAuthTokens();
    return null;
  }
}
