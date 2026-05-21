import { randomUUID } from 'node:crypto';

import { REFRESH_TOKEN_COOKIE_NAME } from '../src/modules/auth/auth.cookies';
import {
  AuthService,
  type IssuedAuthSession,
} from '../src/modules/auth/auth.service';
import type { PrismaService } from '../src/prisma/prisma.service';

interface CreateTestSessionInput {
  authService: AuthService;
  email: string;
  nickname?: string;
  prisma: PrismaService;
  rememberMe?: boolean;
}

export interface TestAuthSession {
  accessToken: string;
  cookie: string;
  refreshToken: string;
  sessionId: string;
  user: {
    email: string;
    id: string;
  };
  userId: string;
}

export async function createTestSession({
  authService,
  email,
  nickname = '',
  prisma,
  rememberMe = true,
}: CreateTestSessionInput): Promise<TestAuthSession> {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    include: {
      authAccounts: true,
    },
  });
  const user =
    existingUser ??
    (await prisma.user.create({
      data: {
        email: normalizedEmail,
        nickname,
        passwordHash: null,
        authAccounts: {
          create: {
            email: normalizedEmail,
            emailVerified: true,
            name: nickname,
            pictureUrl: '',
            provider: 'google',
            providerAccountId: `test-${randomUUID()}`,
          },
        },
      },
      include: {
        authAccounts: true,
      },
    }));

  const session = await (
    authService as unknown as {
      createSessionForUser: (
        user: unknown,
        rememberMe?: boolean,
      ) => Promise<IssuedAuthSession>;
    }
  ).createSessionForUser(user, rememberMe);

  return {
    accessToken: session.accessToken,
    cookie: `${REFRESH_TOKEN_COOKIE_NAME}=${session.refreshToken}`,
    refreshToken: session.refreshToken,
    sessionId: session.sessionId,
    user: {
      email: user.email,
      id: user.id,
    },
    userId: user.id,
  };
}
