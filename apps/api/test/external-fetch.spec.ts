import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  fetchExternal,
  setExternalFetchTransportForTest,
} from '../src/common/external-fetch';

describe('fetchExternal', () => {
  let transport: jest.MockedFunction<
    (
      url: URL,
      options: RequestInit,
      limits: { maxResponseBytes?: number },
    ) => Promise<Response>
  >;

  beforeEach(() => {
    transport = jest.fn(async () => new Response('{}'));
    setExternalFetchTransportForTest(transport);
  });

  afterEach(() => {
    setExternalFetchTransportForTest(null);
    jest.restoreAllMocks();
  });

  it('requires an explicit hostname allowlist before making a request', async () => {
    await expect(
      fetchExternal('https://example.com/data.json', {
        method: 'GET',
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({
      code: 'forbidden_url',
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it('blocks non-HTTPS and credentialed upstream URLs before fetch', async () => {
    await expect(
      fetchExternal('http://api.example.com/data.json', {
        allowedHostnames: ['api.example.com'],
        method: 'GET',
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({
      code: 'forbidden_url',
    });

    await expect(
      fetchExternal('https://user:pass@api.example.com/data.json', {
        allowedHostnames: ['api.example.com'],
        method: 'GET',
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({
      code: 'forbidden_url',
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it('blocks non-default HTTPS ports before fetch', async () => {
    await expect(
      fetchExternal('https://api.example.com:8443/data.json', {
        allowedHostnames: ['api.example.com'],
        method: 'GET',
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({
      code: 'forbidden_url',
    });

    expect(transport).not.toHaveBeenCalled();
  });

  it('allows exact and subdomain allowlist matches only', async () => {
    await fetchExternal('https://cdn.example.com/data.json', {
      allowedHostnameSuffixes: ['example.com'],
      method: 'GET',
      timeoutMs: 1000,
    });

    await expect(
      fetchExternal('https://evil-example.com/data.json', {
        allowedHostnameSuffixes: ['example.com'],
        method: 'GET',
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({
      code: 'forbidden_url',
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('passes response byte limits to the external transport', async () => {
    const transport = jest
      .fn(
        async (
          _url: URL,
          _options: RequestInit,
          _limits: { maxResponseBytes?: number },
        ) => new Response('{}'),
      )
      .mockName('externalFetchTransport');

    setExternalFetchTransportForTest(transport);

    await fetchExternal('https://api.example.com/data.json', {
      allowedHostnames: ['api.example.com'],
      maxResponseBytes: 1024,
      method: 'GET',
      timeoutMs: 1000,
    });

    expect(transport).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: 'GET',
      }),
      {
        maxResponseBytes: 1024,
      },
    );
  });

  it('validates byte limits before dispatching the transport', async () => {
    const transport = jest
      .fn(async () => new Response('{}'))
      .mockName('externalFetchTransport');

    setExternalFetchTransportForTest(transport);

    await expect(
      fetchExternal('https://api.example.com/data.json', {
        allowedHostnames: ['api.example.com'],
        maxResponseBytes: 0,
        method: 'GET',
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({
      code: 'network',
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it('times out stalled transports', async () => {
    setExternalFetchTransportForTest(
      (_url, options) =>
        new Promise<Response>((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );

    await expect(
      fetchExternal('https://api.example.com/data.json', {
        allowedHostnames: ['api.example.com'],
        method: 'GET',
        timeoutMs: 1,
      }),
    ).rejects.toMatchObject({
      code: 'timeout',
    });
  });

  it('blocks private literal IPs in the default transport', async () => {
    setExternalFetchTransportForTest(null);

    await expect(
      fetchExternal('https://127.0.0.1/data.json', {
        allowedHostnames: ['127.0.0.1'],
        method: 'GET',
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({
      code: 'forbidden_url',
    });
  });
});
