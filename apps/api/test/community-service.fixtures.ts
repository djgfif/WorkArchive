import { CommunityPostSurface, WorkType } from '@prisma/client';
import { jest } from '@jest/globals';

import { CommunityService } from '../src/modules/community/community.service';
import { CommunityDiscoveryService } from '../src/modules/community/services/community-discovery.service';
import { CommunityInteractionService } from '../src/modules/community/services/community-interaction.service';
import { CommunityModerationService } from '../src/modules/community/services/community-moderation.service';
import { CommunityProfileService } from '../src/modules/community/services/community-profile.service';
import { CommunityPublicationService } from '../src/modules/community/services/community-publication.service';
import { CommunityQueryService } from '../src/modules/community/services/community-query.service';
import type { PrismaService } from '../src/prisma/prisma.service';

type TransactionCallback = (client: unknown) => unknown;

function asyncMock() {
  return jest.fn<(...args: unknown[]) => Promise<unknown>>();
}

export function createCommunityPrismaMock() {
  return {
    $transaction:
      jest.fn<(callback: TransactionCallback) => Promise<unknown>>(),
    communityModerationAuditLog: { create: asyncMock() },
    communityPost: {
      create: asyncMock(),
      findFirst: asyncMock(),
      findMany: asyncMock(),
      findUnique: asyncMock(),
      update: asyncMock(),
      updateMany: asyncMock(),
    },
    communityReaction: {
      createMany: asyncMock(),
      deleteMany: asyncMock(),
    },
    communityReport: {
      create: asyncMock(),
      findMany: asyncMock(),
      findUnique: asyncMock(),
      update: asyncMock(),
      updateMany: asyncMock(),
    },
    user: { findUnique: asyncMock() },
  };
}

export type CommunityPrismaMock = ReturnType<typeof createCommunityPrismaMock>;

export function createPostRow(overrides: Record<string, unknown> = {}) {
  return {
    author: {
      avatarUrl: 'https://example.com/avatar.jpg',
      handle: 'reader',
      nickname: '독자',
    },
    authorId: 'user-1',
    body: '좋았던 장면을 오래 생각하게 됐어요.',
    category: 'free',
    commentCount: 0,
    createdAt: new Date('2026-08-25T01:00:00.000Z'),
    id: 'post-1',
    reactionCount: 2,
    reactions: [{ id: 'reaction-1' }],
    spoiler: false,
    surface: CommunityPostSurface.board,
    updatedAt: new Date('2026-08-25T01:00:00.000Z'),
    workThumbnailUrl: 'https://example.com/work.jpg',
    workTitle: '여름의 문장들',
    workType: WorkType.novel,
    ...overrides,
  };
}

export function createCommunityTestContext() {
  const prisma = createCommunityPrismaMock();
  prisma.user.findUnique.mockResolvedValue({
    avatarUrl: 'https://example.com/avatar.jpg',
    handle: 'reader',
    nickname: '독자',
  });
  const prismaService = prisma as unknown as PrismaService;
  const service = new CommunityService(
    new CommunityQueryService(prismaService),
    new CommunityPublicationService(prismaService),
    new CommunityInteractionService(prismaService),
    new CommunityProfileService(prismaService),
    new CommunityDiscoveryService(prismaService),
    new CommunityModerationService(prismaService),
  );

  return { prisma, service };
}
