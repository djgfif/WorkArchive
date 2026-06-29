import { BadGatewayException } from '@nestjs/common';
import * as https from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import * as tls from 'node:tls';

import {
  normalizeNetworkHostname,
  PublicAddressResolutionError,
  resolvePublicNetworkAddress,
} from './network-address-policy';

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
  maxResponseBytes?: number;
  timeoutMs: number;
}

interface ExternalFetchAllowlist {
  allowedHostnameSuffixes?: readonly string[];
  allowedHostnames?: readonly string[];
}

type ExternalFetchTransport = (
  url: URL,
  options: RequestInit,
  limits: ExternalFetchLimits,
) => Promise<Response>;

interface ExternalFetchLimits {
  maxResponseBytes?: number;
}

let externalFetchTransport: ExternalFetchTransport = requestExternalUrl;

export function setExternalFetchTransportForTest(
  transport: ExternalFetchTransport | null,
) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('External fetch transport can only be replaced in tests.');
  }

  externalFetchTransport = transport ?? requestExternalUrl;
}

export async function fetchExternal(
  url: URL | string,
  options: ExternalFetchOptions,
) {
  const {
    allowedHostnameSuffixes,
    allowedHostnames,
    maxResponseBytes,
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
  const limits: ExternalFetchLimits = {};

  if (maxResponseBytes !== undefined) {
    limits.maxResponseBytes = maxResponseBytes;
  }

  assertExternalFetchLimits(limits);
  assertExternalFetchTimeout(timeoutMs);

  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    const requestPromise = externalFetchTransport(
      safeUrl,
      {
        ...requestOptions,
        signal: abortController.signal,
      },
      limits,
    );
    const timeoutPromise = new Promise<Response>((_, reject) => {
      timeout = setTimeout(() => {
        abortController.abort();
        reject(new DOMException('aborted', 'AbortError'));
      }, timeoutMs);
    });

    return await Promise.race([requestPromise, timeoutPromise]);
  } catch (error) {
    if (error instanceof ExternalFetchError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ExternalFetchError('External request timed out.', 'timeout');
    }

    throw new ExternalFetchError('External request failed.', 'network');
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function requestExternalUrl(
  url: URL,
  options: RequestInit,
  limits: ExternalFetchLimits,
): Promise<Response> {
  const resolvedAddress = await resolveExternalAddress(url.hostname);
  const body = serializeRequestBody(options.body);
  const headers = normalizeRequestHeaders(options.headers);
  const tlsServername = getTlsServername(url.hostname);

  headers.host = url.host;

  if (body && !hasHeader(headers, 'content-length')) {
    headers['content-length'] = String(body.byteLength);
  }

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        headers,
        hostname: resolvedAddress,
        method: options.method ?? 'GET',
        path: `${url.pathname}${url.search}`,
        port: url.port ? Number(url.port) : 443,
        protocol: 'https:',
        servername: tlsServername,
        checkServerIdentity: tlsServername
          ? (_host, certificate) =>
              tls.checkServerIdentity(tlsServername, certificate)
          : undefined,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytesRead = 0;

        response.on('data', (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

          bytesRead += buffer.byteLength;

          if (
            limits.maxResponseBytes !== undefined &&
            bytesRead > limits.maxResponseBytes
          ) {
            const error = new ExternalFetchError(
              'External response body is too large.',
              'body_too_large',
              response.statusCode,
            );

            reject(error);
            request.destroy(error);
            return;
          }

          chunks.push(buffer);
        });
        response.on('error', reject);
        response.on('end', () => {
          const status = response.statusCode;

          if (!status || status < 200 || status > 599) {
            reject(new Error('External response status is invalid.'));
            return;
          }

          const responseBody = allowsResponseBody(status)
            ? new Uint8Array(Buffer.concat(chunks))
            : null;

          resolve(
            new Response(responseBody, {
              headers: normalizeResponseHeaders(response.headers),
              status,
            }),
          );
        });
      },
    );

    const signal = options.signal;

    const abort = () => {
      request.destroy(new DOMException('aborted', 'AbortError'));
    };

    if (signal?.aborted) {
      abort();
    } else {
      signal?.addEventListener('abort', abort, { once: true });
    }

    request.on('error', (error) => {
      signal?.removeEventListener('abort', abort);
      reject(error);
    });
    request.on('close', () => {
      signal?.removeEventListener('abort', abort);
    });

    if (body) {
      request.write(body);
    }

    request.end();
  });
}

function assertExternalFetchLimits(limits: ExternalFetchLimits) {
  if (
    limits.maxResponseBytes !== undefined &&
    (!Number.isInteger(limits.maxResponseBytes) || limits.maxResponseBytes <= 0)
  ) {
    throw new ExternalFetchError(
      'External response byte limit must be a positive integer.',
      'network',
    );
  }
}

function assertExternalFetchTimeout(timeoutMs: number) {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new ExternalFetchError(
      'External request timeout must be a positive integer.',
      'network',
    );
  }
}

function serializeRequestBody(body: RequestInit['body'] | undefined) {
  if (body === null || body === undefined) {
    return null;
  }

  if (typeof body === 'string') {
    return Buffer.from(body);
  }

  if (body instanceof URLSearchParams) {
    return Buffer.from(body.toString());
  }

  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }

  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  }

  throw new ExternalFetchError(
    'External request body type is not supported.',
    'network',
  );
}

function normalizeRequestHeaders(headers: RequestInit['headers'] | undefined) {
  const normalized: Record<string, string> = {};
  const source = new Headers(headers);

  source.forEach((value, key) => {
    if (key.toLowerCase() !== 'host') {
      normalized[key] = value;
    }
  });

  return normalized;
}

function normalizeResponseHeaders(headers: IncomingHttpHeaders) {
  const normalized = new Headers();

  Object.entries(headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => normalized.append(key, item));
    } else if (value !== undefined) {
      normalized.set(key, value);
    }
  });

  return normalized;
}

function hasHeader(headers: Record<string, string>, headerName: string) {
  const normalizedHeaderName = headerName.toLowerCase();

  return Object.keys(headers).some(
    (key) => key.toLowerCase() === normalizedHeaderName,
  );
}

function allowsResponseBody(status: number) {
  return status !== 204 && status !== 205 && status !== 304;
}

async function resolveExternalAddress(hostname: string) {
  try {
    const resolvedAddress = await resolvePublicNetworkAddress(hostname);

    return resolvedAddress.address;
  } catch (error) {
    if (error instanceof PublicAddressResolutionError) {
      throw new ExternalFetchError(
        error.code === 'private_address'
          ? 'External request hostname resolved to a private address.'
          : 'External request hostname could not be resolved.',
        error.code === 'private_address' ? 'forbidden_url' : 'network',
      );
    }

    throw error;
  }
}

function getTlsServername(hostname: string) {
  const normalizedHostname = normalizeNetworkHostname(hostname);

  return /^\d+\.\d+\.\d+\.\d+$/.test(normalizedHostname) ||
    normalizedHostname.includes(':')
    ? undefined
    : normalizedHostname;
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

  if (url.port) {
    throw new ExternalFetchError(
      'External request URL must use the default HTTPS port.',
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
