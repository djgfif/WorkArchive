import type {
  ApiErrorResponse,
  AuthSessionResponse,
} from '@work-archive/shared-types';

import {
  clearStoredAuthTokens,
  readStoredAuthTokens,
  writeStoredAuthTokens,
} from './auth-token-store';
import { appI18n } from '@app/i18n';
import { localizeApiErrorMessage } from '../utils/localize-message';

const DEFAULT_DEVELOPMENT_API_BASE_URL = '/api';
const DEFAULT_PRODUCTION_API_BASE_URL = '/api';
const LOOPBACK_API_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const UNSAFE_METHODS = new Set(['DELETE', 'PATCH', 'POST', 'PUT']);
const WORK_ARCHIVE_CLIENT_HEADER = 'X-Work-Archive-Client';
export const AUTH_REFRESH_TIMEOUT_MS = 12_000;

type StoredAuthTokens = NonNullable<ReturnType<typeof readStoredAuthTokens>>;
type ApiRequestFailureKind = 'network' | 'timeout';

interface ApiRequestInit extends RequestInit {
  timeoutMs?: number;
}

interface RequestSignalOptions {
  signal: AbortSignal | null | undefined;
  timeoutMs: number | undefined;
}

interface RequestSignalState {
  cleanup: () => void;
  didTimeout: () => boolean;
  signal: AbortSignal | null;
}

let refreshStoredTokensPromise: Promise<StoredAuthTokens> | null = null;

interface AuthenticatedRequestOptions {
  missingTokenMessage?: string;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;
  readonly failureKind: ApiRequestFailureKind | null;

  constructor(
    status: number,
    message: string,
    retryAfterMs: number | null = null,
    failureKind: ApiRequestFailureKind | null = null,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.failureKind = failureKind;
  }
}

export function getApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  const defaultBaseUrl = import.meta.env.DEV
    ? DEFAULT_DEVELOPMENT_API_BASE_URL
    : DEFAULT_PRODUCTION_API_BASE_URL;

  if (configuredBaseUrl && isLoopbackApiBaseUrl(configuredBaseUrl)) {
    return defaultBaseUrl;
  }

  return (configuredBaseUrl || defaultBaseUrl).replace(/\/$/, '');
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

function isUnsafeMethod(method: string | undefined) {
  return UNSAFE_METHODS.has((method ?? 'GET').toUpperCase());
}

function parseRetryAfterMs(value: string | null) {
  if (!value) {
    return null;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.ceil(seconds * 1000);
  }

  const dateMs = Date.parse(value);

  if (!Number.isFinite(dateMs)) {
    return null;
  }

  return Math.max(0, dateMs - Date.now());
}

function readRetryAfterMs(response: Response) {
  return parseRetryAfterMs(response.headers.get('retry-after'));
}

function createRequestSignal({
  signal,
  timeoutMs,
}: RequestSignalOptions): RequestSignalState {
  if (timeoutMs === undefined) {
    return {
      didTimeout: () => false,
      signal: signal ?? null,
      cleanup: () => {},
    };
  }

  const normalizedTimeoutMs = Math.max(1, Math.floor(timeoutMs));
  const abortController = new AbortController();
  let didTimeout = false;

  function abortFromCaller() {
    abortController.abort(signal?.reason);
  }

  if (signal?.aborted) {
    abortFromCaller();
  } else {
    signal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    abortController.abort(new DOMException('Request timed out.', 'TimeoutError'));
  }, normalizedTimeoutMs);

  return {
    didTimeout: () => didTimeout,
    signal: abortController.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortFromCaller);
    },
  };
}

export async function requestApi<TResponse>(
  path: string,
  init: ApiRequestInit,
  accessToken?: string,
) {
  const { timeoutMs, signal, ...fetchInit } = init;
  const headers = new Headers(init.headers);
  const requestSignal = createRequestSignal({ signal, timeoutMs });

  if (shouldSetJsonContentType(init.body) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  if (accessToken && isUnsafeMethod(init.method)) {
    headers.set(WORK_ARCHIVE_CLIENT_HEADER, 'web');
  }

  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...fetchInit,
      credentials: 'include',
      headers,
      signal: requestSignal.signal,
    });
  } catch {
    if (requestSignal.didTimeout()) {
      throw new ApiRequestError(
        0,
        appI18n.t('api.timeoutError'),
        null,
        'timeout',
      );
    }

    throw new ApiRequestError(
      0,
      appI18n.t('api.networkError'),
      null,
      'network',
    );
  } finally {
    requestSignal.cleanup();
  }
  const responseBody = await readJsonBody<TResponse & ApiErrorResponse>(
    response,
  );

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      getApiErrorMessage(response.status, responseBody),
      readRetryAfterMs(response),
    );
  }

  return {
    response,
    responseBody,
  };
}

export async function requestApiJson<TResponse>(
  path: string,
  init: ApiRequestInit,
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
      appI18n.t('api.emptyJson'),
    );
  }

  return responseBody;
}

async function runRefreshStoredTokens() {
  try {
    const { response, responseBody: refreshedSession } =
      await requestApi<AuthSessionResponse>('/auth/refresh', {
        method: 'POST',
        timeoutMs: AUTH_REFRESH_TIMEOUT_MS,
      });

    if (response.status === 204 || refreshedSession === null) {
      throw new ApiRequestError(401, appI18n.t('api.loginRequired'));
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
  init: ApiRequestInit,
  options: AuthenticatedRequestOptions = {},
): Promise<TResponse> {
  const storedTokens = readStoredAuthTokens();

  if (!storedTokens) {
    throw new ApiRequestError(
      401,
      options.missingTokenMessage ?? appI18n.t('api.loginRequired'),
    );
  }

  try {
    return await requestApiJson<TResponse>(
      path,
      init,
      storedTokens.accessToken,
    );
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401) {
      throw error;
    }
  }

  const refreshedTokens = await refreshStoredTokens();

  try {
    return await requestApiJson<TResponse>(
      path,
      init,
      refreshedTokens.accessToken,
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      clearStoredAuthTokens();
    }

    throw error;
  }
}

export async function requestAuthenticatedApi(
  path: string,
  init: ApiRequestInit,
  options: AuthenticatedRequestOptions = {},
): Promise<void> {
  const storedTokens = readStoredAuthTokens();

  if (!storedTokens) {
    throw new ApiRequestError(
      401,
      options.missingTokenMessage ?? appI18n.t('api.loginRequired'),
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
