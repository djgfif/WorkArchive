import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';

import { getRefreshTokenCookieOptions } from '../src/modules/auth/auth.cookies';
import { hashSecret, verifySecret } from '../src/modules/auth/auth-crypto';
import { AuthService } from '../src/modules/auth/auth.service';
import type { PrismaService } from '../src/prisma/prisma.service';

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

function createPrismaMock() {
  const users: MockUser[] = [];
  const passwordResetTokens: MockPasswordResetToken[] = [];

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
      }) =>
        passwordResetTokens.find((token) => token.id === where.id) ?? null,
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
    users,
  };
}

describe('AuthService', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/work_archive';
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

  it('resets a password once and clears the existing refresh session', async () => {
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
    const requestResponse = await authService.requestPasswordReset({
      email: 'frieren@example.com',
    });
    const token = new URL(requestResponse.developmentResetUrl ?? '').searchParams.get(
      'token',
    );

    await expect(
      authService.confirmPasswordReset({
        password: 'new-password-123',
        token: token ?? '',
      }),
    ).resolves.toEqual({
      message: '비밀번호가 재설정되었습니다.',
    });
    expect(await verifySecret('new-password-123', users[0]?.passwordHash ?? '')).toBe(
      true,
    );
    expect(users[0]?.refreshTokenHash).toBeNull();
    expect(passwordResetTokens[0]?.usedAt).toBeInstanceOf(Date);

    await expect(
      authService.confirmPasswordReset({
        password: 'another-password-123',
        token: token ?? '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('tracks remember-me session intent on login', async () => {
    const { prisma, users } = createPrismaMock();
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
  });
});

describe('refresh cookie options', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/work_archive';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  it('omits maxAge for browser-session cookies when remember-me is off', () => {
    expect(getRefreshTokenCookieOptions({ rememberMe: false })).not.toHaveProperty(
      'maxAge',
    );
  });

  it('uses a 30-day persistent cookie when remember-me is on', () => {
    expect(getRefreshTokenCookieOptions({ rememberMe: true })).toMatchObject({
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
  });
});
