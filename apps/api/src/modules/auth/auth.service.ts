import {
  createPublicKey,
  randomBytes,
  randomUUID,
  type JsonWebKey,
} from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  Prisma,
  User,
  UserAuthAccount,
  UserRefreshSession,
} from '@prisma/client';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import { readApiRuntimeConfig } from '../../config/api-runtime-config';
import {
  ExternalFetchError,
  fetchExternal,
  readJsonWithLimit,
} from '../../common/external-fetch';
import { MetricsService } from '../../observability/metrics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityAuditService } from '../../security/security-audit.service';
import { hashSecret, verifySecret } from './auth-crypto';
import type { AuthSessionResponseDto } from './dto/auth-session-response.dto';
import type {
  AuthRefreshSessionResponseDto,
  AuthRefreshSessionsResponseDto,
} from './dto/auth-refresh-session-response.dto';
import type { AuthUserResponseDto } from './dto/auth-user-response.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type {
  AuthTokenKind,
  AuthTokenPayload,
  AuthenticatedUser,
} from './auth.types';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const GOOGLE_AUTH_PROVIDER = 'google';
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
const RESERVED_HANDLES = new Set([
  'admin',
  'api',
  'auth',
  'account',
  'settings',
  'works',
  'sync',
  'profile',
]);
export interface IssuedAuthSession {
  accessToken: string;
  refreshToken: string;
  rememberMe: boolean;
  sessionId: string;
  user: AuthUserResponseDto;
}

export interface AuthSessionMetadata {
  ipAddress?: string | null;
  requestId?: string | null;
  userAgent?: string | null;
}

type UserWithAuthAccounts = User & {
  authAccounts?: UserAuthAccount[];
};

interface GoogleTokenResponse {
  id_token?: unknown;
}

interface GoogleJwksResponse {
  keys?: Array<JsonWebKey & { kid?: string }>;
}

interface GoogleIdentityProfile {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  pictureUrl: string;
}

type GoogleIdTokenPayload = JwtPayload & {
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  nonce?: unknown;
  picture?: unknown;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleSigningKeysCache: {
    expiresAt: number;
    fetchedAt: number;
    keysByKid: Map<string, string>;
  } | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SecurityAuditService)
    @Optional()
    private readonly securityAudit?: SecurityAuditService,
    @Inject(MetricsService)
    @Optional()
    private readonly metricsService?: MetricsService,
  ) {}

  getGoogleAuthorizationUrl(state: string, nonce: string) {
    const config = this.requireGoogleOAuthConfig();
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

  isGoogleOAuthConfigured() {
    const config = readApiRuntimeConfig();

    return Boolean(
      config.googleOAuthClientId && config.googleOAuthClientSecret,
    );
  }

  async loginWithGoogleAuthorizationCode(
    code: string,
    expectedNonceHash: string,
    metadata: AuthSessionMetadata = {},
  ): Promise<IssuedAuthSession> {
    const tokenResponse = await this.exchangeGoogleAuthorizationCode(code);
    const idToken =
      typeof tokenResponse.id_token === 'string'
        ? tokenResponse.id_token
        : null;

    if (!idToken) {
      throw new UnauthorizedException('Google did not return an id_token.');
    }

    const profile = await this.verifyGoogleIdToken(idToken, expectedNonceHash);

    if (!profile.emailVerified) {
      throw new UnauthorizedException('Google account email is not verified.');
    }

    const user = await this.findOrCreateGoogleUser(profile);

    return this.createSessionForUser(user, true, metadata);
  }

  async refresh(
    refreshToken: string,
    metadata: AuthSessionMetadata = {},
  ): Promise<IssuedAuthSession> {
    let tokenPayload: AuthTokenPayload;

    try {
      tokenPayload = this.verifyToken(refreshToken, 'refresh');
    } catch (error) {
      this.recordRefreshFailure(
        'invalid_or_expired_token',
        undefined,
        metadata,
      );
      throw error;
    }

    const session = await this.prisma.userRefreshSession.findUnique({
      where: {
        id: tokenPayload.sid,
      },
      include: {
        user: {
          include: {
            authAccounts: true,
          },
        },
      },
    });

    if (!session || session.userId !== tokenPayload.sub) {
      this.recordRefreshFailure(
        'missing_refresh_session',
        tokenPayload.sub,
        metadata,
      );
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    if (session.revokedAt) {
      await this.revokeAllUserSessions(session.userId);
      this.recordRefreshFailure(
        'inactive_refresh_session_reuse',
        session.userId,
        metadata,
        'auth.refresh.reuse_detected',
      );
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.revokeAllUserSessions(session.userId);
      this.recordRefreshFailure(
        'expired_refresh_session',
        session.userId,
        metadata,
      );
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const isRefreshTokenValid = await verifySecret(
      refreshToken,
      session.tokenHash,
    );

    if (!isRefreshTokenValid) {
      await this.revokeAllUserSessions(session.userId);
      this.recordRefreshFailure(
        'refresh_token_reuse_detected',
        session.userId,
        metadata,
        'auth.refresh.reuse_detected',
      );
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const sessionResponse = await this.rotateSessionForUser(
      session.user,
      session,
      tokenPayload.rememberMe ?? session.rememberMe,
    );

    this.metricsService?.recordAuthRefresh('success');

    return sessionResponse;
  }

  async logout(refreshToken: string | null) {
    if (!refreshToken) {
      return;
    }

    try {
      const tokenPayload = this.verifyToken(refreshToken, 'refresh');
      const session = await this.prisma.userRefreshSession.findUnique({
        where: {
          id: tokenPayload.sid,
        },
      });

      if (
        !session ||
        session.userId !== tokenPayload.sub ||
        session.revokedAt ||
        session.expiresAt.getTime() <= Date.now()
      ) {
        return;
      }

      const isRefreshTokenValid = await verifySecret(
        refreshToken,
        session.tokenHash,
      );

      if (!isRefreshTokenValid) {
        return;
      }

      await this.prisma.userRefreshSession.update({
        where: {
          id: session.id,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    } catch {
      return;
    }
  }

  async getCurrentUser(userId: string): Promise<AuthUserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        authAccounts: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Session is no longer valid.');
    }

    return this.toUserResponse(user);
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<AuthUserResponseDto> {
    const handle = updateProfileDto.handle ?? null;

    if (handle && RESERVED_HANDLES.has(handle)) {
      throw new BadRequestException('Handle is reserved.');
    }

    if (handle) {
      const existingUser = await this.prisma.user.findUnique({
        where: {
          handle,
        },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException('Handle is already in use.');
      }
    }

    try {
      const user = await this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          avatarUrl: updateProfileDto.avatarUrl ?? '',
          handle,
          nickname: updateProfileDto.nickname,
        },
        include: {
          authAccounts: true,
        },
      });

      return this.toUserResponse(user);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Handle is already in use.');
      }

      throw error;
    }
  }

  async listRefreshSessions(
    user: AuthenticatedUser,
  ): Promise<AuthRefreshSessionsResponseDto> {
    const sessions = await this.prisma.userRefreshSession.findMany({
      where: {
        userId: user.userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      sessions: sessions.map((session) =>
        this.toRefreshSessionResponse(session, session.id === user.sessionId),
      ),
    };
  }

  async revokeRefreshSession(
    user: AuthenticatedUser,
    sessionId: string,
  ): Promise<{ revokedCurrent: boolean }> {
    await this.prisma.userRefreshSession.updateMany({
      where: {
        id: sessionId,
        userId: user.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return {
      revokedCurrent: sessionId === user.sessionId,
    };
  }

  async revokeAllRefreshSessions(user: AuthenticatedUser) {
    await this.revokeAllUserSessions(user.userId);
  }

  async validateAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    const tokenPayload = this.verifyToken(accessToken, 'access');
    const user = await this.prisma.user.findUnique({
      where: {
        id: tokenPayload.sub,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Session is no longer valid.');
    }

    const session = await this.prisma.userRefreshSession.findUnique({
      where: {
        id: tokenPayload.sid,
      },
    });

    if (
      !session ||
      session.userId !== user.id ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Session is no longer valid.');
    }

    return {
      userId: user.id,
      sessionId: session.id,
      email: user.email,
      role: user.role,
    };
  }

  toSessionResponse(session: IssuedAuthSession): AuthSessionResponseDto {
    return {
      accessToken: session.accessToken,
      user: session.user,
    };
  }

  private async createSessionForUser(
    user: UserWithAuthAccounts,
    rememberMe = true,
    metadata: AuthSessionMetadata = {},
  ): Promise<IssuedAuthSession> {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
    const accessToken = this.signToken(
      user,
      sessionId,
      'access',
      ACCESS_TOKEN_TTL_SECONDS,
    );
    const refreshToken = this.signToken(
      user,
      sessionId,
      'refresh',
      REFRESH_TOKEN_TTL_SECONDS,
      rememberMe,
    );
    await this.prisma.userRefreshSession.create({
      data: {
        id: sessionId,
        expiresAt,
        ipAddress: this.maskIpAddress(metadata.ipAddress ?? null),
        lastUsedAt: new Date(),
        rememberMe,
        tokenHash: await hashSecret(refreshToken),
        userAgent: this.summarizeUserAgent(metadata.userAgent ?? null),
        userId: user.id,
      },
    });

    return {
      accessToken,
      refreshToken,
      rememberMe,
      sessionId,
      user: this.toUserResponse(user),
    };
  }

  private async rotateSessionForUser(
    user: UserWithAuthAccounts,
    session: UserRefreshSession,
    rememberMe = true,
  ): Promise<IssuedAuthSession> {
    const accessToken = this.signToken(
      user,
      session.id,
      'access',
      ACCESS_TOKEN_TTL_SECONDS,
    );
    const refreshToken = this.signToken(
      user,
      session.id,
      'refresh',
      REFRESH_TOKEN_TTL_SECONDS,
      rememberMe,
    );
    const now = new Date();

    await this.prisma.userRefreshSession.update({
      where: {
        id: session.id,
      },
      data: {
        lastUsedAt: now,
        rememberMe,
        rotatedAt: now,
        tokenHash: await hashSecret(refreshToken),
      },
    });

    return {
      accessToken,
      refreshToken,
      rememberMe,
      sessionId: session.id,
      user: this.toUserResponse(user),
    };
  }

  private signToken(
    user: Pick<User, 'id' | 'email'>,
    sessionId: string,
    type: AuthTokenKind,
    expiresIn: number,
    rememberMe?: boolean,
  ) {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        sid: sessionId,
        type,
        ...(type === 'refresh' && rememberMe !== undefined
          ? { rememberMe }
          : {}),
      },
      this.getJwtSecret(type),
      {
        expiresIn,
        jwtid: randomBytes(16).toString('hex'),
      },
    );
  }

  private verifyToken(token: string, type: AuthTokenKind): AuthTokenPayload {
    try {
      const decoded = jwt.verify(token, this.getJwtSecret(type));

      if (
        typeof decoded === 'string' ||
        typeof (decoded as JwtPayload).sub !== 'string' ||
        typeof (decoded as JwtPayload).email !== 'string' ||
        typeof (decoded as JwtPayload).sid !== 'string' ||
        (decoded as JwtPayload).type !== type ||
        ('rememberMe' in (decoded as JwtPayload) &&
          typeof (decoded as JwtPayload).rememberMe !== 'boolean')
      ) {
        throw new UnauthorizedException('Invalid or expired token.');
      }

      return {
        sub: (decoded as JwtPayload).sub as string,
        email: (decoded as JwtPayload).email as string,
        sid: (decoded as JwtPayload).sid as string,
        type,
        ...((decoded as JwtPayload).rememberMe !== undefined
          ? { rememberMe: (decoded as JwtPayload).rememberMe as boolean }
          : {}),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired token.');
    }
  }

  private getJwtSecret(type: AuthTokenKind) {
    const config = readApiRuntimeConfig();

    return type === 'access' ? config.jwtAccessSecret : config.jwtRefreshSecret;
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private toUserResponse(
    user: Pick<
      User,
      'id' | 'avatarUrl' | 'email' | 'handle' | 'nickname' | 'role'
    > & {
      authAccounts?: Pick<
        UserAuthAccount,
        'email' | 'emailVerified' | 'name' | 'pictureUrl' | 'provider'
      >[];
    },
  ): AuthUserResponseDto {
    return {
      authAccounts:
        user.authAccounts?.map((account) => ({
          email: account.email,
          emailVerified: account.emailVerified,
          name: account.name,
          pictureUrl: account.pictureUrl,
          provider: account.provider,
        })) ?? [],
      avatarUrl: user.avatarUrl,
      id: user.id,
      email: user.email,
      handle: user.handle,
      nickname: user.nickname,
      role: user.role,
    };
  }

  private requireGoogleOAuthConfig() {
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

  private async exchangeGoogleAuthorizationCode(code: string) {
    const config = this.requireGoogleOAuthConfig();
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
      this.logger.warn(
        `Google token exchange failed reason=${
          error instanceof ExternalFetchError ? error.code : 'unknown'
        }`,
      );
      throw new UnauthorizedException('Google login could not be completed.');
    }

    if (!response.ok) {
      this.logger.warn(
        `Google token exchange failed status=${response.status}`,
      );
      throw new UnauthorizedException('Google login could not be completed.');
    }

    try {
      return await readJsonWithLimit<GoogleTokenResponse>(
        response,
        GOOGLE_OAUTH_JSON_MAX_BYTES,
      );
    } catch (error) {
      this.logger.warn(
        `Google token exchange returned invalid body reason=${
          error instanceof ExternalFetchError ? error.code : 'unknown'
        }`,
      );
      throw new UnauthorizedException('Google login could not be completed.');
    }
  }

  private async verifyGoogleIdToken(
    idToken: string,
    expectedNonceHash: string,
  ): Promise<GoogleIdentityProfile> {
    const config = this.requireGoogleOAuthConfig();
    const decodedHeader = jwt.decode(idToken, {
      complete: true,
    });
    const kid = decodedHeader?.header.kid;

    if (!kid || decodedHeader.header.alg !== 'RS256') {
      throw new UnauthorizedException('Google id_token is not trusted.');
    }

    const publicKey = await this.getGoogleSigningKey(kid);
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

  private async getGoogleSigningKey(kid: string) {
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
      const staleKey = this.getStaleGoogleSigningKey(kid);

      if (staleKey) {
        this.logger.warn(
          `Google signing keys fetch failed; using stale cache reason=${
            error instanceof ExternalFetchError ? error.code : 'unknown'
          }`,
        );
        return staleKey;
      }

      throw new UnauthorizedException('Google signing keys are unavailable.');
    }

    if (!response.ok) {
      const staleKey = this.getStaleGoogleSigningKey(kid);

      if (staleKey) {
        this.logger.warn(
          `Google signing keys returned status=${response.status}; using stale cache`,
        );
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
      const staleKey = this.getStaleGoogleSigningKey(kid);

      if (staleKey) {
        this.logger.warn('Google signing keys body invalid; using stale cache');
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

  private getStaleGoogleSigningKey(kid: string) {
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

  private async findOrCreateGoogleUser(profile: GoogleIdentityProfile) {
    return this.prisma.$transaction(async (tx) => {
      const existingAccount = await tx.userAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: GOOGLE_AUTH_PROVIDER,
            providerAccountId: profile.providerAccountId,
          },
        },
        include: {
          user: true,
        },
      });

      if (existingAccount) {
        await tx.userAuthAccount.update({
          where: {
            id: existingAccount.id,
          },
          data: this.toGoogleAuthAccountData(profile),
        });

        return tx.user.findUniqueOrThrow({
          where: {
            id: existingAccount.userId,
          },
          include: {
            authAccounts: true,
          },
        });
      }

      const existingUser = await tx.user.findUnique({
        where: {
          email: profile.email,
        },
      });
      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            email: profile.email,
            nickname: profile.name,
            passwordHash: null,
          },
        }));

      await tx.userAuthAccount.create({
        data: {
          ...this.toGoogleAuthAccountData(profile),
          provider: GOOGLE_AUTH_PROVIDER,
          providerAccountId: profile.providerAccountId,
          userId: user.id,
        },
      });

      return tx.user.findUniqueOrThrow({
        where: {
          id: user.id,
        },
        include: {
          authAccounts: true,
        },
      });
    });
  }

  private toGoogleAuthAccountData(
    profile: GoogleIdentityProfile,
  ): Pick<
    Prisma.UserAuthAccountUncheckedCreateInput,
    'email' | 'emailVerified' | 'name' | 'pictureUrl'
  > {
    return {
      email: profile.email,
      emailVerified: profile.emailVerified,
      name: profile.name,
      pictureUrl: profile.pictureUrl,
    };
  }

  private toRefreshSessionResponse(
    session: UserRefreshSession,
    current: boolean,
  ): AuthRefreshSessionResponseDto {
    return {
      id: session.id,
      current,
      rememberMe: session.rememberMe,
      userAgent: this.summarizeUserAgent(session.userAgent),
      ipAddress: this.maskIpAddress(session.ipAddress),
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt?.toISOString() ?? null,
      rotatedAt: session.rotatedAt?.toISOString() ?? null,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  private summarizeUserAgent(value: string | null) {
    if (!value) {
      return null;
    }

    if (!/[()/]/.test(value) && value.length <= 80) {
      return value;
    }

    const browser = value.includes('Edg/')
      ? 'Edge'
      : value.includes('Chrome/')
        ? 'Chrome'
        : value.includes('Firefox/')
          ? 'Firefox'
          : value.includes('Safari/')
            ? 'Safari'
            : 'Browser';
    const os = value.includes('Windows')
      ? 'Windows'
      : value.includes('Mac OS X')
        ? 'macOS'
        : value.includes('Android')
          ? 'Android'
          : value.includes('iPhone') || value.includes('iPad')
            ? 'iOS'
            : value.includes('Linux')
              ? 'Linux'
              : null;

    return [browser, os].filter(Boolean).join(' on ');
  }

  private maskIpAddress(value: string | null) {
    if (!value) {
      return null;
    }

    if (value.includes(':')) {
      const segments = value.split(':').filter(Boolean);

      return segments.length > 1
        ? `${segments.slice(0, 2).join(':')}:...`
        : `${value.slice(0, 6)}...`;
    }

    const parts = value.split('.');

    if (parts.length === 4) {
      return `${parts.slice(0, 3).join('.')}.x`;
    }

    return 'masked';
  }

  private async revokeAllUserSessions(userId: string) {
    await this.prisma.userRefreshSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private recordRefreshFailure(
    reason: string,
    userId: string | undefined,
    metadata: AuthSessionMetadata,
    eventType:
      | 'auth.refresh.failure'
      | 'auth.refresh.reuse_detected' = 'auth.refresh.failure',
  ) {
    this.logger.warn(
      `Refresh failed reason=${reason}${userId ? ` userId=${userId}` : ''}`,
    );
    this.metricsService?.recordAuthRefresh('failure', reason);

    void this.securityAudit?.record({
      eventType,
      ipAddress: metadata.ipAddress ?? null,
      metadata: {
        reason,
      },
      requestId: metadata.requestId ?? null,
      severity:
        eventType === 'auth.refresh.reuse_detected' ? 'critical' : 'warning',
      userAgent: metadata.userAgent ?? null,
      userId: userId ?? null,
    });
  }
}
