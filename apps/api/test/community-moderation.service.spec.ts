import {
  CommunityPostStatus,
  CommunityPostSurface,
  CommunityReportStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { CommunityService } from '../src/modules/community/community.service';
import {
  createCommunityTestContext,
  type CommunityPrismaMock,
} from './community-service.fixtures';

describe('Community moderation service', () => {
  let prisma: CommunityPrismaMock;
  let service: CommunityService;

  beforeEach(() => {
    ({ prisma, service } = createCommunityTestContext());
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
        findFirst: jest.fn(async () => ({
          status: CommunityPostStatus.published,
        })),
        updateMany: jest.fn(async (_input: unknown) => ({ count: 1 })),
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

    expect(transaction.communityPost.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'post-1',
          status: CommunityPostStatus.published,
          surface: CommunityPostSurface.board,
        }),
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

  it('does not append a second hide audit when another moderator already won the transition', async () => {
    const transaction = {
      communityModerationAuditLog: {
        create: jest.fn(async (_input: unknown) => ({})),
      },
      communityPost: {
        findFirst: jest.fn(async () => ({
          status: CommunityPostStatus.hidden,
        })),
        updateMany: jest.fn(async (_input: unknown) => ({ count: 0 })),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(transaction),
    );

    await expect(
      service.hidePost(
        { role: 'moderator', userId: 'moderator-2' },
        'post-1',
        '동시 처리',
      ),
    ).resolves.toEqual({ ok: true });

    expect(
      transaction.communityModerationAuditLog.create,
    ).not.toHaveBeenCalled();
  });

  it('restores only a hidden post and records one audit entry', async () => {
    const transaction = {
      communityModerationAuditLog: {
        create: jest.fn(async (_input: unknown) => ({})),
      },
      communityPost: {
        updateMany: jest.fn(async (_input: unknown) => ({ count: 1 })),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(transaction),
    );

    await service.restorePost(
      { role: 'moderator', userId: 'moderator-1' },
      'post-1',
      '재검토 완료',
    );

    expect(transaction.communityPost.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'post-1',
          status: CommunityPostStatus.hidden,
          surface: CommunityPostSurface.board,
        },
        data: expect.objectContaining({
          hiddenAt: null,
          status: CommunityPostStatus.published,
        }),
      }),
    );
    expect(
      transaction.communityModerationAuditLog.create,
    ).toHaveBeenCalledTimes(1);
  });

  it('resolves a pending report and records the audit target atomically', async () => {
    const transaction = {
      communityModerationAuditLog: {
        create: jest.fn(async (_input: unknown) => ({})),
      },
      communityReport: {
        findUnique: jest.fn(async () => ({
          commentId: null,
          post: { surface: CommunityPostSurface.board },
          postId: 'post-1',
          reviewId: null,
          status: CommunityReportStatus.pending,
        })),
        updateMany: jest.fn(async (_input: unknown) => ({ count: 1 })),
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

    expect(transaction.communityReport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'report-1',
          status: CommunityReportStatus.pending,
        },
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

  it('rejects a concurrent report-resolution loser without adding an audit', async () => {
    const transaction = {
      communityModerationAuditLog: {
        create: jest.fn(async (_input: unknown) => ({})),
      },
      communityReport: {
        findUnique: jest.fn(async () => ({
          commentId: null,
          post: { surface: CommunityPostSurface.board },
          postId: 'post-1',
          reviewId: null,
          status: CommunityReportStatus.pending,
        })),
        updateMany: jest.fn(async (_input: unknown) => ({ count: 0 })),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(transaction),
    );

    await expect(
      service.resolveReport(
        { role: 'moderator', userId: 'moderator-2' },
        'report-1',
        { resolution: 'dismiss' },
      ),
    ).rejects.toThrow('Pending community report not found');
    expect(
      transaction.communityModerationAuditLog.create,
    ).not.toHaveBeenCalled();
  });
});
