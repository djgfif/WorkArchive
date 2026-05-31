import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { fetchExternal } from '../src/common/external-fetch';

describe('fetchExternal', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires an explicit hostname allowlist before making a request', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(
      fetchExternal('https://example.com/data.json', {
        method: 'GET',
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({
      code: 'forbidden_url',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks non-HTTPS and credentialed upstream URLs before fetch', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

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
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('allows exact and subdomain allowlist matches only', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}'));

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
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
