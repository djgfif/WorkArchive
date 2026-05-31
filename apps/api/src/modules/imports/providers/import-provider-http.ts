import {
  BadGatewayException,
  ForbiddenException,
} from '@nestjs/common';
import type { WorkType } from '@prisma/client';

import type { ImportProvider } from '../imports.constants';
import type { ProviderRuntimeStateService } from '../runtime/provider-runtime-state.service';
import {
  DEFAULT_PROVIDER_TIMEOUT_MS,
  PROVIDER_CACHE_TTL_MS,
} from './import-provider-config';

export interface ImportProviderFetchOptions {
  accept: string;
  bearerPrefix?: string;
  bearerToken?: string;
  body?: string;
  cacheKey?: string;
  cacheTtlMs?: number;
  contentType?: string;
  headers?: Record<string, string>;
  method?: string;
  queryApiKey?: string;
  retryAfterMaxMs?: number;
  timeoutMs?: number;
}

export async function fetchImportProviderJson(
  providerRuntimeState: ProviderRuntimeStateService,
  rawUrl: URL | string,
  options: ImportProviderFetchOptions,
) {
  const url = rawUrl instanceof URL ? rawUrl : new URL(rawUrl);
  const cachedResponse = await providerRuntimeState.readCache(options.cacheKey);

  if (cachedResponse !== undefined) {
    return cachedResponse;
  }

  if (options.queryApiKey) {
    url.searchParams.set('api_key', options.queryApiKey);
  }

  const headers: Record<string, string> = {
    accept: options.accept,
    ...options.headers,
  };

  if (options.contentType) {
    headers['content-type'] = options.contentType;
  }

  if (options.bearerToken) {
    headers.authorization = `${options.bearerPrefix ?? 'Bearer'} ${options.bearerToken}`;
  }

  let response: Response;

  try {
    response = await fetchWithTimeout(url, {
      body: options.body,
      headers,
      method: options.method ?? 'GET',
      timeoutMs: options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS,
    });

    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));

      if (
        retryAfterMs !== null &&
        retryAfterMs <= (options.retryAfterMaxMs ?? 0)
      ) {
        await delay(retryAfterMs);
        response = await fetchWithTimeout(url, {
          body: options.body,
          headers,
          method: options.method ?? 'GET',
          timeoutMs: options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS,
        });
      }
    }
  } catch {
    throw new BadGatewayException(
      'Import provider is temporarily unavailable.',
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new ForbiddenException('Import provider credentials were rejected.');
  }

  if (!response.ok) {
    throw new BadGatewayException(
      'Import provider returned an upstream error.',
    );
  }

  try {
    const responseBody = await response.json();

    await providerRuntimeState.writeCache(
      options.cacheKey,
      responseBody,
      options.cacheTtlMs ?? PROVIDER_CACHE_TTL_MS,
    );

    return responseBody;
  } catch {
    throw new BadGatewayException(
      'Import provider returned an unreadable response.',
    );
  }
}

export function getImportProviderCacheKey(input: {
  limit: number;
  mediumType: WorkType | undefined;
  provider: ImportProvider;
  query: string;
  userScope?: string | null;
  variant?: string;
}) {
  return [
    input.provider,
    input.mediumType ?? 'all',
    input.limit.toString(),
    input.userScope ?? 'public',
    (input.variant ?? '').trim().toLowerCase(),
    input.query.normalize('NFKC').trim().toLowerCase(),
  ].join(':');
}

async function fetchWithTimeout(
  url: URL,
  input: {
    body: string | undefined;
    headers: Record<string, string>;
    method: string;
    timeoutMs: number;
  },
) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), input.timeoutMs);
  const requestInit: RequestInit = {
    headers: input.headers,
    method: input.method,
    signal: abortController.signal,
  };

  if (input.body !== undefined) {
    requestInit.body = input.body;
  }

  try {
    return await fetch(url, requestInit);
  } finally {
    clearTimeout(timeout);
  }
}

function parseRetryAfterMs(value: string | null) {
  if (!value) {
    return null;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1_000);
  }

  const dateMs = Date.parse(value);

  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return null;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
