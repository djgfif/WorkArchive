import { BadGatewayException } from '@nestjs/common';

export class ExternalFetchError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'body_too_large'
      | 'forbidden_url'
      | 'invalid_json'
      | 'network'
      | 'timeout',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ExternalFetchError';
  }
}

export interface ExternalFetchOptions extends RequestInit {
  allowedHostnameSuffixes?: readonly string[];
  allowedHostnames?: readonly string[];
  timeoutMs: number;
}

interface ExternalFetchAllowlist {
  allowedHostnameSuffixes?: readonly string[];
  allowedHostnames?: readonly string[];
}

export async function fetchExternal(
  url: URL | string,
  options: ExternalFetchOptions,
) {
  const {
    allowedHostnameSuffixes,
    allowedHostnames,
    timeoutMs,
    ...requestOptions
  } = options;
  const allowlist: ExternalFetchAllowlist = {};

  if (allowedHostnameSuffixes !== undefined) {
    allowlist.allowedHostnameSuffixes = allowedHostnameSuffixes;
  }

  if (allowedHostnames !== undefined) {
    allowlist.allowedHostnames = allowedHostnames;
  }

  const safeUrl = assertAllowedExternalFetchUrl(url, allowlist);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    // The URL is normalized above and rejected unless its protocol, credentials,
    // and hostname match the caller's explicit allowlist.
    // codeql[js/request-forgery]
    return await fetch(safeUrl.toString(), {
      ...requestOptions,
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

function assertAllowedExternalFetchUrl(
  rawUrl: URL | string,
  options: ExternalFetchAllowlist,
) {
  const url = rawUrl instanceof URL ? new URL(rawUrl) : new URL(rawUrl);

  if (url.protocol !== 'https:') {
    throw new ExternalFetchError(
      'External request URL must use HTTPS.',
      'forbidden_url',
    );
  }

  if (url.username || url.password) {
    throw new ExternalFetchError(
      'External request URL must not include credentials.',
      'forbidden_url',
    );
  }

  const hostname = url.hostname.toLowerCase();
  const exactHostnames = options.allowedHostnames ?? [];
  const hostnameSuffixes = options.allowedHostnameSuffixes ?? [];

  if (
    exactHostnames.length === 0 &&
    hostnameSuffixes.length === 0
  ) {
    throw new ExternalFetchError(
      'External request URL requires an explicit hostname allowlist.',
      'forbidden_url',
    );
  }

  const exactAllowed = exactHostnames.some(
    (allowedHostname) => hostname === allowedHostname.toLowerCase(),
  );
  const suffixAllowed = hostnameSuffixes.some((allowedSuffix) =>
    isHostnameInDomain(hostname, allowedSuffix),
  );

  if (!exactAllowed && !suffixAllowed) {
    throw new ExternalFetchError(
      'External request hostname is not allowed.',
      'forbidden_url',
    );
  }

  return url;
}

function isHostnameInDomain(hostname: string, domain: string) {
  const hostnameLabels = hostname.toLowerCase().split('.');
  const domainLabels = domain.toLowerCase().split('.');

  if (hostnameLabels.length < domainLabels.length) {
    return false;
  }

  const offset = hostnameLabels.length - domainLabels.length;

  return domainLabels.every(
    (label, index) => hostnameLabels[offset + index] === label,
  );
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
