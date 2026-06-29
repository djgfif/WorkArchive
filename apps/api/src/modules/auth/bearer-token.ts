import { UnauthorizedException } from '@nestjs/common';

export function extractRequiredBearerAccessToken(authorizationHeader?: string) {
  const token = extractOptionalBearerAccessToken(authorizationHeader);

  if (!token) {
    throw new UnauthorizedException('Missing Bearer access token.');
  }

  return token;
}

export function extractOptionalBearerAccessToken(authorizationHeader?: string) {
  if (!authorizationHeader) {
    return null;
  }

  const match = /^Bearer ([^\s]+)$/.exec(authorizationHeader);

  if (!match) {
    throw new UnauthorizedException('Malformed Bearer access token.');
  }

  return match[1];
}
