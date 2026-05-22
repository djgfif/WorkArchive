import type { ApiErrorResponse, AuthSessionResponse } from '@work-archive/shared-types';

import {
  clearStoredAuthTokens,
  readStoredAuthTokens,
  writeStoredAuthTokens,
} from '../../features/auth/services/auth-storage';
import { localizeApiErrorMessage } from '../utils/localize-message';

const DEFAULT_API_BASE_URL = '/api';
const LOOPBACK_API_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

type StoredAuthTokens = NonNullable<ReturnType<typeof readStoredAuthTokens>>;

let refreshStoredTokensPromise: Promise<StoredAuthTokens> | null = null;

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

  if (
    import.meta.env.PROD &&
    configuredBaseUrl &&
    isLoopbackApiBaseUrl(configuredBaseUrl)
  ) {
    return DEFAULT_API_BASE_URL;
  }

  return (configuredBaseUrl || DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

function isLoopbackApiBaseUrl(configuredBaseUrl: string) {
  try {
    return LOOPBACK_API_HOSTS.has(new URL(configuredBaseUrl).hostname);
  } catch {
    return false;
  }
}

function getApiErrorMessage(status: number, body: ApiErrorResponse | null) {
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

function shouldSetJsonContentType(body: BodyInit | null | undefined) {
  return typeof body === 'string';
}

export async function requestApi<TResponse>(
  path: string,
  init: RequestInit,
  accessToken?: string,
) {
  const headers = new Headers(init.headers);

  if (shouldSetJsonContentType(init.body) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    });
  } catch {
    throw new ApiRequestError(
      0,
      '네트워크 연결을 확인한 뒤 다시 시도해주세요.',
    );
  }
  const responseBody = await readJsonBody<TResponse & ApiErrorResponse>(response);

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

async function runRefreshStoredTokens() {
  try {
    const { response, responseBody: refreshedSession } =
      await requestApi<AuthSessionResponse>('/auth/refresh', {
        method: 'POST',
      });

    if (response.status === 204 || refreshedSession === null) {
      throw new ApiRequestError(401, '로그인 후 이용해주세요.');
    }

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

async function refreshStoredTokens() {
  if (!refreshStoredTokensPromise) {
    refreshStoredTokensPromise = runRefreshStoredTokens().finally(() => {
      refreshStoredTokensPromise = null;
    });
  }

  return refreshStoredTokensPromise;
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

export async function requestAuthenticatedApi(
  path: string,
  init: RequestInit,
  options: AuthenticatedRequestOptions = {},
): Promise<void> {
  const storedTokens = readStoredAuthTokens();

  if (!storedTokens) {
    throw new ApiRequestError(
      401,
      options.missingTokenMessage ?? '로그인 후 이용해주세요.',
    );
  }

  try {
    await requestApi<unknown>(path, init, storedTokens.accessToken);

    return;
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401) {
      throw error;
    }
  }

  const refreshedTokens = await refreshStoredTokens();

  try {
    await requestApi<unknown>(path, init, refreshedTokens.accessToken);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      clearStoredAuthTokens();
    }

    throw error;
  }
}
