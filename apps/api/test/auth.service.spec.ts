import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { getRefreshTokenCookieOptions } from '../src/modules/auth/auth.cookies';
import {
  AuthService,
  type IssuedAuthSession,
} from '../src/modules/auth/auth.service';
import { GoogleOAuthClient } from '../src/modules/auth/google-oauth-client';
import { setExternalFetchTransportForTest } from '../src/common/external-fetch';
import type { PrismaService } from '../src/prisma/prisma.service';

const ORIGINAL_ENV = { ...process.env };

interface MockUser {
  id: string;
  avatarUrl: string;
  email: string;
  handle: string | null;
  nickname: string;
  role: 'user';
}

interface MockUserRefreshSession {
  id: string;
  userId: string;
  tokenHash: string;
  previousTokenHash: string | null;
  previousRotatedAt: Date | null;
  rememberMe: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
  rotatedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
}

function createPrismaMock() {
  const users: MockUser[] = [];
  const userRefreshSessions: MockUserRefreshSession[] = [];

  const prisma = {
    $transaction: async <T>(promises: Promise<T>[]) => Promise.all(promises),
    user: {
      findUnique: async ({
        where,
      }: {
        where: {
          email?: string;
          handle?: string;
          id?: string;
        };
      }) =>
        users.find((user) => {
          if (where.id && user.id !== where.id) {
            return false;
          }

          if (where.email && user.email !== where.email) {
            return false;
          }

          if (where.handle && user.handle !== where.handle) {
            return false;
          }

          return true;
        }) ?? null,
      create: async ({
        data,
      }: {
        data: Partial<MockUser> & Pick<MockUser, 'email'>;
      }) => {
        const user = {
          avatarUrl: data.avatarUrl ?? '',
          email: data.email,
          handle: data.handle ?? null,
          id: data.id ?? crypto.randomUUID(),
          nickname: data.nickname ?? '',
          role: data.role ?? 'user',
        } satisfies MockUser;

        users.push(user);

        return user;
      },
      update: async ({
        data,
        where,
      }: {
        data: Partial<MockUser>;
        where: {
          id: string;
        };
      }) => {
        const index = users.findIndex((user) => user.id === where.id);

        if (index === -1) {
          throw new Error('user not found');
        }

        const currentUser = users[index];

        if (!currentUser) {
          throw new Error('user not found');
        }

        users[index] = {
          ...currentUser,
          ...data,
        };

        return users[index];
      },
    },
    userRefreshSession: {
      create: async ({
        data,
      }: {
        data: Omit<
          MockUserRefreshSession,
          'createdAt' | 'revokedAt' | 'rotatedAt' | 'updatedAt'
        > &
          Partial<
            Pick<
              MockUserRefreshSession,
              | 'createdAt'
              | 'previousRotatedAt'
              | 'previousTokenHash'
              | 'revokedAt'
              | 'rotatedAt'
              | 'updatedAt'
            >
          >;
      }) => {
        const now = new Date();
        const session = {
          ...data,
          createdAt: data.createdAt ?? now,
          previousRotatedAt: data.previousRotatedAt ?? null,
          previousTokenHash: data.previousTokenHash ?? null,
          revokedAt: data.revokedAt ?? null,
          rotatedAt: data.rotatedAt ?? null,
          updatedAt: data.updatedAt ?? now,
        };

        userRefreshSessions.push(session);

        return session;
      },
      findMany: async ({
        orderBy,
        where,
      }: {
        orderBy?: {
          createdAt?: 'asc' | 'desc';
        };
        where?: {
          expiresAt?: {
            gt: Date;
          };
          revokedAt?: null;
          userId?: string;
        };
      } = {}) =>
        [...userRefreshSessions]
          .filter((session) => {
            if (where?.userId && session.userId !== where.userId) {
              return false;
            }

            if (where?.revokedAt === null && session.revokedAt !== null) {
              return false;
            }

            if (
              where?.expiresAt?.gt &&
              session.expiresAt.getTime() <= where.expiresAt.gt.getTime()
            ) {
              return false;
            }

            return true;
          })
          .sort((left, right) => {
            const delta = left.createdAt.getTime() - right.createdAt.getTime();

            return orderBy?.createdAt === 'asc' ? delta : -delta;
          }),
      findUnique: async ({
        include,
        where,
      }: {
        include?: {
          user?: boolean;
        };
        where: {
          id: string;
        };
      }) => {
        const session =
          userRefreshSessions.find((candidate) => candidate.id === where.id) ??
          null;

        if (!session || !include?.user) {
          return session;
        }

        return {
          ...session,
          user: users.find((user) => user.id === session.userId),
        };
      },
      update: async ({
        data,
        where,
      }: {
        data: Partial<MockUserRefreshSession>;
        where: {
          id: string;
        };
      }) => {
        const index = userRefreshSessions.findIndex(
          (session) => session.id === where.id,
        );

        if (index === -1) {
          throw new Error('session not found');
        }

        userRefreshSessions[index] = {
          ...userRefreshSessions[index]!,
          ...data,
          updatedAt: new Date(),
        };

        return userRefreshSessions[index];
      },
      updateMany: async ({
        data,
        where,
      }: {
        data: Partial<MockUserRefreshSession>;
        where: {
          expiresAt?: {
            gt: Date;
          };
          id?: string;
          revokedAt?: null;
          tokenHash?: string;
          userId?: string;
        };
      }) => {
        let count = 0;

        for (const session of userRefreshSessions) {
          if (where.id && session.id !== where.id) {
            continue;
          }

          if (where.userId && session.userId !== where.userId) {
            continue;
          }

          if (where.tokenHash && session.tokenHash !== where.tokenHash) {
            continue;
          }

          if ('revokedAt' in where && session.revokedAt !== where.revokedAt) {
            continue;
          }

          if (
            where.expiresAt?.gt &&
            session.expiresAt.getTime() <= where.expiresAt.gt.getTime()
          ) {
            continue;
          }

          Object.assign(session, data, {
            updatedAt: new Date(),
          });
          count += 1;
        }

        return {
          count,
        };
      },
    },
  };

  return {
    prisma,
    userRefreshSessions,
    users,
  };
}

async function issueSession(
  authService: AuthService,
  user: MockUser,
  rememberMe = true,
  metadata: { ipAddress?: string | null; userAgent?: string | null } = {},
): Promise<IssuedAuthSession> {
  return (
    authService as unknown as {
      createSessionForUser: (
        user: MockUser,
        rememberMe?: boolean,
        metadata?: { ipAddress?: string | null; userAgent?: string | null },
      ) => Promise<IssuedAuthSession>;
    }
  ).createSessionForUser(user, rememberMe, metadata);
}

describe('AuthService', () => {
  afterEach(() => {
    setExternalFetchTransportForTest(null);
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/work_archive';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.WEB_BASE_URL = 'http://localhost:18730';
    setExternalFetchTransportForTest(async () => new Response('{}'));
  });

  it('tracks remember-me session intent without using the legacy user column', async () => {
    const { prisma, userRefreshSessions, users } = createPrismaMock();
    const user = {
      avatarUrl: '',
      email: 'frieren@example.com',
      handle: null,
      id: 'user-1',
      nickname: '',      role: 'user',
    } satisfies MockUser;
    users.push(user);
    const authService = new AuthService(prisma as unknown as PrismaService);

    await expect(issueSession(authService, user, false)).resolves.toMatchObject(
      {
        rememberMe: false,
      },
    );
    expect(userRefreshSessions).toHaveLength(1);
    expect(userRefreshSessions[0]).toMatchObject({
      rememberMe: false,
      userId: 'user-1',
    });
    expect(userRefreshSessions[0]?.tokenHash).toEqual(expect.any(String));
  });

  it('stores only masked session network metadata', async () => {
    const { prisma, userRefreshSessions, users } = createPrismaMock();
    const user = {
      avatarUrl: '',
      email: 'frieren@example.com',
      handle: null,
      id: 'user-1',
      nickname: '',      role: 'user',
    } satisfies MockUser;
    users.push(user);
    const authService = new AuthService(prisma as unknown as PrismaService);

    await issueSession(authService, user, true, {
      ipAddress: '203.0.113.42',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });

    expect(userRefreshSessions[0]).toMatchObject({
      ipAddress: '203.0.113.x',
      userAgent: 'Chrome on macOS',
    });
  });

  it('keeps multiple refresh sessions independent until token reuse is detected', async () => {
    const { prisma, userRefreshSessions, users } = createPrismaMock();
    const user = {
      avatarUrl: '',
      email: 'frieren@example.com',
      handle: null,
      id: 'user-1',
      nickname: '',      role: 'user',
    } satisfies MockUser;
    users.push(user);
    const authService = new AuthService(prisma as unknown as PrismaService);

    const firstSession = await issueSession(authService, user);
    const secondSession = await issueSession(authService, user);

    expect(userRefreshSessions).toHaveLength(2);

    await expect(
      authService.refresh(firstSession.refreshToken!),
    ).resolves.toEqual(
      expect.objectContaining({
        sessionId: firstSession.sessionId,
      }),
    );
    userRefreshSessions[0]!.previousRotatedAt = new Date(
      Date.now() - 16_000,
    );
    expect(
      userRefreshSessions.find(
        (session) => session.id === secondSession.sessionId,
      )?.revokedAt,
    ).toBeNull();

    await authService.logout(secondSession.refreshToken);
    expect(
      userRefreshSessions.find(
        (session) => session.id === firstSession.sessionId,
      )?.revokedAt,
    ).toBeNull();
    expect(
      userRefreshSessions.find(
        (session) => session.id === secondSession.sessionId,
      )?.revokedAt,
    ).toBeInstanceOf(Date);

    await expect(
      authService.refresh(firstSession.refreshToken!),
    ).rejects.toThrow('Invalid or expired refresh token.');
    expect(userRefreshSessions.every((session) => session.revokedAt)).toBe(
      true,
    );
  });

  it('allows a lost refresh rotation race without overwriting the newer refresh cookie', async () => {
    const { prisma, userRefreshSessions, users } = createPrismaMock();
    const user = {
      avatarUrl: '',
      email: 'frieren@example.com',
      handle: null,
      id: 'user-1',
      nickname: '',      role: 'user',
    } satisfies MockUser;
    users.push(user);
    const authService = new AuthService(prisma as unknown as PrismaService);
    const session = await issueSession(authService, user);
    const originalTokenHash = userRefreshSessions[0]?.tokenHash;
    const originalUpdateMany = prisma.userRefreshSession.updateMany;
    let blockRotationUpdate = true;

    prisma.userRefreshSession.updateMany = async (input) => {
      if (
        blockRotationUpdate &&
        input.where.id === session.sessionId &&
        input.where.tokenHash === originalTokenHash &&
        input.data.tokenHash
      ) {
        blockRotationUpdate = false;
        await originalUpdateMany(input);

        return {
          count: 0,
        };
      }

      return originalUpdateMany(input);
    };

    await expect(authService.refresh(session.refreshToken!)).resolves.toEqual(
      expect.objectContaining({
        refreshToken: null,
        sessionId: session.sessionId,
      }),
    );
    expect(userRefreshSessions.every((candidate) => candidate.revokedAt)).toBe(
      false,
    );
    expect(userRefreshSessions[0]?.previousTokenHash).toEqual(
      expect.any(String),
    );
  });

  it('rejects access tokens after their backing refresh session is revoked', async () => {
    const { prisma, userRefreshSessions, users } = createPrismaMock();
    const user = {
      avatarUrl: '',
      email: 'frieren@example.com',
      handle: null,
      id: 'user-1',
      nickname: '',      role: 'user',
    } satisfies MockUser;
    users.push(user);
    const authService = new AuthService(prisma as unknown as PrismaService);
    const session = await issueSession(authService, user);

    await expect(
      authService.validateAccessToken(session.accessToken),
    ).resolves.toEqual(
      expect.objectContaining({
        sessionId: session.sessionId,
      }),
    );

    userRefreshSessions[0]!.revokedAt = new Date();

    await expect(
      authService.validateAccessToken(session.accessToken),
    ).rejects.toThrow('Session is no longer valid.');
  });

  it('updates nickname and handle for the current user', async () => {
    const { prisma, users } = createPrismaMock();
    users.push({
      email: 'frieren@example.com',
      avatarUrl: '',
      handle: 'frieren',
      id: 'user-1',
      nickname: 'Frieren',      role: 'user',
    });
    const authService = new AuthService(prisma as unknown as PrismaService);

    await expect(
      authService.updateProfile('user-1', {
        handle: 'mage_frieren',
        nickname: 'Mage Frieren',
        avatarUrl: 'https://example.com/frieren.jpg',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        email: 'frieren@example.com',
        avatarUrl: 'https://example.com/frieren.jpg',
        handle: 'mage_frieren',
        nickname: 'Mage Frieren',
      }),
    );
    expect(users[0]).toMatchObject({
      handle: 'mage_frieren',
      nickname: 'Mage Frieren',
      avatarUrl: 'https://example.com/frieren.jpg',
    });
  });

  it('allows keeping the current handle and clearing it', async () => {
    const { prisma, users } = createPrismaMock();
    users.push({
      email: 'frieren@example.com',
      avatarUrl: '',
      handle: 'frieren',
      id: 'user-1',
      nickname: 'Frieren',      role: 'user',
    });
    const authService = new AuthService(prisma as unknown as PrismaService);

    await expect(
      authService.updateProfile('user-1', {
        handle: 'frieren',
        nickname: 'Frieren the Slayer',
        avatarUrl: '',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        handle: 'frieren',
        nickname: 'Frieren the Slayer',
      }),
    );

    await expect(
      authService.updateProfile('user-1', {
        handle: null,
        nickname: 'Frieren',
        avatarUrl: '',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        handle: null,
        nickname: 'Frieren',
      }),
    );
  });

  it('rejects reserved and duplicate handles', async () => {
    const { prisma, users } = createPrismaMock();
    users.push(
      {
        email: 'frieren@example.com',
        avatarUrl: '',
        handle: 'frieren',
        id: 'user-1',
        nickname: 'Frieren',        role: 'user',
      },
      {
        email: 'fern@example.com',
        avatarUrl: '',
        handle: 'fern',
        id: 'user-2',
        nickname: 'Fern',        role: 'user',
      },
    );
    const authService = new AuthService(prisma as unknown as PrismaService);

    await expect(
      authService.updateProfile('user-1', {
        handle: 'admin',
        nickname: 'Frieren',
        avatarUrl: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      authService.updateProfile('user-1', {
        handle: 'fern',
        nickname: 'Frieren',
        avatarUrl: '',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('fails Google token exchange quickly when the upstream request aborts', async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_OAUTH_REDIRECT_URI =
      'http://localhost:18730/api/auth/google/callback';
    const googleOAuthClient = new GoogleOAuthClient();
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    setExternalFetchTransportForTest(async () => {
      throw new DOMException('aborted', 'AbortError');
    });

    await expect(
      googleOAuthClient.exchangeAuthorizationCode('oauth-code-secret'),
    ).rejects.toThrow('Google login could not be completed.');

    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain(
      'oauth-code-secret',
    );
  });

  it('uses stale Google JWKS cache only when the requested kid is cached', async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_OAUTH_REDIRECT_URI =
      'http://localhost:18730/api/auth/google/callback';
    const googleOAuthClient = new GoogleOAuthClient();

    googleOAuthClient.googleSigningKeysCache = {
      expiresAt: Date.now() - 1,
      fetchedAt: Date.now() - 1_000,
      keysByKid: new Map([['cached-kid', 'cached-pem']]),
    };
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    setExternalFetchTransportForTest(async () => {
      throw new DOMException('aborted', 'AbortError');
    });

    await expect(
      googleOAuthClient.getSigningKey('cached-kid'),
    ).resolves.toBe('cached-pem');

    await expect(
      googleOAuthClient.getSigningKey('missing-kid'),
    ).rejects.toThrow('Google signing keys are unavailable.');
  });
});

describe('refresh cookie options', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  beforeEach(() => {
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/work_archive';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  it('omits maxAge for browser-session cookies when remember-me is off', () => {
    expect(
      getRefreshTokenCookieOptions({ rememberMe: false }),
    ).not.toHaveProperty('maxAge');
  });

  it('uses a 30-day persistent cookie when remember-me is on', () => {
    expect(getRefreshTokenCookieOptions({ rememberMe: true })).toMatchObject({
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
  });

  it('uses strict secure refresh cookies in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECURE = 'true';
    process.env.CORS_ORIGIN = 'https://workarchive.example.com';
    process.env.DATABASE_URL =
      'postgresql://workarchive:secure-password@postgres:5432/work_archive';
    process.env.WEB_BASE_URL = 'https://workarchive.example.com';
    process.env.RATE_LIMIT_STORE = 'redis';
    process.env.REDIS_URL = 'redis://redis:6379';
    process.env.SECURITY_EVENT_HASH_SECRET =
      'production-security-event-hash-secret-minimum-32-chars';
    process.env.TRUST_PROXY_HOPS = '1';
    process.env.SEED_DEMO_PASSWORD = 'production-safe-demo-password';
    process.env.SWAGGER_ENABLED = 'false';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-minimum-32-chars';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-chars';
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'production-google-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'production-google-client-secret';
    process.env.GOOGLE_OAUTH_REDIRECT_URI =
      'https://workarchive.example.com/api/auth/google/callback';

    expect(getRefreshTokenCookieOptions()).toMatchObject({
      httpOnly: true,
      path: '/api/auth',
      sameSite: 'strict',
      secure: true,
    });
  });
});
