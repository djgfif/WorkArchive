import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import jwt from 'jsonwebtoken';

import { getRefreshTokenCookieOptions } from '../src/modules/auth/auth.cookies';
import {
  AuthService,
  type IssuedAuthSession,
} from '../src/modules/auth/auth.service';
import { GoogleOAuthClient } from '../src/modules/auth/google-oauth-client';
import { setExternalFetchTransportForTest } from '../src/common/external-fetch';
import type { MetricsService } from '../src/observability/metrics.service';
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

function createMetricsMock() {
  return {
    recordUserDataRights: jest.fn<MetricsService['recordUserDataRights']>(),
  };
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

function createUserDataExportPrismaMock() {
  const now = new Date('2026-06-20T00:00:00.000Z');
  const findMany = (rows: unknown[]) =>
    jest
      .fn<(...args: unknown[]) => Promise<unknown[]>>()
      .mockResolvedValue(rows);
  const prisma = {
    $transaction: async (promises: Promise<unknown>[]) => Promise.all(promises),
    user: {
      findUniqueOrThrow: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue({
          authAccounts: [
            {
              email: 'frieren@example.com',
              emailVerified: true,
              name: 'Frieren',
              pictureUrl: '',
              provider: 'google',
            },
          ],
          avatarUrl: '',
          email: 'frieren@example.com',
          handle: 'mage_frieren',
          id: 'user-1',
          nickname: 'Mage Frieren',
          role: 'user',
        }),
    },
    userRefreshSession: {
      findMany: findMany([
        {
          id: 'session-1',
          rememberMe: true,
          userAgent: 'Chrome on Linux',
          ipAddress: '203.0.113.x',
          createdAt: now,
          updatedAt: now,
          lastUsedAt: now,
          rotatedAt: now,
          expiresAt: now,
          revokedAt: null,
        },
      ]),
    },
    externalApiCredential: {
      findMany: findMany([
        {
          id: 'credential-1',
          provider: 'aladin',
          createdAt: now,
          updatedAt: now,
        },
      ]),
    },
    userSyncAppliedMutation: {
      findMany: findMany([
        {
          id: 'mutation-1',
          clientMutationId: 'client-mutation-1',
          queueId: 'queue-1',
          entityType: 'work',
          entityId: 'work-1',
          payloadHash: 'hash-1',
          result: {
            payload: {
              title: 'raw sync payload',
            },
          },
          resultStatus: 'applied',
          expiresAt: now,
          createdAt: now,
        },
      ]),
    },
    userWorkRecord: { findMany: findMany([{ id: 'work-1' }]) },
    userReleaseRecord: { findMany: findMany([]) },
    userTimelineEntry: { findMany: findMany([]) },
    notionSyncMapping: { findMany: findMany([]) },
    notionPullPreviewSnapshot: {
      findMany: findMany([
        {
          id: 'snapshot-1',
          notionDataSourceId: 'notion-ds-1',
          changes: [
            {
              after: {
                title: 'raw Notion preview payload',
              },
            },
          ],
          previewedAt: now,
          expiresAt: now,
          createdAt: now,
        },
      ]),
    },
    userSeries: { findMany: findMany([]) },
    userWorkSeriesLink: { findMany: findMany([]) },
    userContributor: { findMany: findMany([]) },
    userWorkContributor: { findMany: findMany([]) },
    userWorkRelation: { findMany: findMany([]) },
    userTierBoard: { findMany: findMany([]) },
    userTierLane: { findMany: findMany([]) },
    userTierBoardCard: { findMany: findMany([]) },
    userTierBoardAsset: { findMany: findMany([]) },
    catalogSubmission: {
      findMany: findMany([
        {
          id: 'submission-1',
          status: 'pending',
          entityType: 'catalog_work',
          entityId: 'catalog-work-1',
          action: 'create',
          payload: {
            description: 'raw catalog submission payload',
          },
          note: 'operator-only note',
          reviewNote: 'review note',
          reviewedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ]),
    },
    userCommunityProfile: {
      findMany: findMany([
        {
          allowFollowers: true,
          bio: '마법 여행 기록을 좋아합니다.',
          createdAt: now,
          favoriteCatalogTitleIds: ['catalog-title-1'],
          favoriteGenres: ['fantasy'],
          id: 'community-profile-1',
          notifyBrowser: false,
          notifyGlobalBadge: true,
          notifyInCommunity: true,
          showBoardPosts: true,
          showFollowers: true,
          showRatings: true,
          showReviews: true,
          showTasteSummary: true,
          updatedAt: now,
          visibility: 'public',
        },
      ]),
    },
    communityPost: {
      findMany: findMany([
        {
          body: '공개한 감상',
          createdAt: now,
          hiddenAt: null,
          id: 'community-post-1',
          reactionCount: 2,
          spoiler: false,
          status: 'published',
          updatedAt: now,
          workThumbnailUrl: '',
          workTitle: '장송의 프리렌',
          workType: 'anime',
        },
      ]),
    },
    communityReview: {
      findMany: findMany([
        {
          body: '오래 남는 여정',
          catalogTitleId: 'catalog-title-1',
          commentCount: 1,
          createdAt: now,
          deletedAt: null,
          hiddenAt: null,
          id: 'community-review-1',
          rating: 4.5,
          reactionCount: 3,
          spoiler: false,
          status: 'published',
          updatedAt: now,
        },
      ]),
    },
    communityReaction: {
      findMany: findMany([
        {
          createdAt: now,
          id: 'community-reaction-1',
          postId: 'community-post-2',
        },
      ]),
    },
    communityReviewReaction: {
      findMany: findMany([
        {
          createdAt: now,
          id: 'community-review-reaction-1',
          reviewId: 'community-review-2',
        },
      ]),
    },
    communityComment: {
      findMany: findMany([
        {
          body: '동의합니다.',
          createdAt: now,
          deletedAt: null,
          id: 'community-comment-1',
          parentId: null,
          postId: null,
          reactionCount: 1,
          reviewId: 'community-review-2',
          spoiler: false,
          status: 'published',
          updatedAt: now,
        },
      ]),
    },
    communityCommentReaction: {
      findMany: findMany([
        {
          commentId: 'community-comment-2',
          createdAt: now,
          id: 'community-comment-reaction-1',
        },
      ]),
    },
    communityFollow: {
      findMany: findMany([
        {
          createdAt: now,
          followerId: 'user-1',
          followingId: 'user-2',
          id: 'community-follow-1',
        },
      ]),
    },
    communityNotification: {
      findMany: findMany([
        {
          actorId: 'user-2',
          createdAt: now,
          id: 'community-notification-1',
          readAt: null,
          targetId: 'community-review-1',
          targetType: 'review',
          type: 'reaction',
        },
      ]),
    },
    communityReport: {
      findMany: findMany([
        {
          createdAt: now,
          detail: '스팸 링크',
          id: 'community-report-1',
          commentId: null,
          postId: 'community-post-3',
          reviewId: null,
          reason: 'spam',
          resolvedAt: null,
          status: 'pending',
          updatedAt: now,
        },
      ]),
    },
    securityEvent: { findMany: findMany([{ id: 'event-1' }]) },
  };

  return prisma;
}

function createAccountDeletionPrismaMock() {
  const updateMany = (count: number) =>
    jest
      .fn<(...args: unknown[]) => Promise<{ count: number }>>()
      .mockResolvedValue({ count });
  const prisma = {
    $transaction: async (promises: Promise<unknown>[]) => Promise.all(promises),
    catalogAuditLog: {
      updateMany: updateMany(3),
    },
    catalogSubmission: {
      updateMany: updateMany(2),
    },
    communityModerationAuditLog: {
      updateMany: updateMany(6),
    },
    communityReport: {
      updateMany: updateMany(5),
    },
    securityEvent: {
      updateMany: updateMany(4),
    },
    user: {
      delete: jest
        .fn<(...args: unknown[]) => Promise<{ id: string }>>()
        .mockResolvedValue({ id: 'user-1' }),
    },
  };

  return prisma;
}

function createAccountDeletionPreviewPrismaMock() {
  const count = (value: number) =>
    jest.fn<(...args: unknown[]) => Promise<number>>().mockResolvedValue(value);
  const prisma = {
    $transaction: async (promises: Promise<unknown>[]) => Promise.all(promises),
    catalogAuditLog: {
      count: count(3),
    },
    catalogSubmission: {
      count: count(2),
    },
    communityModerationAuditLog: {
      count: count(26),
    },
    communityPost: {
      count: count(22),
    },
    communityReaction: {
      count: count(23),
    },
    communityReport: {
      count: jest
        .fn<(...args: unknown[]) => Promise<number>>()
        .mockResolvedValueOnce(24)
        .mockResolvedValueOnce(25),
    },
    externalApiCredential: {
      count: count(4),
    },
    notionPullPreviewSnapshot: {
      count: count(5),
    },
    notionSyncMapping: {
      count: count(6),
    },
    securityEvent: {
      count: count(7),
    },
    userAuthAccount: {
      count: count(1),
    },
    userContributor: {
      count: count(8),
    },
    userRefreshSession: {
      count: count(9),
    },
    userReleaseRecord: {
      count: count(10),
    },
    userSeries: {
      count: count(11),
    },
    userSyncAppliedMutation: {
      count: count(12),
    },
    userTierBoard: {
      count: count(13),
    },
    userTierBoardAsset: {
      count: count(14),
    },
    userTierBoardCard: {
      count: count(15),
    },
    userTierLane: {
      count: count(16),
    },
    userTimelineEntry: {
      count: count(17),
    },
    userWorkContributor: {
      count: count(18),
    },
    userWorkRecord: {
      count: count(19),
    },
    userWorkRelation: {
      count: count(20),
    },
    userWorkSeriesLink: {
      count: count(21),
    },
  };

  return prisma;
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
      nickname: '',
      role: 'user',
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
      nickname: '',
      role: 'user',
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

  it('logs refresh failures as structured events without raw refresh tokens', async () => {
    const { prisma } = createPrismaMock();
    const authService = new AuthService(prisma as unknown as PrismaService);
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await expect(
      authService.refresh('raw-refresh-token-secret', {
        requestId: 'req-refresh-1',
      }),
    ).rejects.toThrow();

    const logPayload = String(warnSpy.mock.calls.at(-1)?.[0] ?? '');

    expect(JSON.parse(logPayload)).toEqual(
      expect.objectContaining({
        entityType: 'refresh_session',
        errorCode: 'invalid_or_expired_token',
        event: 'auth.refresh.failed',
        provider: null,
        requestId: 'req-refresh-1',
        userId: null,
      }),
    );
    expect(logPayload).not.toMatch(/raw-refresh-token-secret|refresh_token/i);
  });

  it('keeps multiple refresh sessions independent until token reuse is detected', async () => {
    const { prisma, userRefreshSessions, users } = createPrismaMock();
    const user = {
      avatarUrl: '',
      email: 'frieren@example.com',
      handle: null,
      id: 'user-1',
      nickname: '',
      role: 'user',
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
    userRefreshSessions[0]!.previousRotatedAt = new Date(Date.now() - 16_000);
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
      nickname: '',
      role: 'user',
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
      nickname: '',
      role: 'user',
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

  it('issues HS256 JWTs and rejects access tokens signed with another HMAC algorithm', async () => {
    const { prisma, users } = createPrismaMock();
    const user = {
      avatarUrl: '',
      email: 'frieren@example.com',
      handle: null,
      id: 'user-1',
      nickname: '',
      role: 'user',
    } satisfies MockUser;
    users.push(user);
    const authService = new AuthService(prisma as unknown as PrismaService);
    const session = await issueSession(authService, user);

    const decodedAccessToken = jwt.decode(session.accessToken, {
      complete: true,
    });

    expect(decodedAccessToken).toEqual(
      expect.objectContaining({
        header: expect.objectContaining({
          alg: 'HS256',
        }),
        payload: expect.objectContaining({
          aud: 'work-archive-web',
          iss: 'work-archive-api',
        }),
      }),
    );

    const forgedAccessToken = jwt.sign(
      {
        email: user.email,
        sid: session.sessionId,
        sub: user.id,
        type: 'access',
      },
      process.env.JWT_ACCESS_SECRET!,
      {
        algorithm: 'HS384',
        audience: 'work-archive-web',
        expiresIn: 60 * 15,
        issuer: 'work-archive-api',
        jwtid: 'forged-hs384-token',
      },
    );

    await expect(
      authService.validateAccessToken(forgedAccessToken),
    ).rejects.toThrow('Invalid or expired token.');
  });

  it('rejects access tokens with an unexpected issuer or audience', async () => {
    const { prisma, users } = createPrismaMock();
    const user = {
      avatarUrl: '',
      email: 'frieren@example.com',
      handle: null,
      id: 'user-1',
      nickname: '',
      role: 'user',
    } satisfies MockUser;
    users.push(user);
    const authService = new AuthService(prisma as unknown as PrismaService);
    const session = await issueSession(authService, user);
    const wrongAudienceToken = jwt.sign(
      {
        email: user.email,
        sid: session.sessionId,
        sub: user.id,
        type: 'access',
      },
      process.env.JWT_ACCESS_SECRET!,
      {
        algorithm: 'HS256',
        audience: 'other-client',
        expiresIn: 60 * 15,
        issuer: 'work-archive-api',
        jwtid: 'wrong-audience-token',
      },
    );
    const wrongIssuerToken = jwt.sign(
      {
        email: user.email,
        sid: session.sessionId,
        sub: user.id,
        type: 'access',
      },
      process.env.JWT_ACCESS_SECRET!,
      {
        algorithm: 'HS256',
        audience: 'work-archive-web',
        expiresIn: 60 * 15,
        issuer: 'other-issuer',
        jwtid: 'wrong-issuer-token',
      },
    );

    await expect(
      authService.validateAccessToken(wrongAudienceToken),
    ).rejects.toThrow('Invalid or expired token.');
    await expect(
      authService.validateAccessToken(wrongIssuerToken),
    ).rejects.toThrow('Invalid or expired token.');
  });

  it('rejects access tokens missing required registered JWT claims', async () => {
    const { prisma, users } = createPrismaMock();
    const user = {
      avatarUrl: '',
      email: 'frieren@example.com',
      handle: null,
      id: 'user-1',
      nickname: '',
      role: 'user',
    } satisfies MockUser;
    users.push(user);
    const authService = new AuthService(prisma as unknown as PrismaService);
    const session = await issueSession(authService, user);
    const missingJwtIdToken = jwt.sign(
      {
        email: user.email,
        sid: session.sessionId,
        sub: user.id,
        type: 'access',
      },
      process.env.JWT_ACCESS_SECRET!,
      {
        algorithm: 'HS256',
        audience: 'work-archive-web',
        expiresIn: 60 * 15,
        issuer: 'work-archive-api',
      },
    );
    const missingExpiryToken = jwt.sign(
      {
        email: user.email,
        sid: session.sessionId,
        sub: user.id,
        type: 'access',
      },
      process.env.JWT_ACCESS_SECRET!,
      {
        algorithm: 'HS256',
        audience: 'work-archive-web',
        issuer: 'work-archive-api',
        jwtid: 'missing-expiry-token',
        noTimestamp: true,
      },
    );

    await expect(
      authService.validateAccessToken(missingJwtIdToken),
    ).rejects.toThrow('Invalid or expired token.');
    await expect(
      authService.validateAccessToken(missingExpiryToken),
    ).rejects.toThrow('Invalid or expired token.');
  });

  it('rejects tokens whose kind-specific claims do not match the issued shape', async () => {
    const { prisma, users } = createPrismaMock();
    const user = {
      avatarUrl: '',
      email: 'frieren@example.com',
      handle: null,
      id: 'user-1',
      nickname: '',
      role: 'user',
    } satisfies MockUser;
    users.push(user);
    const authService = new AuthService(prisma as unknown as PrismaService);
    const session = await issueSession(authService, user);
    const accessTokenWithRememberMe = jwt.sign(
      {
        email: user.email,
        rememberMe: true,
        sid: session.sessionId,
        sub: user.id,
        type: 'access',
      },
      process.env.JWT_ACCESS_SECRET!,
      {
        algorithm: 'HS256',
        audience: 'work-archive-web',
        expiresIn: 60 * 15,
        issuer: 'work-archive-api',
        jwtid: 'access-token-with-remember-me',
      },
    );
    const refreshTokenWithoutRememberMe = jwt.sign(
      {
        email: user.email,
        sid: session.sessionId,
        sub: user.id,
        type: 'refresh',
      },
      process.env.JWT_REFRESH_SECRET!,
      {
        algorithm: 'HS256',
        audience: 'work-archive-web',
        expiresIn: 60 * 60,
        issuer: 'work-archive-api',
        jwtid: 'refresh-token-without-remember-me',
      },
    );

    await expect(
      authService.validateAccessToken(accessTokenWithRememberMe),
    ).rejects.toThrow('Invalid or expired token.');
    await expect(
      authService.refresh(refreshTokenWithoutRememberMe),
    ).rejects.toThrow('Invalid or expired token.');
  });

  it('rejects tokens whose identity claims are unsafe', async () => {
    const { prisma, users } = createPrismaMock();
    const user = {
      avatarUrl: '',
      email: 'frieren@example.com',
      handle: null,
      id: 'user-1',
      nickname: '',
      role: 'user',
    } satisfies MockUser;
    users.push(user);
    const authService = new AuthService(prisma as unknown as PrismaService);
    const session = await issueSession(authService, user);
    const accessTokenWithUnsafeSubject = jwt.sign(
      {
        email: user.email,
        sid: session.sessionId,
        sub: 'user:1',
        type: 'access',
      },
      process.env.JWT_ACCESS_SECRET!,
      {
        algorithm: 'HS256',
        audience: 'work-archive-web',
        expiresIn: 60 * 15,
        issuer: 'work-archive-api',
        jwtid: 'access-token-with-unsafe-subject',
      },
    );
    const refreshTokenWithUnsafeEmail = jwt.sign(
      {
        email: 'invalid email',
        rememberMe: true,
        sid: session.sessionId,
        sub: user.id,
        type: 'refresh',
      },
      process.env.JWT_REFRESH_SECRET!,
      {
        algorithm: 'HS256',
        audience: 'work-archive-web',
        expiresIn: 60 * 60,
        issuer: 'work-archive-api',
        jwtid: 'refresh-token-with-unsafe-email',
      },
    );

    await expect(
      authService.validateAccessToken(accessTokenWithUnsafeSubject),
    ).rejects.toThrow('Invalid or expired token.');
    await expect(
      authService.refresh(refreshTokenWithUnsafeEmail),
    ).rejects.toThrow('Invalid or expired token.');
  });

  it('rejects tokens whose lifetime exceeds the issued policy', async () => {
    const { prisma, users } = createPrismaMock();
    const user = {
      avatarUrl: '',
      email: 'frieren@example.com',
      handle: null,
      id: 'user-1',
      nickname: '',
      role: 'user',
    } satisfies MockUser;
    users.push(user);
    const authService = new AuthService(prisma as unknown as PrismaService);
    const session = await issueSession(authService, user);
    const longLivedAccessToken = jwt.sign(
      {
        email: user.email,
        sid: session.sessionId,
        sub: user.id,
        type: 'access',
      },
      process.env.JWT_ACCESS_SECRET!,
      {
        algorithm: 'HS256',
        audience: 'work-archive-web',
        expiresIn: 60 * 60,
        issuer: 'work-archive-api',
        jwtid: 'long-lived-access-token',
      },
    );
    const longLivedRefreshToken = jwt.sign(
      {
        email: user.email,
        rememberMe: true,
        sid: session.sessionId,
        sub: user.id,
        type: 'refresh',
      },
      process.env.JWT_REFRESH_SECRET!,
      {
        algorithm: 'HS256',
        audience: 'work-archive-web',
        expiresIn: 60 * 60 * 24 * 60,
        issuer: 'work-archive-api',
        jwtid: 'long-lived-refresh-token',
      },
    );

    await expect(
      authService.validateAccessToken(longLivedAccessToken),
    ).rejects.toThrow('Invalid or expired token.');
    await expect(authService.refresh(longLivedRefreshToken)).rejects.toThrow(
      'Invalid or expired token.',
    );
  });

  it('rejects tokens whose issued-at time is too far in the future', async () => {
    const { prisma, users } = createPrismaMock();
    const user = {
      avatarUrl: '',
      email: 'frieren@example.com',
      handle: null,
      id: 'user-1',
      nickname: '',
      role: 'user',
    } satisfies MockUser;
    users.push(user);
    const authService = new AuthService(prisma as unknown as PrismaService);
    const session = await issueSession(authService, user);
    const issuedAt = Math.floor(Date.now() / 1000) + 60 * 10;
    const futureIssuedAccessToken = jwt.sign(
      {
        email: user.email,
        exp: issuedAt + 60 * 15,
        iat: issuedAt,
        sid: session.sessionId,
        sub: user.id,
        type: 'access',
      },
      process.env.JWT_ACCESS_SECRET!,
      {
        algorithm: 'HS256',
        audience: 'work-archive-web',
        issuer: 'work-archive-api',
        jwtid: 'future-issued-access-token',
      },
    );
    const futureIssuedRefreshToken = jwt.sign(
      {
        email: user.email,
        exp: issuedAt + 60 * 60,
        iat: issuedAt,
        rememberMe: true,
        sid: session.sessionId,
        sub: user.id,
        type: 'refresh',
      },
      process.env.JWT_REFRESH_SECRET!,
      {
        algorithm: 'HS256',
        audience: 'work-archive-web',
        issuer: 'work-archive-api',
        jwtid: 'future-issued-refresh-token',
      },
    );

    await expect(
      authService.validateAccessToken(futureIssuedAccessToken),
    ).rejects.toThrow('Invalid or expired token.');
    await expect(authService.refresh(futureIssuedRefreshToken)).rejects.toThrow(
      'Invalid or expired token.',
    );
  });

  it('rejects tokens whose email claim no longer matches the user', async () => {
    const { prisma, userRefreshSessions, users } = createPrismaMock();
    const user = {
      avatarUrl: '',
      email: 'frieren@example.com',
      handle: null,
      id: 'user-1',
      nickname: '',
      role: 'user',
    } satisfies MockUser;
    users.push(user);
    const authService = new AuthService(prisma as unknown as PrismaService);
    const session = await issueSession(authService, user);

    users[0] = {
      ...users[0]!,
      email: 'changed@example.com',
    };

    await expect(
      authService.validateAccessToken(session.accessToken),
    ).rejects.toThrow('Session is no longer valid.');
    await expect(authService.refresh(session.refreshToken!)).rejects.toThrow(
      'Invalid or expired refresh token.',
    );
    expect(userRefreshSessions[0]?.revokedAt).toBeInstanceOf(Date);
  });

  it('updates nickname and handle for the current user', async () => {
    const { prisma, users } = createPrismaMock();
    users.push({
      email: 'frieren@example.com',
      avatarUrl: '',
      handle: 'frieren',
      id: 'user-1',
      nickname: 'Frieren',
      role: 'user',
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
      nickname: 'Frieren',
      role: 'user',
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
        nickname: 'Frieren',
        role: 'user',
      },
      {
        email: 'fern@example.com',
        avatarUrl: '',
        handle: 'fern',
        id: 'user-2',
        nickname: 'Fern',
        role: 'user',
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

  it('exports user-owned server data without selecting provider secrets or token hashes', async () => {
    const prisma = createUserDataExportPrismaMock();
    const metrics = createMetricsMock();
    const authService = new AuthService(
      prisma as unknown as PrismaService,
      undefined,
      metrics as unknown as MetricsService,
    );

    const exported = await authService.exportUserData({
      email: 'frieren@example.com',
      role: 'user',
      sessionId: 'session-1',
      userId: 'user-1',
    });

    expect(exported.user).toEqual(
      expect.objectContaining({
        email: 'frieren@example.com',
        handle: 'mage_frieren',
      }),
    );
    expect(exported.counts).toEqual(
      expect.objectContaining({
        catalogSubmissions: 1,
        communityComments: 1,
        communityCommentReactions: 1,
        communityFollows: 1,
        communityNotifications: 1,
        communityPosts: 1,
        communityProfiles: 1,
        communityReactions: 1,
        communityReports: 1,
        communityReviewReactions: 1,
        communityReviews: 1,
        externalApiCredentials: 1,
        notionPullPreviewSnapshots: 1,
        syncAppliedMutations: 1,
        refreshSessions: 1,
        workRecords: 1,
      }),
    );
    expect(exported.data.refreshSessions).toEqual([
      expect.objectContaining({
        current: true,
        id: 'session-1',
        ipAddress: '203.0.113.x',
      }),
    ]);
    expect(exported.data.communityProfiles).toEqual([
      expect.objectContaining({
        id: 'community-profile-1',
        visibility: 'public',
      }),
    ]);
    expect(exported.data.communityNotifications).toEqual([
      expect.objectContaining({
        id: 'community-notification-1',
        targetType: 'review',
      }),
    ]);
    expect(JSON.stringify(exported)).not.toMatch(
      /"(encryptedKey|authTag|iv|tokenHash|previousTokenHash|ipHash|userAgentHash)"\s*:/i,
    );
    expect(JSON.stringify(exported)).not.toMatch(
      /"(changes|payload|result|note|reviewNote)"\s*:/i,
    );
    expect(prisma.externalApiCredential.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          encryptedKey: true,
          authTag: true,
          iv: true,
        }),
        where: {
          userId: 'user-1',
        },
      }),
    );
    expect(prisma.communityFollow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ followerId: 'user-1' }, { followingId: 'user-1' }],
        },
      }),
    );
    expect(prisma.userRefreshSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          tokenHash: true,
          previousTokenHash: true,
        }),
        where: {
          userId: 'user-1',
        },
      }),
    );
    expect(prisma.securityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          ipHash: true,
          metadata: true,
          userAgentHash: true,
        }),
        where: {
          userId: 'user-1',
        },
      }),
    );
    expect(prisma.userSyncAppliedMutation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          result: true,
        }),
      }),
    );
    expect(prisma.notionPullPreviewSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          changes: true,
        }),
      }),
    );
    expect(prisma.catalogSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          note: true,
          payload: true,
          reviewNote: true,
        }),
      }),
    );
    expect(prisma.communityPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId: 'user-1' },
      }),
    );
    expect(prisma.communityReaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
      }),
    );
    expect(prisma.communityReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          moderatorId: true,
          moderatorNote: true,
        }),
        where: { reporterId: 'user-1' },
      }),
    );
    expect(exported.omittedSensitiveFields).toEqual(
      expect.arrayContaining([
        'refresh token hashes',
        'external provider encrypted keys',
        'security event IP and user-agent hashes',
      ]),
    );
    expect(metrics.recordUserDataRights).toHaveBeenCalledWith({
      operation: 'export',
      result: 'success',
    });
  });

  it('deletes an account by anonymizing retained operational records before user cascade', async () => {
    const prisma = createAccountDeletionPrismaMock();
    const metrics = createMetricsMock();
    const authService = new AuthService(
      prisma as unknown as PrismaService,
      undefined,
      metrics as unknown as MetricsService,
    );

    const deleted = await authService.deleteAccount(
      {
        email: 'frieren@example.com',
        role: 'user',
        sessionId: 'session-1',
        userId: 'user-1',
      },
      {
        acknowledgeIrreversible: true,
        confirmEmail: ' frieren@example.com ',
      },
    );

    expect(deleted).toEqual(
      expect.objectContaining({
        deleted: true,
        userId: 'user-1',
        anonymizedRecords: {
          catalogAuditLogs: 3,
          catalogSubmissionReviews: 2,
          communityModerationAuditLogs: 6,
          communityReportAssignments: 5,
          securityEvents: 4,
        },
      }),
    );
    expect(prisma.securityEvent.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
      },
      data: {
        sessionId: null,
        userId: null,
      },
    });
    expect(prisma.catalogSubmission.updateMany).toHaveBeenCalledWith({
      where: {
        reviewerId: 'user-1',
      },
      data: {
        reviewerId: null,
      },
    });
    expect(prisma.catalogAuditLog.updateMany).toHaveBeenCalledWith({
      where: {
        actorId: 'user-1',
      },
      data: {
        actorId: null,
      },
    });
    expect(prisma.communityReport.updateMany).toHaveBeenCalledWith({
      where: {
        moderatorId: 'user-1',
        post: {
          authorId: {
            not: 'user-1',
          },
        },
        reporterId: {
          not: 'user-1',
        },
      },
      data: {
        moderatorId: null,
      },
    });
    expect(prisma.communityModerationAuditLog.updateMany).toHaveBeenCalledWith({
      where: {
        actorId: 'user-1',
      },
      data: {
        actorId: null,
      },
    });
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
    });
    expect(metrics.recordUserDataRights).toHaveBeenCalledWith({
      operation: 'delete',
      result: 'success',
    });
  });

  it('rejects account deletion when the confirmation email does not match', async () => {
    const prisma = createAccountDeletionPrismaMock();
    const authService = new AuthService(prisma as unknown as PrismaService);

    await expect(
      authService.deleteAccount(
        {
          email: 'frieren@example.com',
          role: 'user',
          sessionId: 'session-1',
          userId: 'user-1',
        },
        {
          acknowledgeIrreversible: true,
          confirmEmail: 'fern@example.com',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('rejects account deletion before database mutation when irreversible acknowledgement is missing', async () => {
    const prisma = createAccountDeletionPrismaMock();
    const authService = new AuthService(prisma as unknown as PrismaService);

    expect(() =>
      authService.validateAccountDeletionRequest(
        {
          email: 'frieren@example.com',
          role: 'user',
          sessionId: 'session-1',
          userId: 'user-1',
        },
        {
          acknowledgeIrreversible: false as true,
          confirmEmail: 'frieren@example.com',
        },
      ),
    ).toThrow(BadRequestException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('previews account deletion impact with owner-scoped counts only', async () => {
    const prisma = createAccountDeletionPreviewPrismaMock();
    const metrics = createMetricsMock();
    const authService = new AuthService(
      prisma as unknown as PrismaService,
      undefined,
      metrics as unknown as MetricsService,
    );

    const preview = await authService.previewAccountDeletion({
      email: 'frieren@example.com',
      role: 'user',
      sessionId: 'session-1',
      userId: 'user-1',
    });

    expect(preview).toEqual(
      expect.objectContaining({
        anonymizedRecords: {
          catalogAuditLogs: 3,
          catalogSubmissionReviews: 2,
          communityModerationAuditLogs: 26,
          communityReportAssignments: 25,
          securityEvents: 7,
        },
        cascadeDeletedRecords: expect.objectContaining({
          authAccounts: 1,
          communityPosts: 22,
          communityReactions: 23,
          communityReports: 24,
          externalApiCredentials: 4,
          refreshSessions: 9,
          workRecords: 19,
          workSeriesLinks: 21,
        }),
        omittedSensitiveFields: expect.arrayContaining([
          'refresh token hashes',
          'external provider encrypted keys',
          'row payload contents',
        ]),
        userId: 'user-1',
      }),
    );
    expect(JSON.stringify(preview)).not.toMatch(
      /"(encryptedKey|authTag|iv|tokenHash|previousTokenHash|ipHash|userAgentHash|payload)"\s*:/i,
    );
    expect(prisma.userAuthAccount.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
      },
    });
    expect(metrics.recordUserDataRights).toHaveBeenCalledWith({
      operation: 'deletion_preview',
      result: 'success',
    });
    expect(prisma.userReleaseRecord.count).toHaveBeenCalledWith({
      where: {
        userWorkRecord: {
          userId: 'user-1',
        },
      },
    });
    expect(prisma.userWorkSeriesLink.count).toHaveBeenCalledWith({
      where: {
        userSeries: {
          userId: 'user-1',
        },
      },
    });
    expect(prisma.securityEvent.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
      },
    });
    expect(prisma.catalogSubmission.count).toHaveBeenCalledWith({
      where: {
        submitterId: 'user-1',
      },
    });
    expect(prisma.catalogSubmission.count).toHaveBeenCalledWith({
      where: {
        reviewerId: 'user-1',
      },
    });
    expect(prisma.communityReaction.count).toHaveBeenCalledWith({
      where: {
        OR: [{ userId: 'user-1' }, { post: { authorId: 'user-1' } }],
      },
    });
    expect(prisma.communityReport.count).toHaveBeenNthCalledWith(1, {
      where: {
        OR: [{ reporterId: 'user-1' }, { post: { authorId: 'user-1' } }],
      },
    });
    expect(prisma.communityReport.count).toHaveBeenNthCalledWith(2, {
      where: {
        moderatorId: 'user-1',
        post: {
          authorId: {
            not: 'user-1',
          },
        },
        reporterId: {
          not: 'user-1',
        },
      },
    });
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

    const logPayload = String(warnSpy.mock.calls.at(-1)?.[0] ?? '');

    expect(JSON.parse(logPayload)).toEqual(
      expect.objectContaining({
        errorCode: 'timeout',
        event: 'auth.google.token_exchange.failed',
        httpStatus: null,
        provider: 'google',
        requestId: null,
        userId: null,
      }),
    );
    expect(logPayload).not.toMatch(/oauth-code-secret|client-secret|id_token/i);
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
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    setExternalFetchTransportForTest(async () => {
      throw new DOMException('aborted', 'AbortError');
    });

    await expect(googleOAuthClient.getSigningKey('cached-kid')).resolves.toBe(
      'cached-pem',
    );

    const logPayload = String(warnSpy.mock.calls.at(-1)?.[0] ?? '');

    expect(JSON.parse(logPayload)).toEqual(
      expect.objectContaining({
        errorCode: 'timeout',
        event: 'auth.google.jwks.stale_cache_used',
        provider: 'google',
        staleCache: true,
      }),
    );

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
