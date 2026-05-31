import { createHmac, timingSafeEqual } from 'node:crypto';

import { readApiRuntimeConfig } from '../../config/api-runtime-config';

export function signOAuthVerificationValue(value: string) {
  return createHmac('sha256', readApiRuntimeConfig().securityEventHashSecret)
    .update(value)
    .digest('base64url');
}

export function isOAuthVerificationValueMatch(
  value: string,
  expectedSignature: string,
) {
  const actualSignature = signOAuthVerificationValue(value);
  const actual = Buffer.from(actualSignature, 'base64url');
  const expected = Buffer.from(expectedSignature, 'base64url');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
