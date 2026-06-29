import { describe, expect, it } from '@jest/globals';

import {
  sanitizeRequestUrlForLog,
  serializeRequestForLog,
} from '../src/app.module';

describe('HTTP request log redaction', () => {
  it('drops query strings and fragments from logged request URLs', () => {
    expect(
      sanitizeRequestUrlForLog(
        '/api/auth/google/callback?code=oauth-code&state=oauth-state#fragment',
      ),
    ).toBe('/api/auth/google/callback');
    expect(
      sanitizeRequestUrlForLog(
        'https://workarchive.example.com/api/imports/search?providerToken=secret',
      ),
    ).toBe('/api/imports/search');
  });

  it('keeps request metadata but logs only the sanitized request target', () => {
    const serialized = serializeRequestForLog({
      headers: {
        authorization: 'Bearer access-token',
        cookie: 'work_archive_refresh_token=secret',
      },
      id: 'request-1',
      method: 'GET',
      socket: {
        remoteAddress: '203.0.113.10',
        remotePort: 443,
      },
      url: '/api/auth/google/callback?code=oauth-code',
    });

    expect(serialized).toEqual({
      headers: {
        authorization: 'Bearer access-token',
        cookie: 'work_archive_refresh_token=secret',
      },
      id: 'request-1',
      method: 'GET',
      remoteAddress: '203.0.113.10',
      remotePort: 443,
      url: '/api/auth/google/callback',
    });
  });
});
