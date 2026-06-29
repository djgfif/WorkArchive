import {
  createPublicKey,
  type webcrypto,
} from 'node:crypto';

import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import {
  ExternalFetchError,
  fetchExternal,
  readJsonWithLimit,
} from '../../common/external-fetch';
import { readApiRuntimeConfig } from '../../config/api-runtime-config';
import { verifySecret } from './auth-crypto';

type JsonWebKey = webcrypto.JsonWebKey;

const GOOGLE_AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_TOKEN_TIMEOUT_MS = 5_000;
const GOOGLE_JWKS_TIMEOUT_MS = 4_000;
const GOOGLE_JWKS_STALE_FALLBACK_MS = 24 * 60 * 60 * 1_000;
const GOOGLE_OAUTH_JSON_MAX_BYTES = 64 * 1_024;
const GOOGLE_JWKS_JSON_MAX_BYTES = 256 * 1_024;
const GOOGLE_OIDC_ISSUERS: [string, string] = [
  'https://accounts.google.com',
  'accounts.google.com',
];

export const GOOGLE_AUTH_PROVIDER = 'google';

interface GoogleTokenResponse {
  id_token?: unknown;
}

interface GoogleJwksResponse {
  keys?: Array<JsonWebKey & { kid?: string }>;
}

export interface GoogleIdentityProfile {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  pictureUrl: string;
}

export interface GoogleSigningKeysCache {
  expiresAt: number;
  fetchedAt: number;
  keysByKid: Map<string, string>;
}

type GoogleIdTokenPayload = JwtPayload & {
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  nonce?: unknown;
  picture?: unknown;
};

@Injectable()
export class GoogleOAuthClient {
  private readonly logger = new Logger(GoogleOAuthClient.name);
  googleSigningKeysCache: GoogleSigningKeysCache | null = null;

  getAuthorizationUrl(state: string, nonce: string) {
    const config = this.requireConfig();
    const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_URL);

    authorizationUrl.searchParams.set('client_id', config.clientId);
    authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', 'openid email profile');
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('nonce', nonce);
    authorizationUrl.searchParams.set('prompt', 'select_account');

    return authorizationUrl.toString();
  }

  isConfigured() {
    const config = readApiRuntimeConfig();

    return Boolean(
      config.googleOAuthClientId && config.googleOAuthClientSecret,
    );
  }

  async getIdentityProfileForAuthorizationCode(
    code: string,
    expectedNonceHash: string,
  ): Promise<GoogleIdentityProfile> {
    const tokenResponse = await this.exchangeAuthorizationCode(code);
    const idToken =
      typeof tokenResponse.id_token === 'string'
        ? tokenResponse.id_token
        : null;

    if (!idToken) {
      throw new UnauthorizedException('Google did not return an id_token.');
    }

    return this.verifyIdToken(idToken, expectedNonceHash);
  }

  async exchangeAuthorizationCode(code: string) {
    const config = this.requireConfig();
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    });

    let response: Response;

    try {
      response = await fetchExternal(GOOGLE_TOKEN_URL, {
        allowedHostnames: ['oauth2.googleapis.com'],
        body,
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        method: 'POST',
        maxResponseBytes: GOOGLE_OAUTH_JSON_MAX_BYTES,
        timeoutMs: GOOGLE_TOKEN_TIMEOUT_MS,
      });
    } catch (error) {
      this.logOAuthProviderWarning('auth.google.token_exchange.failed', {
        errorCode: describeExternalFetchError(error),
      });
      throw new UnauthorizedException('Google login could not be completed.');
    }

    if (!response.ok) {
      this.logOAuthProviderWarning('auth.google.token_exchange.failed', {
        httpStatus: response.status,
      });
      throw new UnauthorizedException('Google login could not be completed.');
    }

    try {
      return await readJsonWithLimit<GoogleTokenResponse>(
        response,
        GOOGLE_OAUTH_JSON_MAX_BYTES,
      );
    } catch (error) {
      this.logOAuthProviderWarning('auth.google.token_exchange.invalid_body', {
        errorCode: describeExternalFetchError(error),
      });
      throw new UnauthorizedException('Google login could not be completed.');
    }
  }

  async getSigningKey(kid: string) {
    if (
      this.googleSigningKeysCache &&
      this.googleSigningKeysCache.expiresAt > Date.now()
    ) {
      const cachedKey = this.googleSigningKeysCache.keysByKid.get(kid);

      if (cachedKey) {
        return cachedKey;
      }
    }

    let response: Response;

    try {
      response = await fetchExternal(GOOGLE_JWKS_URL, {
        allowedHostnames: ['www.googleapis.com'],
        method: 'GET',
        maxResponseBytes: GOOGLE_JWKS_JSON_MAX_BYTES,
        timeoutMs: GOOGLE_JWKS_TIMEOUT_MS,
      });
    } catch (error) {
      const staleKey = this.getStaleSigningKey(kid);

      if (staleKey) {
        this.logOAuthProviderWarning('auth.google.jwks.stale_cache_used', {
          errorCode: describeExternalFetchError(error),
          staleCache: true,
        });
        return staleKey;
      }

      throw new UnauthorizedException('Google signing keys are unavailable.');
    }

    if (!response.ok) {
      const staleKey = this.getStaleSigningKey(kid);

      if (staleKey) {
        this.logOAuthProviderWarning('auth.google.jwks.stale_cache_used', {
          httpStatus: response.status,
          staleCache: true,
        });
        return staleKey;
      }

      throw new UnauthorizedException('Google signing keys are unavailable.');
    }

    let jwks: GoogleJwksResponse;

    try {
      jwks = await readJsonWithLimit<GoogleJwksResponse>(
        response,
        GOOGLE_JWKS_JSON_MAX_BYTES,
      );
    } catch {
      const staleKey = this.getStaleSigningKey(kid);

      if (staleKey) {
        this.logOAuthProviderWarning('auth.google.jwks.stale_cache_used', {
          errorCode: 'invalid_body',
          staleCache: true,
        });
        return staleKey;
      }

      throw new UnauthorizedException('Google signing keys are unavailable.');
    }

    const keysByKid = new Map<string, string>();

    for (const jwk of jwks.keys ?? []) {
      if (!jwk.kid) {
        continue;
      }

      keysByKid.set(
        jwk.kid,
        createPublicKey({
          format: 'jwk',
          key: jwk,
        })
          .export({
            format: 'pem',
            type: 'spki',
          })
          .toString(),
      );
    }

    const maxAgeMatch = response.headers
      .get('cache-control')
      ?.match(/max-age=(\d+)/);
    const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

    this.googleSigningKeysCache = {
      expiresAt: Date.now() + maxAgeSeconds * 1000,
      fetchedAt: Date.now(),
      keysByKid,
    };

    const signingKey = keysByKid.get(kid);

    if (!signingKey) {
      throw new UnauthorizedException(
        'Google id_token signing key is unknown.',
      );
    }

    return signingKey;
  }

  private logOAuthProviderWarning(
    event: string,
    fields: {
      errorCode?: string;
      httpStatus?: number;
      staleCache?: boolean;
    },
  ) {
    this.logger.warn(
      JSON.stringify({
        count: null,
        durationMs: null,
        entityType: null,
        errorCode: fields.errorCode ?? null,
        event,
        httpStatus: fields.httpStatus ?? null,
        provider: GOOGLE_AUTH_PROVIDER,
        requestId: null,
        staleCache: fields.staleCache ?? null,
        userId: null,
      }),
    );
  }

  private async verifyIdToken(
    idToken: string,
    expectedNonceHash: string,
  ): Promise<GoogleIdentityProfile> {
    const config = this.requireConfig();
    const decodedHeader = jwt.decode(idToken, {
      complete: true,
    });
    const kid = decodedHeader?.header.kid;

    if (!kid || decodedHeader.header.alg !== 'RS256') {
      throw new UnauthorizedException('Google id_token is not trusted.');
    }

    const publicKey = await this.getSigningKey(kid);
    const payload = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      audience: config.clientId,
      issuer: GOOGLE_OIDC_ISSUERS,
    }) as GoogleIdTokenPayload;

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.nonce !== 'string'
    ) {
      throw new UnauthorizedException('Google id_token is invalid.');
    }

    if (!(await verifySecret(payload.nonce, expectedNonceHash))) {
      throw new UnauthorizedException('Google id_token is invalid.');
    }

    return {
      email: this.normalizeEmail(payload.email),
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === 'string' ? payload.name : '',
      pictureUrl: typeof payload.picture === 'string' ? payload.picture : '',
      providerAccountId: payload.sub,
    };
  }

  private getStaleSigningKey(kid: string) {
    if (!this.googleSigningKeysCache) {
      return null;
    }

    if (
      Date.now() - this.googleSigningKeysCache.fetchedAt >
      GOOGLE_JWKS_STALE_FALLBACK_MS
    ) {
      return null;
    }

    return this.googleSigningKeysCache.keysByKid.get(kid) ?? null;
  }

  private requireConfig() {
    const config = readApiRuntimeConfig();

    if (!config.googleOAuthClientId || !config.googleOAuthClientSecret) {
      throw new ServiceUnavailableException(
        'Google OAuth is not configured for this environment.',
      );
    }

    return {
      clientId: config.googleOAuthClientId,
      clientSecret: config.googleOAuthClientSecret,
      redirectUri: config.googleOAuthRedirectUri,
    };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }
}

function describeExternalFetchError(error: unknown) {
  return error instanceof ExternalFetchError ? error.code : 'UnknownError';
}
