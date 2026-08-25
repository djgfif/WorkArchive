import {
  CommunityPostStatus,
  CommunityReportStatus,
  WorkType,
} from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { CommunityService } from '../src/modules/community/community.service';
import type { PrismaService } from '../src/prisma/prisma.service';

type TransactionCallback = (client: unknown) => unknown;

function asyncMock() {
  return jest.fn<(...args: unknown[]) => Promise<unknown>>();
}

function createPrismaMock() {
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
      deleteMany: asyncMock(),
      upsert: asyncMock(),
    },
    communityReport: {
      create: asyncMock(),
      findMany: asyncMock(),
      findUnique: asyncMock(),
      update: asyncMock(),
    },
  };
}

function createPostRow(overrides: Record<string, unknown> = {}) {
  return {
    _count: { reactions: 2 },
    author: {
      avatarUrl: 'https://example.com/avatar.jpg',
      handle: 'reader',
      nickname: '독자',
    },
    authorId: 'user-1',
    body: '좋았던 장면을 오래 생각하게 됐어요.',
    createdAt: new Date('2026-08-25T01:00:00.000Z'),
    id: 'post-1',
    reactions: [{ id: 'reaction-1' }],
    spoiler: false,
    updatedAt: new Date('2026-08-25T01:00:00.000Z'),
    workThumbnailUrl: 'https://example.com/work.jpg',
    workTitle: '여름의 문장들',
    workType: WorkType.novel,
    ...overrides,
  };
}

describe('CommunityService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: CommunityService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new CommunityService(prisma as unknown as PrismaService);
  });

  it('lists only published posts and derives viewer permissions without exposing user ids', async () => {
    prisma.communityPost.findMany.mockResolvedValue([createPostRow()]);

    const result = await service.listPosts(
      { limit: 20, sort: 'latest' },
      'user-1',
    );

    expect(prisma.communityPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: CommunityPostStatus.published },
        take: 21,
      }),
    );
    expect(result.posts[0]).toEqual(
      expect.objectContaining({
        viewerCanDelete: true,
        viewerHasReacted: true,
        work: {
          thumbnailUrl: 'https://example.com/work.jpg',
          title: '여름의 문장들',
          type: 'novel',
        },
      }),
    );
    expect(result.posts[0]).not.toHaveProperty('authorId');
    expect(result.posts[0]?.author).not.toHaveProperty('email');
  });

  it('publishes only the explicit body and bounded work snapshot', async () => {
    prisma.communityPost.create.mockResolvedValue(
      createPostRow({ reactions: [], _count: { reactions: 0 } }),
    );

    await service.createPost('user-1', {
      body: '  새로 쓴 공개 감상  ',
      spoiler: true,
      workThumbnailUrl: 'https://example.com/work.jpg',
      workTitle: '  여름의 문장들  ',
      workType: 'novel',
    });

    expect(prisma.communityPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          authorId: 'user-1',
          body: '새로 쓴 공개 감상',
          spoiler: true,
          workThumbnailUrl: 'https://example.com/work.jpg',
          workTitle: '여름의 문장들',
          workType: 'novel',
        },
      }),
    );
  });

  it('rejects partial work snapshots instead of accepting ambiguous publication data', async () => {
    await expect(
      service.createPost('user-1', {
        body: '공개 감상',
        workTitle: '제목만 있음',
      }),
    ).rejects.toThrow('requires title and type');
    expect(prisma.communityPost.create).not.toHaveBeenCalled();
  });

  it('soft-deletes only a published post owned by the current author', async () => {
    prisma.communityPost.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.deletePost('user-2', 'post-1')).rejects.toThrow(
      'Community post not found.',
    );
    expect(prisma.communityPost.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          authorId: 'user-2',
          id: 'post-1',
          status: CommunityPostStatus.published,
        },
      }),
    );
  });

  it('keeps reactions idempotent and scoped to the current user', async () => {
    prisma.communityPost.findFirst.mockResolvedValue({
      authorId: 'user-1',
      id: 'post-1',
    });

    await service.addReaction('user-2', 'post-1');
    await service.removeReaction('user-2', 'post-1');

    expect(prisma.communityReaction.upsert).toHaveBeenCalledWith({
      where: { postId_userId: { postId: 'post-1', userId: 'user-2' } },
      create: { postId: 'post-1', userId: 'user-2' },
      update: {},
    });
    expect(prisma.communityReaction.deleteMany).toHaveBeenCalledWith({
      where: { postId: 'post-1', userId: 'user-2' },
    });
  });

  it('rejects self-reports and duplicate reports', async () => {
    prisma.communityPost.findFirst.mockResolvedValue({
      authorId: 'user-1',
      id: 'post-1',
    });

    await expect(
      service.reportPost('user-1', 'post-1', { reason: 'spam' }),
    ).rejects.toThrow('Authors cannot report their own post.');

    prisma.communityPost.findFirst.mockResolvedValue({
      authorId: 'user-1',
      id: 'post-1',
    });
    prisma.communityReport.findUnique.mockResolvedValue({ id: 'report-1' });

    await expect(
      service.reportPost('user-2', 'post-1', { reason: 'spam' }),
    ).rejects.toThrow('already been reported');
    expect(prisma.communityReport.create).not.toHaveBeenCalled();
  });

  it('rejects report browsing for regular users before reading storage', async () => {
    await expect(
      service.listReports({ role: 'user', userId: 'user-1' }),
    ).rejects.toThrow('requires moderator access');
    expect(prisma.communityReport.findMany).not.toHaveBeenCalled();
  });

  it('hides a post and writes the moderation audit in one transaction', async () => {
    const transaction = {
      communityModerationAuditLog: {
        create: jest.fn(async (_input: unknown) => ({})),
      },
      communityPost: {
        findUnique: jest.fn(async () => ({
          status: CommunityPostStatus.published,
        })),
        update: jest.fn(async (_input: unknown) => ({})),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(transaction),
    );

    await service.hidePost(
      { role: 'moderator', userId: 'moderator-1' },
      'post-1',
      '신고 검토',
    );

    expect(transaction.communityPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: CommunityPostStatus.hidden }),
      }),
    );
    expect(transaction.communityModerationAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'moderator-1',
          note: '신고 검토',
          postId: 'post-1',
        }),
      }),
    );
  });

  it('resolves a pending report and records the audit target atomically', async () => {
    const transaction = {
      communityModerationAuditLog: {
        create: jest.fn(async (_input: unknown) => ({})),
      },
      communityReport: {
        findUnique: jest.fn(async () => ({
          postId: 'post-1',
          status: CommunityReportStatus.pending,
        })),
        update: jest.fn(async (_input: unknown) => ({})),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(transaction),
    );

    await service.resolveReport(
      { role: 'admin', userId: 'admin-1' },
      'report-1',
      { note: '처리 완료', resolution: 'resolve' },
    );

    expect(transaction.communityReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          moderatorId: 'admin-1',
          status: CommunityReportStatus.resolved,
        }),
      }),
    );
    expect(transaction.communityModerationAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'admin-1',
          postId: 'post-1',
          reportId: 'report-1',
        }),
      }),
    );
  });
});
