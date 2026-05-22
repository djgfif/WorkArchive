import { BadGatewayException } from '@nestjs/common';

export class ExternalFetchError extends Error {
  constructor(
    message: string,
    readonly code: 'timeout' | 'network' | 'body_too_large' | 'invalid_json',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ExternalFetchError';
  }
}

export interface ExternalFetchOptions extends RequestInit {
  timeoutMs: number;
}

export async function fetchExternal(
  url: URL | string,
  options: ExternalFetchOptions,
) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), options.timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: abortController.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ExternalFetchError('External request timed out.', 'timeout');
    }

    throw new ExternalFetchError('External request failed.', 'network');
  } finally {
    clearTimeout(timeout);
  }
}

export async function readJsonWithLimit<T>(
  response: Response,
  maxBytes: number,
): Promise<T> {
  const contentLength = response.headers.get('content-length');
  const parsedLength = contentLength ? Number(contentLength) : null;

  if (
    parsedLength !== null &&
    Number.isFinite(parsedLength) &&
    parsedLength > maxBytes
  ) {
    throw new ExternalFetchError(
      'External response body is too large.',
      'body_too_large',
      response.status,
    );
  }

  const body = await response.arrayBuffer();

  if (body.byteLength > maxBytes) {
    throw new ExternalFetchError(
      'External response body is too large.',
      'body_too_large',
      response.status,
    );
  }

  try {
    return JSON.parse(new TextDecoder().decode(body)) as T;
  } catch {
    throw new ExternalFetchError(
      'External response body is not valid JSON.',
      'invalid_json',
      response.status,
    );
  }
}

export function toUpstreamUnavailableException() {
  return new BadGatewayException('External provider is temporarily unavailable.');
}
