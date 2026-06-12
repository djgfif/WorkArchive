import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';

import {
  extractOptionalBearerAccessToken,
  extractRequiredBearerAccessToken,
} from '../src/modules/auth/bearer-token';

describe('bearer token helpers', () => {
  it('extracts required bearer access tokens', () => {
    expect(extractRequiredBearerAccessToken('Bearer access-token')).toBe(
      'access-token',
    );
  });

  it('rejects missing required bearer access tokens', () => {
    expect(() => extractRequiredBearerAccessToken()).toThrow(
      new UnauthorizedException('Missing Bearer access token.'),
    );
  });

  it('returns null for missing optional bearer access tokens', () => {
    expect(extractOptionalBearerAccessToken()).toBeNull();
  });

  it.each(['Basic access-token', 'Bearer', 'Bearer '])(
    'rejects malformed bearer access token header %s',
    (authorizationHeader) => {
      expect(() =>
        extractOptionalBearerAccessToken(authorizationHeader),
      ).toThrow(new UnauthorizedException('Malformed Bearer access token.'));
    },
  );
});
