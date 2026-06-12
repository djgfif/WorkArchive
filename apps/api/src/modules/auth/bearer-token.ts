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

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedException('Malformed Bearer access token.');
  }

  return token;
}
