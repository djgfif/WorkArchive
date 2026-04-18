import {
  clearStoredAuthTokens,
  readStoredAuthTokens,
  writeStoredAuthTokens,
  type StoredAuthTokens,
} from './auth-storage';

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
  refreshToken: string;
  user: AuthUser;
}

interface ApiErrorBody {
  message?: string | string[];
}

interface RestoredSession {
  tokens: StoredAuthTokens;
  user: AuthUser;
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
    return body.message.join(' ');
  }

  if (typeof body?.message === 'string') {
    return body.message;
  }

  return `Request failed with status ${status}.`;
}

async function readJsonBody<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function requestApiJson<TResponse>(
  path: string,
  init: RequestInit,
  accessToken?: string,
): Promise<TResponse> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });
  const responseBody = await readJsonBody<TResponse & ApiErrorBody>(response);

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      getApiErrorMessage(response.status, responseBody),
    );
  }

  if (responseBody === null) {
    throw new ApiRequestError(
      response.status,
      'The server returned an empty JSON response.',
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

export async function refreshSession(refreshToken: string) {
  return requestApiJson<AuthSessionResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({
      refreshToken,
    }),
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

export async function restoreStoredSession(): Promise<RestoredSession | null> {
  const storedTokens = readStoredAuthTokens();

  if (!storedTokens) {
    return null;
  }

  try {
    const user = await fetchCurrentUser(storedTokens.accessToken);

    return {
      tokens: storedTokens,
      user,
    };
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401) {
      clearStoredAuthTokens();

      return null;
    }
  }

  try {
    const refreshedSession = await refreshSession(storedTokens.refreshToken);
    const nextTokens = {
      accessToken: refreshedSession.accessToken,
      refreshToken: refreshedSession.refreshToken,
    };

    writeStoredAuthTokens(nextTokens);

    return {
      tokens: nextTokens,
      user: refreshedSession.user,
    };
  } catch {
    clearStoredAuthTokens();

    return null;
  }
}
