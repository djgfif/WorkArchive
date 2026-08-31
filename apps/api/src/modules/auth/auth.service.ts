import { randomBytes, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import type { User, UserAuthAccount, UserRefreshSession } from '@prisma/client';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import { readApiRuntimeConfig } from '../../config/api-runtime-config';
import { MetricsService } from '../../observability/metrics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityAuditService } from '../../security/security-audit.service';
import { hashSecret, verifySecret } from './auth-crypto';
import type { AuthSessionResponseDto } from './dto/auth-session-response.dto';
import type { AuthRefreshSessionsResponseDto } from './dto/auth-refresh-session-response.dto';
import type { AuthAccountDeletionRequestDto } from './dto/auth-account-deletion-request.dto';
import type { AuthAccountDeletionPreviewResponseDto } from './dto/auth-account-deletion-preview-response.dto';
import type { AuthAccountDeletionResponseDto } from './dto/auth-account-deletion-response.dto';
import type { AuthUserDataExportResponseDto } from './dto/auth-user-data-export-response.dto';
import type { AuthUserResponseDto } from './dto/auth-user-response.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import {
  AUTH_ACCESS_TOKEN_TTL_SECONDS,
  AUTH_JWT_ALGORITHM,
  AUTH_JWT_AUDIENCE,
  AUTH_JWT_ISSUER,
  AUTH_REFRESH_TOKEN_TTL_SECONDS,
  hasExpectedAuthIdentityClaims,
  hasExpectedAuthTemporalClaims,
  hasExpectedAuthTokenKindClaims,
  hasRequiredAuthJwtClaims,
  type AuthenticatedUser,
  type AuthTokenKind,
  type AuthTokenPayload,
} from './auth.types';
import {
  maskAuthSessionIpAddress,
  summarizeAuthSessionUserAgent,
} from './auth-session-metadata';
import {
  toAuthRefreshSessionResponse,
  toAuthUserResponse,
  toGoogleAuthAccountData,
} from './auth-response-mappers';
import {
  GOOGLE_AUTH_PROVIDER,
  GoogleOAuthClient,
  type GoogleIdentityProfile,
} from './google-oauth-client';

const REFRESH_ROTATION_GRACE_MS = 15_000;
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
  refreshToken: string | null;
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

function pickFields<T extends Record<string, unknown>, K extends keyof T>(
  row: T,
  fields: K[],
) {
  return Object.fromEntries(fields.map((field) => [field, row[field]])) as Pick<
    T,
    K
  >;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleOAuth: GoogleOAuthClient;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SecurityAuditService)
    @Optional()
    private readonly securityAudit?: SecurityAuditService,
    @Inject(MetricsService)
    @Optional()
    private readonly metricsService?: MetricsService,
    @Inject(GoogleOAuthClient)
    @Optional()
    googleOAuth?: GoogleOAuthClient,
  ) {
    this.googleOAuth = googleOAuth ?? new GoogleOAuthClient();
  }

  getGoogleAuthorizationUrl(state: string, nonce: string) {
    return this.googleOAuth.getAuthorizationUrl(state, nonce);
  }

  isGoogleOAuthConfigured() {
    return this.googleOAuth.isConfigured();
  }

  async loginWithGoogleAuthorizationCode(
    code: string,
    expectedNonceHash: string,
    metadata: AuthSessionMetadata = {},
  ): Promise<IssuedAuthSession> {
    const profile =
      await this.googleOAuth.getIdentityProfileForAuthorizationCode(
        code,
        expectedNonceHash,
      );

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

    if (!this.isTokenEmailCurrentForUser(tokenPayload, session.user)) {
      await this.revokeAllUserSessions(session.userId);
      this.recordRefreshFailure(
        'token_email_mismatch',
        session.userId,
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

    if (
      !isRefreshTokenValid &&
      !(await this.isPreviousRefreshTokenWithinGrace(refreshToken, session))
    ) {
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

    if (!sessionResponse) {
      const racedSessionResponse = await this.issueAfterConcurrentRefresh(
        session.user,
        session.id,
        refreshToken,
        tokenPayload.rememberMe ?? session.rememberMe,
      );

      if (racedSessionResponse) {
        this.metricsService?.recordAuthRefresh('success');

        return racedSessionResponse;
      }

      await this.revokeAllUserSessions(session.userId);
      this.recordRefreshFailure(
        'refresh_token_reuse_detected',
        session.userId,
        metadata,
        'auth.refresh.reuse_detected',
      );
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

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
        include: {
          user: true,
        },
      });

      if (
        !session ||
        session.userId !== tokenPayload.sub ||
        !this.isTokenEmailCurrentForUser(tokenPayload, session.user) ||
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

    return toAuthUserResponse(user);
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

      return toAuthUserResponse(user);
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
        toAuthRefreshSessionResponse(session, session.id === user.sessionId),
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

  async exportUserData(
    user: AuthenticatedUser,
  ): Promise<AuthUserDataExportResponseDto> {
    try {
      const [
        currentUser,
        refreshSessions,
        externalApiCredentials,
        syncAppliedMutations,
        workRecords,
        releaseRecords,
        timelineEntries,
        notionSyncMappings,
        notionPullPreviewSnapshots,
        series,
        workSeriesLinks,
        contributors,
        workContributors,
        workRelations,
        tierBoards,
        tierLanes,
        tierBoardCards,
        tierBoardAssets,
        catalogSubmissions,
        communityProfiles,
        communityPosts,
        communityReviews,
        communityReactions,
        communityReviewReactions,
        communityComments,
        communityCommentReactions,
        communityFollows,
        communityNotifications,
        communityReports,
        securityEvents,
      ] = await this.prisma.$transaction([
        this.prisma.user.findUniqueOrThrow({
          where: {
            id: user.userId,
          },
          include: {
            authAccounts: true,
          },
        }),
        this.prisma.userRefreshSession.findMany({
          where: {
            userId: user.userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            rememberMe: true,
            userAgent: true,
            ipAddress: true,
            createdAt: true,
            updatedAt: true,
            lastUsedAt: true,
            rotatedAt: true,
            expiresAt: true,
            revokedAt: true,
          },
        }),
        this.prisma.externalApiCredential.findMany({
          where: {
            userId: user.userId,
          },
          orderBy: {
            provider: 'asc',
          },
          select: {
            id: true,
            provider: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.userSyncAppliedMutation.findMany({
          where: {
            userId: user.userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            clientMutationId: true,
            queueId: true,
            entityType: true,
            entityId: true,
            payloadHash: true,
            resultStatus: true,
            expiresAt: true,
            createdAt: true,
          },
        }),
        this.prisma.userWorkRecord.findMany({
          where: {
            userId: user.userId,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        }),
        this.prisma.userReleaseRecord.findMany({
          where: {
            userWorkRecord: {
              userId: user.userId,
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
        }),
        this.prisma.userTimelineEntry.findMany({
          where: {
            userId: user.userId,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        }),
        this.prisma.notionSyncMapping.findMany({
          where: {
            userId: user.userId,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        }),
        this.prisma.notionPullPreviewSnapshot.findMany({
          where: {
            userId: user.userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            notionDataSourceId: true,
            previewedAt: true,
            expiresAt: true,
            createdAt: true,
          },
        }),
        this.prisma.userSeries.findMany({
          where: {
            userId: user.userId,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        }),
        this.prisma.userWorkSeriesLink.findMany({
          where: {
            userSeries: {
              userId: user.userId,
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
        }),
        this.prisma.userContributor.findMany({
          where: {
            userId: user.userId,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        }),
        this.prisma.userWorkContributor.findMany({
          where: {
            userContributor: {
              userId: user.userId,
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
        }),
        this.prisma.userWorkRelation.findMany({
          where: {
            userId: user.userId,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        }),
        this.prisma.userTierBoard.findMany({
          where: {
            userId: user.userId,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        }),
        this.prisma.userTierLane.findMany({
          where: {
            board: {
              userId: user.userId,
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
        }),
        this.prisma.userTierBoardCard.findMany({
          where: {
            board: {
              userId: user.userId,
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
        }),
        this.prisma.userTierBoardAsset.findMany({
          where: {
            board: {
              userId: user.userId,
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
        }),
        this.prisma.catalogSubmission.findMany({
          where: {
            submitterId: user.userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            status: true,
            entityType: true,
            entityId: true,
            action: true,
            reviewedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.userCommunityProfile.findMany({
          where: {
            userId: user.userId,
          },
          select: {
            id: true,
            visibility: true,
            bio: true,
            favoriteGenres: true,
            favoriteCatalogTitleIds: true,
            showTasteSummary: true,
            showRatings: true,
            showReviews: true,
            showBoardPosts: true,
            showFollowers: true,
            allowFollowers: true,
            notifyInCommunity: true,
            notifyGlobalBadge: true,
            notifyBrowser: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.communityPost.findMany({
          where: {
            authorId: user.userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            surface: true,
            category: true,
            catalogTitleId: true,
            body: true,
            reactionCount: true,
            commentCount: true,
            spoiler: true,
            status: true,
            workTitle: true,
            workType: true,
            workThumbnailUrl: true,
            deletedAt: true,
            hiddenAt: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.communityReview.findMany({
          where: {
            authorId: user.userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            catalogTitleId: true,
            rating: true,
            body: true,
            spoiler: true,
            reactionCount: true,
            commentCount: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            hiddenAt: true,
          },
        }),
        this.prisma.communityReaction.findMany({
          where: {
            userId: user.userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            postId: true,
            createdAt: true,
          },
        }),
        this.prisma.communityReviewReaction.findMany({
          where: {
            userId: user.userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            reviewId: true,
            createdAt: true,
          },
        }),
        this.prisma.communityComment.findMany({
          where: {
            authorId: user.userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            postId: true,
            reviewId: true,
            parentId: true,
            body: true,
            spoiler: true,
            reactionCount: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
          },
        }),
        this.prisma.communityCommentReaction.findMany({
          where: {
            userId: user.userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            commentId: true,
            createdAt: true,
          },
        }),
        this.prisma.communityFollow.findMany({
          where: {
            OR: [{ followerId: user.userId }, { followingId: user.userId }],
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            followerId: true,
            followingId: true,
            createdAt: true,
          },
        }),
        this.prisma.communityNotification.findMany({
          where: {
            recipientId: user.userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            actorId: true,
            type: true,
            targetType: true,
            targetId: true,
            createdAt: true,
            readAt: true,
          },
        }),
        this.prisma.communityReport.findMany({
          where: {
            reporterId: user.userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            postId: true,
            reviewId: true,
            commentId: true,
            reason: true,
            detail: true,
            status: true,
            resolvedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.securityEvent.findMany({
          where: {
            userId: user.userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            eventType: true,
            severity: true,
            requestId: true,
            sessionId: true,
            createdAt: true,
          },
        }),
      ]);

      const data = {
        catalogSubmissions: catalogSubmissions.map((submission) =>
          pickFields(submission, [
            'id',
            'status',
            'entityType',
            'entityId',
            'action',
            'reviewedAt',
            'createdAt',
            'updatedAt',
          ]),
        ),
        communityComments,
        communityCommentReactions,
        communityFollows,
        communityNotifications,
        communityPosts,
        communityProfiles,
        communityReactions,
        communityReports,
        communityReviewReactions,
        communityReviews,
        contributors,
        externalApiCredentials,
        notionPullPreviewSnapshots: notionPullPreviewSnapshots.map((snapshot) =>
          pickFields(snapshot, [
            'id',
            'notionDataSourceId',
            'previewedAt',
            'expiresAt',
            'createdAt',
          ]),
        ),
        notionSyncMappings,
        refreshSessions: refreshSessions.map((session) => ({
          id: session.id,
          current: session.id === user.sessionId,
          rememberMe: session.rememberMe,
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          createdAt: session.createdAt.toISOString(),
          lastUsedAt: session.lastUsedAt?.toISOString() ?? null,
          rotatedAt: session.rotatedAt?.toISOString() ?? null,
          expiresAt: session.expiresAt.toISOString(),
        })),
        releaseRecords,
        securityEvents,
        series,
        syncAppliedMutations: syncAppliedMutations.map((mutation) =>
          pickFields(mutation, [
            'id',
            'clientMutationId',
            'queueId',
            'entityType',
            'entityId',
            'payloadHash',
            'resultStatus',
            'expiresAt',
            'createdAt',
          ]),
        ),
        tierBoardAssets,
        tierBoardCards,
        tierBoards,
        tierLanes,
        timelineEntries,
        workContributors,
        workRecords,
        workRelations,
        workSeriesLinks,
      };

      this.metricsService?.recordUserDataRights({
        operation: 'export',
        result: 'success',
      });

      return {
        counts: Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key,
            Array.isArray(value) ? value.length : 0,
          ]),
        ),
        data,
        exportedAt: new Date().toISOString(),
        omittedSensitiveFields: [
          'refresh token hashes',
          'previous refresh token hashes',
          'external provider encrypted keys',
          'external provider encryption iv/auth tags',
          'security event IP and user-agent hashes',
          'security event metadata',
          'OAuth provider account ids',
          'sync mutation result payloads',
          'Notion preview change payloads',
          'catalog submission payloads and notes',
        ],
        user: toAuthUserResponse(currentUser),
      };
    } catch (error) {
      this.metricsService?.recordUserDataRights({
        operation: 'export',
        result: 'failure',
      });

      throw error;
    }
  }

  async deleteAccount(
    user: AuthenticatedUser,
    input: AuthAccountDeletionRequestDto,
  ): Promise<AuthAccountDeletionResponseDto> {
    this.validateAccountDeletionRequest(user, input);

    try {
      const deletedAt = new Date();
      const [
        anonymizedSecurityEvents,
        anonymizedCatalogSubmissionReviews,
        anonymizedCatalogAuditLogs,
        anonymizedCommunityNotificationActors,
        anonymizedCommunityReportAssignments,
        anonymizedCommunityModerationAuditLogs,
      ] = await this.prisma.$transaction([
        this.prisma.securityEvent.updateMany({
          where: {
            userId: user.userId,
          },
          data: {
            sessionId: null,
            userId: null,
          },
        }),
        this.prisma.catalogSubmission.updateMany({
          where: {
            reviewerId: user.userId,
          },
          data: {
            reviewerId: null,
          },
        }),
        this.prisma.catalogAuditLog.updateMany({
          where: {
            actorId: user.userId,
          },
          data: {
            actorId: null,
          },
        }),
        this.prisma.communityNotification.updateMany({
          where: {
            actorId: user.userId,
            recipientId: { not: user.userId },
          },
          data: {
            actorId: null,
          },
        }),
        this.prisma.communityReport.updateMany({
          where: {
            moderatorId: user.userId,
            reporterId: { not: user.userId },
            NOT: [
              { post: { authorId: user.userId } },
              { review: { authorId: user.userId } },
              { comment: { authorId: user.userId } },
              { comment: { post: { authorId: user.userId } } },
              { comment: { review: { authorId: user.userId } } },
            ],
          },
          data: {
            moderatorId: null,
          },
        }),
        this.prisma.communityModerationAuditLog.updateMany({
          where: {
            actorId: user.userId,
          },
          data: {
            actorId: null,
          },
        }),
        this.prisma.user.delete({
          where: {
            id: user.userId,
          },
        }),
      ]);

      this.metricsService?.recordUserDataRights({
        operation: 'delete',
        result: 'success',
      });

      return {
        anonymizedRecords: {
          catalogAuditLogs: anonymizedCatalogAuditLogs.count,
          catalogSubmissionReviews: anonymizedCatalogSubmissionReviews.count,
          communityModerationAuditLogs:
            anonymizedCommunityModerationAuditLogs.count,
          communityNotificationActors:
            anonymizedCommunityNotificationActors.count,
          communityReportAssignments:
            anonymizedCommunityReportAssignments.count,
          securityEvents: anonymizedSecurityEvents.count,
        },
        deleted: true,
        deletedAt: deletedAt.toISOString(),
        userId: user.userId,
      };
    } catch (error) {
      this.metricsService?.recordUserDataRights({
        operation: 'delete',
        result: 'failure',
      });

      throw error;
    }
  }

  validateAccountDeletionRequest(
    user: AuthenticatedUser,
    input: AuthAccountDeletionRequestDto,
  ) {
    if (input.acknowledgeIrreversible !== true) {
      throw new BadRequestException(
        'acknowledgeIrreversible must be true for account deletion.',
      );
    }

    if (
      input.confirmEmail.trim().toLowerCase() !==
      user.email.trim().toLowerCase()
    ) {
      throw new BadRequestException(
        'confirmEmail must match the current account email.',
      );
    }
  }

  async previewAccountDeletion(
    user: AuthenticatedUser,
  ): Promise<AuthAccountDeletionPreviewResponseDto> {
    try {
      const [
        authAccounts,
        refreshSessions,
        externalApiCredentials,
        syncAppliedMutations,
        workRecords,
        releaseRecords,
        timelineEntries,
        notionSyncMappings,
        notionPullPreviewSnapshots,
        series,
        workSeriesLinks,
        contributors,
        workContributors,
        workRelations,
        tierBoards,
        tierLanes,
        tierBoardCards,
        tierBoardAssets,
        catalogSubmissions,
        communityProfiles,
        communityPosts,
        communityReviews,
        communityReactions,
        communityReviewReactions,
        communityComments,
        communityCommentReactions,
        communityFollows,
        communityNotifications,
        communityReports,
        securityEvents,
        catalogSubmissionReviews,
        catalogAuditLogs,
        communityNotificationActors,
        communityReportAssignments,
        communityModerationAuditLogs,
      ] = await this.prisma.$transaction([
        this.prisma.userAuthAccount.count({
          where: {
            userId: user.userId,
          },
        }),
        this.prisma.userRefreshSession.count({
          where: {
            userId: user.userId,
          },
        }),
        this.prisma.externalApiCredential.count({
          where: {
            userId: user.userId,
          },
        }),
        this.prisma.userSyncAppliedMutation.count({
          where: {
            userId: user.userId,
          },
        }),
        this.prisma.userWorkRecord.count({
          where: {
            userId: user.userId,
          },
        }),
        this.prisma.userReleaseRecord.count({
          where: {
            userWorkRecord: {
              userId: user.userId,
            },
          },
        }),
        this.prisma.userTimelineEntry.count({
          where: {
            userId: user.userId,
          },
        }),
        this.prisma.notionSyncMapping.count({
          where: {
            userId: user.userId,
          },
        }),
        this.prisma.notionPullPreviewSnapshot.count({
          where: {
            userId: user.userId,
          },
        }),
        this.prisma.userSeries.count({
          where: {
            userId: user.userId,
          },
        }),
        this.prisma.userWorkSeriesLink.count({
          where: {
            userSeries: {
              userId: user.userId,
            },
          },
        }),
        this.prisma.userContributor.count({
          where: {
            userId: user.userId,
          },
        }),
        this.prisma.userWorkContributor.count({
          where: {
            userContributor: {
              userId: user.userId,
            },
          },
        }),
        this.prisma.userWorkRelation.count({
          where: {
            userId: user.userId,
          },
        }),
        this.prisma.userTierBoard.count({
          where: {
            userId: user.userId,
          },
        }),
        this.prisma.userTierLane.count({
          where: {
            board: {
              userId: user.userId,
            },
          },
        }),
        this.prisma.userTierBoardCard.count({
          where: {
            board: {
              userId: user.userId,
            },
          },
        }),
        this.prisma.userTierBoardAsset.count({
          where: {
            board: {
              userId: user.userId,
            },
          },
        }),
        this.prisma.catalogSubmission.count({
          where: {
            submitterId: user.userId,
          },
        }),
        this.prisma.userCommunityProfile.count({
          where: {
            userId: user.userId,
          },
        }),
        this.prisma.communityPost.count({
          where: {
            authorId: user.userId,
          },
        }),
        this.prisma.communityReview.count({
          where: {
            authorId: user.userId,
          },
        }),
        this.prisma.communityReaction.count({
          where: {
            OR: [{ userId: user.userId }, { post: { authorId: user.userId } }],
          },
        }),
        this.prisma.communityReviewReaction.count({
          where: {
            OR: [
              { userId: user.userId },
              { review: { authorId: user.userId } },
            ],
          },
        }),
        this.prisma.communityComment.count({
          where: {
            OR: [
              { authorId: user.userId },
              { post: { authorId: user.userId } },
              { review: { authorId: user.userId } },
            ],
          },
        }),
        this.prisma.communityCommentReaction.count({
          where: {
            OR: [
              { userId: user.userId },
              { comment: { authorId: user.userId } },
              { comment: { post: { authorId: user.userId } } },
              { comment: { review: { authorId: user.userId } } },
            ],
          },
        }),
        this.prisma.communityFollow.count({
          where: {
            OR: [{ followerId: user.userId }, { followingId: user.userId }],
          },
        }),
        this.prisma.communityNotification.count({
          where: {
            recipientId: user.userId,
          },
        }),
        this.prisma.communityReport.count({
          where: {
            OR: [
              { reporterId: user.userId },
              { post: { authorId: user.userId } },
              { review: { authorId: user.userId } },
              { comment: { authorId: user.userId } },
              { comment: { post: { authorId: user.userId } } },
              { comment: { review: { authorId: user.userId } } },
            ],
          },
        }),
        this.prisma.securityEvent.count({
          where: {
            userId: user.userId,
          },
        }),
        this.prisma.catalogSubmission.count({
          where: {
            reviewerId: user.userId,
          },
        }),
        this.prisma.catalogAuditLog.count({
          where: {
            actorId: user.userId,
          },
        }),
        this.prisma.communityNotification.count({
          where: {
            actorId: user.userId,
            recipientId: { not: user.userId },
          },
        }),
        this.prisma.communityReport.count({
          where: {
            moderatorId: user.userId,
            reporterId: { not: user.userId },
            NOT: [
              { post: { authorId: user.userId } },
              { review: { authorId: user.userId } },
              { comment: { authorId: user.userId } },
              { comment: { post: { authorId: user.userId } } },
              { comment: { review: { authorId: user.userId } } },
            ],
          },
        }),
        this.prisma.communityModerationAuditLog.count({
          where: {
            actorId: user.userId,
          },
        }),
      ]);

      this.metricsService?.recordUserDataRights({
        operation: 'deletion_preview',
        result: 'success',
      });

      return {
        anonymizedRecords: {
          catalogAuditLogs,
          catalogSubmissionReviews,
          communityModerationAuditLogs,
          communityNotificationActors,
          communityReportAssignments,
          securityEvents,
        },
        cascadeDeletedRecords: {
          authAccounts,
          catalogSubmissions,
          communityComments,
          communityCommentReactions,
          communityFollows,
          communityNotifications,
          communityPosts,
          communityProfiles,
          communityReactions,
          communityReports,
          communityReviewReactions,
          communityReviews,
          contributors,
          externalApiCredentials,
          notionPullPreviewSnapshots,
          notionSyncMappings,
          refreshSessions,
          releaseRecords,
          series,
          syncAppliedMutations,
          tierBoardAssets,
          tierBoardCards,
          tierBoards,
          tierLanes,
          timelineEntries,
          workContributors,
          workRecords,
          workRelations,
          workSeriesLinks,
        },
        generatedAt: new Date().toISOString(),
        omittedSensitiveFields: [
          'refresh token hashes',
          'previous refresh token hashes',
          'external provider encrypted keys',
          'external provider encryption iv/auth tags',
          'security event IP and user-agent hashes',
          'security event metadata',
          'row payload contents',
        ],
        userId: user.userId,
      };
    } catch (error) {
      this.metricsService?.recordUserDataRights({
        operation: 'deletion_preview',
        result: 'failure',
      });

      throw error;
    }
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

    if (!this.isTokenEmailCurrentForUser(tokenPayload, user)) {
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
    const expiresAt = new Date(
      Date.now() + AUTH_REFRESH_TOKEN_TTL_SECONDS * 1000,
    );
    const accessToken = this.signToken(
      user,
      sessionId,
      'access',
      AUTH_ACCESS_TOKEN_TTL_SECONDS,
    );
    const refreshToken = this.signToken(
      user,
      sessionId,
      'refresh',
      AUTH_REFRESH_TOKEN_TTL_SECONDS,
      rememberMe,
    );
    await this.prisma.userRefreshSession.create({
      data: {
        id: sessionId,
        expiresAt,
        ipAddress: maskAuthSessionIpAddress(metadata.ipAddress ?? null),
        lastUsedAt: new Date(),
        rememberMe,
        tokenHash: await hashSecret(refreshToken),
        userAgent: summarizeAuthSessionUserAgent(metadata.userAgent ?? null),
        userId: user.id,
      },
    });

    return {
      accessToken,
      refreshToken,
      rememberMe,
      sessionId,
      user: toAuthUserResponse(user),
    };
  }

  private async rotateSessionForUser(
    user: UserWithAuthAccounts,
    session: UserRefreshSession,
    rememberMe = true,
  ): Promise<IssuedAuthSession | null> {
    const accessToken = this.signToken(
      user,
      session.id,
      'access',
      AUTH_ACCESS_TOKEN_TTL_SECONDS,
    );
    const refreshToken = this.signToken(
      user,
      session.id,
      'refresh',
      AUTH_REFRESH_TOKEN_TTL_SECONDS,
      rememberMe,
    );
    const now = new Date();

    const updatedSession = await this.prisma.userRefreshSession.updateMany({
      where: {
        id: session.id,
        userId: session.userId,
        tokenHash: session.tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        lastUsedAt: now,
        previousRotatedAt: now,
        previousTokenHash: session.tokenHash,
        rememberMe,
        rotatedAt: now,
        tokenHash: await hashSecret(refreshToken),
      },
    });

    if (updatedSession.count !== 1) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      rememberMe,
      sessionId: session.id,
      user: toAuthUserResponse(user),
    };
  }

  private async issueAfterConcurrentRefresh(
    user: UserWithAuthAccounts,
    sessionId: string,
    refreshToken: string,
    rememberMe: boolean,
  ): Promise<IssuedAuthSession | null> {
    const latestSession = await this.prisma.userRefreshSession.findUnique({
      where: {
        id: sessionId,
      },
    });

    if (
      !latestSession ||
      latestSession.userId !== user.id ||
      latestSession.revokedAt ||
      latestSession.expiresAt.getTime() <= Date.now()
    ) {
      return null;
    }

    if (
      !(await this.isPreviousRefreshTokenWithinGrace(
        refreshToken,
        latestSession,
      ))
    ) {
      return null;
    }

    return {
      accessToken: this.signToken(
        user,
        latestSession.id,
        'access',
        AUTH_ACCESS_TOKEN_TTL_SECONDS,
      ),
      refreshToken: null,
      rememberMe,
      sessionId: latestSession.id,
      user: toAuthUserResponse(user),
    };
  }

  private async isPreviousRefreshTokenWithinGrace(
    refreshToken: string,
    session: Pick<
      UserRefreshSession,
      'previousRotatedAt' | 'previousTokenHash'
    >,
  ) {
    if (!session.previousTokenHash || !session.previousRotatedAt) {
      return false;
    }

    if (
      Date.now() - session.previousRotatedAt.getTime() >
      REFRESH_ROTATION_GRACE_MS
    ) {
      return false;
    }

    return verifySecret(refreshToken, session.previousTokenHash);
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
        algorithm: AUTH_JWT_ALGORITHM,
        audience: AUTH_JWT_AUDIENCE,
        expiresIn,
        issuer: AUTH_JWT_ISSUER,
        jwtid: randomBytes(16).toString('hex'),
      },
    );
  }

  private verifyToken(token: string, type: AuthTokenKind): AuthTokenPayload {
    try {
      const decoded = jwt.verify(token, this.getJwtSecret(type), {
        algorithms: [AUTH_JWT_ALGORITHM],
        audience: AUTH_JWT_AUDIENCE,
        issuer: AUTH_JWT_ISSUER,
      });

      if (
        typeof decoded === 'string' ||
        !hasExpectedAuthIdentityClaims(decoded as JwtPayload) ||
        (decoded as JwtPayload).type !== type ||
        !hasRequiredAuthJwtClaims(decoded as JwtPayload) ||
        !hasExpectedAuthTemporalClaims(decoded as JwtPayload, type) ||
        !hasExpectedAuthTokenKindClaims(decoded as JwtPayload, type) ||
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

  private isTokenEmailCurrentForUser(
    tokenPayload: Pick<AuthTokenPayload, 'email'>,
    user: Pick<User, 'email'>,
  ) {
    return (
      tokenPayload.email.trim().toLowerCase() ===
      user.email.trim().toLowerCase()
    );
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
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
          data: toGoogleAuthAccountData(profile),
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
          },
        }));

      await tx.userAuthAccount.create({
        data: {
          ...toGoogleAuthAccountData(profile),
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
      JSON.stringify({
        count: null,
        durationMs: null,
        entityType: 'refresh_session',
        errorCode: reason,
        event:
          eventType === 'auth.refresh.reuse_detected'
            ? 'auth.refresh.reuse_detected'
            : 'auth.refresh.failed',
        provider: null,
        requestId: metadata.requestId ?? null,
        userId: userId ?? null,
      }),
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
