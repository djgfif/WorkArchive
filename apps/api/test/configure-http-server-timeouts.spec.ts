import { describe, expect, it } from '@jest/globals';

import { configureHttpServerTimeouts } from '../src/configure-http-server-timeouts';

describe('configureHttpServerTimeouts', () => {
  it('applies bounded runtime timeouts to the Node HTTP server', () => {
    const server = {
      headersTimeout: 60_000,
      keepAliveTimeout: 5_000,
      requestTimeout: 300_000,
    };

    configureHttpServerTimeouts(server, {
      headersTimeoutMs: 15_000,
      keepAliveTimeoutMs: 5_000,
      requestTimeoutMs: 120_000,
    });

    expect(server).toEqual({
      headersTimeout: 15_000,
      keepAliveTimeout: 5_000,
      requestTimeout: 120_000,
    });
  });
});
