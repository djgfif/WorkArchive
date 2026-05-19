import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { getRefreshTokenCookieOptions } from '../src/modules/auth/auth.cookies';
import { hashSecret, verifySecret } from '../src/modules/auth/auth-crypto';
import { AuthService } from '../src/modules/auth/auth.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const ORIGINAL_ENV = { ...process.env };

interface MockUser {
  id: string;
  email: string;
  passwordHash: string;
  refreshTokenHash: string | null;
  nickname: string;
  role: 'user';
}

interface MockPasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

interface MockUserRefreshSession {
  id: string;
  userId: string;
  tokenHash: string;
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
  const passwordResetTokens: MockPasswordResetToken[] = [];
  const userRefreshSessions: MockUserRefreshSession[] = [];

  const prisma = {
    $transaction: async <T>(promises: Promise<T>[]) => Promise.all(promises),
    user: {
      findUnique: async ({
        where,
      }: {
        where: {
          email?: string;
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

          return true;
        }) ?? null,
      create: async ({
        data,
      }: {
        data: Partial<MockUser> & Pick<MockUser, 'email' | 'passwordHash'>;
      }) => {
        const user = {
          email: data.email,
          id: data.id ?? crypto.randomUUID(),
          nickname: data.nickname ?? '',
          passwordHash: data.passwordHash,
          refreshTokenHash: data.refreshTokenHash ?? null,
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
              'createdAt' | 'revokedAt' | 'rotatedAt' | 'updatedAt'
            >
          >;
      }) => {
        const now = new Date();
        const session = {
          ...data,
          createdAt: data.createdAt ?? now,
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
          id?: string;
          revokedAt?: null;
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

          if ('revokedAt' in where && session.revokedAt !== where.revokedAt) {
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
    passwordResetToken: {
      create: async ({
        data,
      }: {
        data: Omit<MockPasswordResetToken, 'createdAt' | 'usedAt'>;
      }) => {
        const token = {
          ...data,
          createdAt: new Date(),
          usedAt: null,
        };

        passwordResetTokens.push(token);

        return token;
      },
      findUnique: async ({
        where,
      }: {
        where: {
          id: string;
        };
      }) => passwordResetTokens.find((token) => token.id === where.id) ?? null,
      updateMany: async ({
        data,
        where,
      }: {
        data: Partial<MockPasswordResetToken>;
        where: {
          id?: string;
          usedAt?: null;
          userId?: string;
        };
      }) => {
        let count = 0;

        for (const token of passwordResetTokens) {
          if (where.id && token.id !== where.id) {
            continue;
          }

          if (where.userId && token.userId !== where.userId) {
            continue;
          }

          if ('usedAt' in where && token.usedAt !== where.usedAt) {
            continue;
          }

          Object.assign(token, data);
          count += 1;
        }

        return {
          count,
        };
      },
    },
  };

  return {
    passwordResetTokens,
    prisma,
    userRefreshSessions,
    users,
  };
}

describe('AuthService', () => {
  beforeEach(() => {
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/work_archive';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.PASSWORD_RESET_DEV_LINKS_ENABLED = 'true';
    process.env.WEB_BASE_URL = 'http://127.0.0.1:53173';
  });

  it('creates development password reset links without exposing the token hash', async () => {
    const { passwordResetTokens, prisma, users } = createPrismaMock();
    users.push({
      email: 'frieren@example.com',
      id: 'user-1',
      nickname: '',
      passwordHash: await hashSecret('old-password-123'),
      refreshTokenHash: 'existing-refresh-hash',
      role: 'user',
    });
    const authService = new AuthService(prisma as unknown as PrismaService);

    const response = await authService.requestPasswordReset({
      email: 'FRIEREN@example.com',
    });

    expect(response.developmentResetUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:53173\/auth\/password-reset\/confirm\?token=/,
    );
    expect(passwordResetTokens).toHaveLength(1);
    expect(response.developmentResetUrl).not.toContain(
      passwordResetTokens[0]?.tokenHash ?? '',
    );
  });

  it('returns the same request shape for unknown emails', async () => {
    const { passwordResetTokens, prisma } = createPrismaMock();
    const authService = new AuthService(prisma as unknown as PrismaService);

    await expect(
      authService.requestPasswordReset({
        email: 'missing@example.com',
      }),
    ).resolves.toEqual({
      message:
        '비밀번호 재설정 요청을 확인했습니다. 계정이 있으면 재설정 링크를 사용할 수 있습니다.',
    });
    expect(passwordResetTokens).toHaveLength(0);
  });

  it('resets a password once and revokes existing refresh sessions', async () => {
    const { passwordResetTokens, prisma, userRefreshSessions, users } =
      createPrismaMock();
    users.push({
      email: 'frieren@example.com',
      id: 'user-1',
      nickname: '',
      passwordHash: await hashSecret('old-password-123'),
      refreshTokenHash: 'existing-refresh-hash',
      role: 'user',
    });
    userRefreshSessions.push({
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      id: 'session-1',
      ipAddress: null,
      lastUsedAt: null,
      rememberMe: true,
      revokedAt: null,
      rotatedAt: null,
      tokenHash: 'existing-session-hash',
      updatedAt: new Date(),
      userAgent: null,
      userId: 'user-1',
    });
    const authService = new AuthService(prisma as unknown as PrismaService);
    const requestResponse = await authService.requestPasswordReset({
      email: 'frieren@example.com',
    });
    const token = new URL(
      requestResponse.developmentResetUrl ?? '',
    ).searchParams.get('token');

    await expect(
      authService.confirmPasswordReset({
        password: 'new-password-123',
        token: token ?? '',
      }),
    ).resolves.toEqual({
      message: '비밀번호가 재설정되었습니다.',
    });
    expect(
      await verifySecret('new-password-123', users[0]?.passwordHash ?? ''),
    ).toBe(true);
    expect(userRefreshSessions[0]?.revokedAt).toBeInstanceOf(Date);
    expect(passwordResetTokens[0]?.usedAt).toBeInstanceOf(Date);

    await expect(
      authService.confirmPasswordReset({
        password: 'another-password-123',
        token: token ?? '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('tracks remember-me session intent on login without using the legacy user column', async () => {
    const { prisma, userRefreshSessions, users } = createPrismaMock();
    users.push({
      email: 'frieren@example.com',
      id: 'user-1',
      nickname: '',
      passwordHash: await hashSecret('old-password-123'),
      refreshTokenHash: null,
      role: 'user',
    });
    const authService = new AuthService(prisma as unknown as PrismaService);

    await expect(
      authService.login({
        email: 'frieren@example.com',
        password: 'old-password-123',
        rememberMe: false,
      }),
    ).resolves.toMatchObject({
      rememberMe: false,
    });
    expect(users[0]?.refreshTokenHash).toBeNull();
    expect(userRefreshSessions).toHaveLength(1);
    expect(userRefreshSessions[0]).toMatchObject({
      rememberMe: false,
      userId: 'user-1',
    });
    expect(userRefreshSessions[0]?.tokenHash).toEqual(expect.any(String));
  });

  it('keeps multiple refresh sessions independent until token reuse is detected', async () => {
    const { prisma, userRefreshSessions, users } = createPrismaMock();
    users.push({
      email: 'frieren@example.com',
      id: 'user-1',
      nickname: '',
      passwordHash: await hashSecret('old-password-123'),
      refreshTokenHash: null,
      role: 'user',
    });
    const authService = new AuthService(prisma as unknown as PrismaService);

    const firstSession = await authService.login({
      email: 'frieren@example.com',
      password: 'old-password-123',
    });
    const secondSession = await authService.login({
      email: 'frieren@example.com',
      password: 'old-password-123',
    });

    expect(userRefreshSessions).toHaveLength(2);

    await expect(
      authService.refresh(firstSession.refreshToken),
    ).resolves.toEqual(
      expect.objectContaining({
        sessionId: firstSession.sessionId,
      }),
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
      authService.refresh(firstSession.refreshToken),
    ).rejects.toThrow('Invalid or expired refresh token.');
    expect(userRefreshSessions.every((session) => session.revokedAt)).toBe(
      true,
    );
  });

  it('rejects access tokens after their backing refresh session is revoked', async () => {
    const { prisma, userRefreshSessions, users } = createPrismaMock();
    users.push({
      email: 'frieren@example.com',
      id: 'user-1',
      nickname: '',
      passwordHash: await hashSecret('old-password-123'),
      refreshTokenHash: null,
      role: 'user',
    });
    const authService = new AuthService(prisma as unknown as PrismaService);
    const session = await authService.login({
      email: 'frieren@example.com',
      password: 'old-password-123',
    });

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
    process.env.PASSWORD_RESET_DEV_LINKS_ENABLED = 'false';
    process.env.SWAGGER_ENABLED = 'false';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-minimum-32-chars';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-chars';

    expect(getRefreshTokenCookieOptions()).toMatchObject({
      httpOnly: true,
      path: '/api/auth',
      sameSite: 'strict',
      secure: true,
    });
  });
});
