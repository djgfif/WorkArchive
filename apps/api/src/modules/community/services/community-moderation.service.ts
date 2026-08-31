import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommunityModerationAction,
  CommunityPostStatus,
  CommunityPostSurface,
  CommunityReportStatus,
  type Prisma,
} from '@prisma/client';
import type {
  CommunityModerationReportListResponse,
  CommunityMutationResponse,
  CreateCommunityReportRequest,
  ResolveCommunityReportRequest,
} from '@work-archive/shared-types';

import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CommunityReportReadModel,
  ModeratorIdentity,
} from './community-service-base';
import {
  CommunityServiceBase,
  PUBLIC_AUTHOR_SELECT,
} from './community-service-base';

@Injectable()
export class CommunityModerationService extends CommunityServiceBase {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  async reportPost(
    reporterId: string,
    postId: string,
    input: CreateCommunityReportRequest,
    surface: CommunityPostSurface = CommunityPostSurface.board,
  ): Promise<CommunityMutationResponse> {
    return this.reportTarget(reporterId, 'post', postId, input, surface);
  }

  async reportReview(
    reporterId: string,
    reviewId: string,
    input: CreateCommunityReportRequest,
  ): Promise<CommunityMutationResponse> {
    return this.reportTarget(reporterId, 'review', reviewId, input);
  }

  async reportComment(
    reporterId: string,
    commentId: string,
    input: CreateCommunityReportRequest,
  ): Promise<CommunityMutationResponse> {
    return this.reportTarget(reporterId, 'comment', commentId, input);
  }

  private async reportTarget(
    reporterId: string,
    targetType: 'post' | 'review' | 'comment',
    targetId: string,
    input: CreateCommunityReportRequest,
    postSurface: CommunityPostSurface = CommunityPostSurface.board,
  ): Promise<CommunityMutationResponse> {
    await this.assertCommunityIdentity(reporterId);
    const target = await this.findVisibleModerationTargetOrThrow(
      targetType,
      targetId,
      postSurface,
    );

    if (target.authorId === reporterId) {
      throw new BadRequestException(
        targetType === 'post'
          ? 'Authors cannot report their own post.'
          : 'Authors cannot report their own content.',
      );
    }

    const targetWhere = { [`${targetType}Id`]: targetId };
    const existing =
      targetType === 'post'
        ? await this.prisma.communityReport.findUnique({
            where: { postId_reporterId: { postId: targetId, reporterId } },
            select: { id: true },
          })
        : targetType === 'review'
          ? await this.prisma.communityReport.findUnique({
              where: {
                reviewId_reporterId: { reviewId: targetId, reporterId },
              },
              select: { id: true },
            })
          : await this.prisma.communityReport.findUnique({
              where: {
                commentId_reporterId: { commentId: targetId, reporterId },
              },
              select: { id: true },
            });

    if (existing) {
      throw new ConflictException(
        targetType === 'post'
          ? 'This post has already been reported.'
          : 'This content has already been reported.',
      );
    }

    try {
      await this.prisma.communityReport.create({
        data: {
          detail: input.detail?.trim() ?? '',
          ...targetWhere,
          reason: input.reason,
          reporterId,
        } as Prisma.CommunityReportUncheckedCreateInput,
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          targetType === 'post'
            ? 'This post has already been reported.'
            : 'This content has already been reported.',
        );
      }

      throw error;
    }

    return { ok: true };
  }

  async listReports(
    moderator: ModeratorIdentity,
    scope: 'reflection' | 'social' = 'social',
  ): Promise<CommunityModerationReportListResponse> {
    this.assertModerator(moderator.role);
    const reports = await this.prisma.communityReport.findMany({
      where: {
        status: CommunityReportStatus.pending,
        ...(scope === 'reflection'
          ? {
              post: {
                is: { surface: CommunityPostSurface.reflection },
              },
            }
          : {
              OR: [
                { post: { is: { surface: CommunityPostSurface.board } } },
                { reviewId: { not: null } },
                { commentId: { not: null } },
              ],
            }),
      },
      include: {
        comment: {
          select: {
            body: true,
            createdAt: true,
            id: true,
            spoiler: true,
          },
        },
        post: {
          select: {
            body: true,
            createdAt: true,
            id: true,
            spoiler: true,
            workThumbnailUrl: true,
            workTitle: true,
            workType: true,
            surface: true,
          },
        },
        reporter: { select: PUBLIC_AUTHOR_SELECT },
        review: {
          select: {
            body: true,
            catalogTitle: {
              select: {
                displayTitle: true,
                id: true,
                mediumType: true,
                thumbnailUrl: true,
              },
            },
            createdAt: true,
            id: true,
            rating: true,
            spoiler: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });

    return {
      reports: (reports as CommunityReportReadModel[]).map((report) =>
        this.toModerationReportView(report),
      ),
    };
  }

  async hidePost(
    moderator: ModeratorIdentity,
    postId: string,
    note = '',
    surface: CommunityPostSurface = CommunityPostSurface.board,
  ): Promise<CommunityMutationResponse> {
    return this.moderateTarget(
      moderator,
      'post',
      postId,
      'hide',
      note,
      surface,
    );
  }

  async hideReview(moderator: ModeratorIdentity, reviewId: string, note = '') {
    return this.moderateTarget(moderator, 'review', reviewId, 'hide', note);
  }

  async hideComment(
    moderator: ModeratorIdentity,
    commentId: string,
    note = '',
  ) {
    return this.moderateTarget(moderator, 'comment', commentId, 'hide', note);
  }

  async restorePost(
    moderator: ModeratorIdentity,
    postId: string,
    note = '',
    surface: CommunityPostSurface = CommunityPostSurface.board,
  ): Promise<CommunityMutationResponse> {
    return this.moderateTarget(
      moderator,
      'post',
      postId,
      'restore',
      note,
      surface,
    );
  }

  async restoreReview(
    moderator: ModeratorIdentity,
    reviewId: string,
    note = '',
  ) {
    return this.moderateTarget(moderator, 'review', reviewId, 'restore', note);
  }

  async restoreComment(
    moderator: ModeratorIdentity,
    commentId: string,
    note = '',
  ) {
    return this.moderateTarget(
      moderator,
      'comment',
      commentId,
      'restore',
      note,
    );
  }

  private async moderateTarget(
    moderator: ModeratorIdentity,
    targetType: 'post' | 'review' | 'comment',
    targetId: string,
    operation: 'hide' | 'restore',
    note: string,
    postSurface: CommunityPostSurface = CommunityPostSurface.board,
  ): Promise<CommunityMutationResponse> {
    this.assertModerator(moderator.role);
    await this.prisma.$transaction(async (transaction) => {
      const expectedStatus =
        operation === 'hide'
          ? CommunityPostStatus.published
          : CommunityPostStatus.hidden;
      const nextStatus =
        operation === 'hide'
          ? CommunityPostStatus.hidden
          : CommunityPostStatus.published;
      const data = {
        hiddenAt: operation === 'hide' ? new Date() : null,
        status: nextStatus,
      };
      let result: { count: number };
      let existing: { status: CommunityPostStatus } | null = null;
      if (targetType === 'post') {
        result = await transaction.communityPost.updateMany({
          where: {
            id: targetId,
            status: expectedStatus,
            surface: postSurface,
          },
          data,
        });
        if (result.count !== 1) {
          existing = await transaction.communityPost.findFirst({
            where: { id: targetId, surface: postSurface },
            select: { status: true },
          });
        }
      } else if (targetType === 'review') {
        result = await transaction.communityReview.updateMany({
          where: { id: targetId, status: expectedStatus },
          data,
        });
        if (result.count !== 1)
          existing = await transaction.communityReview.findUnique({
            where: { id: targetId },
            select: { status: true },
          });
      } else {
        result = await transaction.communityComment.updateMany({
          where: { id: targetId, status: expectedStatus },
          data,
        });
        if (result.count !== 1)
          existing = await transaction.communityComment.findUnique({
            where: { id: targetId },
            select: { status: true },
          });
      }

      if (result.count !== 1) {
        if (
          operation === 'hide' &&
          existing?.status === CommunityPostStatus.hidden
        )
          return;
        throw new NotFoundException(`Community ${targetType} not found.`);
      }

      const action =
        `${targetType}_${operation === 'hide' ? 'hidden' : 'restored'}` as CommunityModerationAction;
      await transaction.communityModerationAuditLog.create({
        data: {
          action,
          actorId: moderator.userId,
          note: note.trim(),
          [`${targetType}Id`]: targetId,
        } as Prisma.CommunityModerationAuditLogUncheckedCreateInput,
      });
    });

    return { ok: true };
  }

  async resolveReport(
    moderator: ModeratorIdentity,
    reportId: string,
    input: ResolveCommunityReportRequest,
    scope: 'reflection' | 'social' = 'social',
  ): Promise<CommunityMutationResponse> {
    this.assertModerator(moderator.role);
    const dismissed = input.resolution === 'dismiss';
    await this.prisma.$transaction(async (transaction) => {
      const report = await transaction.communityReport.findUnique({
        where: { id: reportId },
        select: {
          commentId: true,
          postId: true,
          post: { select: { surface: true } },
          reviewId: true,
          status: true,
        },
      });

      const belongsToScope =
        report &&
        (scope === 'reflection'
          ? report.post?.surface === CommunityPostSurface.reflection
          : report.post?.surface === CommunityPostSurface.board ||
            report.reviewId !== null ||
            report.commentId !== null);

      if (
        !report ||
        report.status !== CommunityReportStatus.pending ||
        !belongsToScope
      ) {
        throw new NotFoundException('Pending community report not found.');
      }

      const result = await transaction.communityReport.updateMany({
        where: {
          id: reportId,
          status: CommunityReportStatus.pending,
        },
        data: {
          moderatorId: moderator.userId,
          moderatorNote: input.note?.trim() ?? '',
          resolvedAt: new Date(),
          status: dismissed
            ? CommunityReportStatus.dismissed
            : CommunityReportStatus.resolved,
        },
      });

      if (result.count !== 1) {
        throw new NotFoundException('Pending community report not found.');
      }

      await transaction.communityModerationAuditLog.create({
        data: {
          action: dismissed
            ? CommunityModerationAction.report_dismissed
            : CommunityModerationAction.report_resolved,
          actorId: moderator.userId,
          note: input.note?.trim() ?? '',
          commentId: report.commentId,
          postId: report.postId,
          reportId,
          reviewId: report.reviewId,
        },
      });
    });

    return { ok: true };
  }
}
