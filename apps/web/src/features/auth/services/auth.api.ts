import {
  clearStoredAuthTokens,
  readStoredAuthTokens,
  writeStoredAuthTokens,
  type StoredAuthTokens,
} from './auth-storage';
import { localizeApiErrorMessage } from '../../../shared/utils/localize-message';

const DEFAULT_API_BASE_URL = 'http://localhost:3000/api';

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
}

export interface AuthCredentialsInput {
  email: string;
  password: string;
}

export interface AuthSessionResponse {
  accessToken: string;
  user: AuthUser;
}

interface ApiErrorBody {
  message?: string | string[];
}

interface RestoredSession {
  tokens: StoredAuthTokens;
  user: AuthUser;
}

interface AuthenticatedRequestOptions {
  missingTokenMessage?: string;
}

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

export function getApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  return (configuredBaseUrl || DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

function getApiErrorMessage(status: number, body: ApiErrorBody | null) {
  if (Array.isArray(body?.message)) {
    return localizeApiErrorMessage(status);
  }

  if (typeof body?.message === 'string') {
    return localizeApiErrorMessage(status, body.message);
  }

  return localizeApiErrorMessage(status);
}

async function readJsonBody<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function requestApi<TResponse>(
  path: string,
  init: RequestInit,
  accessToken?: string,
) {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
  const responseBody = await readJsonBody<TResponse & ApiErrorBody>(response);

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      getApiErrorMessage(response.status, responseBody),
    );
  }

  return {
    response,
    responseBody,
  };
}

export async function requestApiJson<TResponse>(
  path: string,
  init: RequestInit,
  accessToken?: string,
): Promise<TResponse> {
  const { response, responseBody } = await requestApi<TResponse>(
    path,
    init,
    accessToken,
  );

  if (responseBody === null) {
    throw new ApiRequestError(
      response.status,
      '서버 응답을 확인할 수 없습니다.',
    );
  }

  return responseBody;
}

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

async function refreshStoredTokens() {
  try {
    const refreshedSession = await refreshSession();
    const nextTokens = {
      accessToken: refreshedSession.accessToken,
    };

    writeStoredAuthTokens(nextTokens);

    return nextTokens;
  } catch (error) {
    clearStoredAuthTokens();
    throw error;
  }
}

export async function requestAuthenticatedApiJson<TResponse>(
  path: string,
  init: RequestInit,
  options: AuthenticatedRequestOptions = {},
): Promise<TResponse> {
  const storedTokens = readStoredAuthTokens();

  if (!storedTokens) {
    throw new ApiRequestError(
      401,
      options.missingTokenMessage ?? '로그인 후 이용해주세요.',
    );
  }

  try {
    return await requestApiJson<TResponse>(path, init, storedTokens.accessToken);
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401) {
      throw error;
    }
  }

  const refreshedTokens = await refreshStoredTokens();

  try {
    return await requestApiJson<TResponse>(path, init, refreshedTokens.accessToken);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      clearStoredAuthTokens();
    }

    throw error;
  }
}

export async function restoreStoredSession(): Promise<RestoredSession | null> {
  const storedTokens = readStoredAuthTokens();

  if (!storedTokens) {
    return null;
  }

  try {
    const user = await requestAuthenticatedApiJson<AuthUser>('/auth/me', {
      method: 'GET',
    });
    const nextTokens = readStoredAuthTokens() ?? storedTokens;

    return {
      tokens: nextTokens,
      user,
    };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      clearStoredAuthTokens();
    }

    return null;
  }

  return null;
}
