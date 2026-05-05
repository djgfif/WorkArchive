import type {
  AuthCredentialsRequest,
  AuthSessionResponse as SharedAuthSessionResponse,
  AuthUserResponse,
  PasswordResetConfirmResponse as SharedPasswordResetConfirmResponse,
  PasswordResetRequestResponse as SharedPasswordResetRequestResponse,
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
  clearStoredAuthTokens,
  type MemoryAuthTokens,
  writeStoredAuthTokens,
} from './auth-storage';

interface RestoredSession {
  tokens: MemoryAuthTokens;
  user: AuthUserResponse;
}

export type AuthCredentialsInput = AuthCredentialsRequest;
export type AuthSessionResponse = SharedAuthSessionResponse;
export type AuthUser = AuthUserResponse;
export type PasswordResetConfirmResponse = SharedPasswordResetConfirmResponse;
export type PasswordResetRequestResponse = SharedPasswordResetRequestResponse;

export {
  ApiRequestError,
  getApiBaseUrl,
  requestApiJson,
  requestAuthenticatedApi,
  requestAuthenticatedApiJson,
};

export async function registerWithEmailPassword(
  input: AuthCredentialsInput,
) {
  return requestApiJson<AuthSessionResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function loginWithEmailPassword(input: AuthCredentialsInput) {
  return requestApiJson<AuthSessionResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function requestPasswordReset(email: string) {
  return requestApiJson<PasswordResetRequestResponse>('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({
      email,
    }),
  });
}

export async function confirmPasswordReset(input: {
  password: string;
  token: string;
}) {
  return requestApiJson<PasswordResetConfirmResponse>('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

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

export async function logoutSession() {
  await requestApi('/auth/logout', {
    method: 'POST',
  });
}

export async function restoreStoredSession(): Promise<RestoredSession | null> {
  clearLegacyStoredAuthTokens();

  try {
    const session = await refreshSession();
    const nextTokens = {
      accessToken: session.accessToken,
    };

    writeStoredAuthTokens(nextTokens);

    return {
      tokens: nextTokens,
      user: session.user,
    };
  } catch {
    clearStoredAuthTokens();
    return null;
  }
}
