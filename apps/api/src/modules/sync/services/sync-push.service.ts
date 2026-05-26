import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { WorkSyncStatus, WorkType } from '@prisma/client';
import type {
  ContributorEntityType,
  Prisma,
  SeriesKind,
  TimelineEntryType,
  UserContributor,
  UserSeries,
  WorkContributorRole,
  WorkRelationType,
  WorkSeriesRole,
  WorkStatus,
} from '@prisma/client';

import { CatalogService } from '../../catalog/catalog.service';
import type { CreateCatalogTitleInput } from '../../catalog/catalog-ingestion.service';
import {
  canCreateReleaseRecord,
  canUseProgressUnit,
} from '../../recording/recording-policy';
import {
  USER_RELEASE_RECORD_INCLUDE,
  toUserReleaseRecordResponse,
  UserReleaseRecordsService,
  type UserReleaseRecordAggregate,
} from '../../user-records/user-release-records.service';
import {
  UserRecordsService,
  type WorkAggregate,
} from '../../user-records/user-records.service';
import {
  toUserTimelineEntryResponse,
  UserTimelineEntriesService,
  type UserTimelineEntryAggregate,
} from '../../user-records/user-timeline-entries.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { MetricsService } from '../../../observability/metrics.service';
import {
  normalizeGenres,
  normalizeGenresAndPersonalTags,
  normalizeString,
  toFlatWorkResponse,
} from '../../works/work-aggregate';
import type { PushSyncChangeDto, PushSyncDto } from '../dto/push-sync.dto';
import type {
  PushSyncResponseDto,
  PushSyncResultDto,
} from '../dto/push-sync-response.dto';
import type { SyncContributorPayloadDto } from '../payloads/sync-contributor-payload.dto';
import type { SyncReleaseRecordPayloadDto } from '../payloads/sync-release-record-payload.dto';
import type { SyncSeriesPayloadDto } from '../payloads/sync-series-payload.dto';
import type { SyncTimelineEntryPayloadDto } from '../payloads/sync-timeline-entry-payload.dto';
import type {
  SyncTierBoardAssetPayloadDto,
  SyncTierBoardCardPayloadDto,
  SyncTierLanePayloadDto,
  SyncTierBoardPayloadDto,
} from '../payloads/sync-tier-board-payload.dto';
import type { SyncWorkContributorPayloadDto } from '../payloads/sync-work-contributor-payload.dto';
import type { SyncWorkPayloadDto } from '../payloads/sync-work-payload.dto';
import type { SyncWorkRelationPayloadDto } from '../payloads/sync-work-relation-payload.dto';
import type { SyncWorkSeriesLinkPayloadDto } from '../payloads/sync-work-series-link-payload.dto';
import { SYNC_SCHEMA_VERSION } from '../sync.constants';
import { SyncIdempotencyService } from './sync-idempotency.service';
import { SyncPayloadValidationService } from './sync-payload-validation.service';

const SERVER_SYNC_STATUS = WorkSyncStatus.synced;
const ALREADY_APPLIED_MESSAGE =
  'Remote record already matches the queued change.';
const APPLIED_CHANGE_MESSAGE = 'Queued change applied on the server.';
const APPLIED_TOMBSTONE_MESSAGE = 'Queued tombstone applied on the server.';
const CREATED_MESSAGE = 'Queued record created on the server.';
const MISSING_REMOTE_DELETE_NOOP_MESSAGE =
  'Remote delete was a no-op because the server record is missing.';

const SYNC_CODES = {
  alreadyApplied: 'already_applied',
  appliedChange: 'applied_change',
  appliedTombstone: 'applied_tombstone',
  conflictOwnershipMismatch: 'conflict_ownership_mismatch',
  conflictParentChanged: 'conflict_parent_changed',
  conflictRemoteMissing: 'conflict_remote_missing',
  conflictRemoteNewer: 'conflict_remote_newer',
  created: 'created',
  failedImportDraftUnresolved: 'failed_import_draft_unresolved',
  failedClientMutationReused: 'failed_client_mutation_reused',
  failedMissingCatalogTitle: 'failed_missing_catalog_title',
  failedValidation: 'failed_validation',
  missingRemoteDeleteNoop: 'missing_remote_delete_noop',
} as const;
const SYNC_CREATE_TITLE_INCLUDE = {
  contributors: {
    include: {
      contributor: true,
    },
    orderBy: {
      displayOrder: 'asc',
    },
  },
} satisfies Prisma.CatalogTitleInclude;

const USER_WORK_SERIES_LINK_INCLUDE = {
  userSeries: {
    select: {
      id: true,
      userId: true,
    },
  },
  userWork: {
    select: {
      id: true,
      userId: true,
    },
  },
} satisfies Prisma.UserWorkSeriesLinkInclude;

const USER_WORK_CONTRIBUTOR_INCLUDE = {
  userContributor: {
    select: {
      id: true,
      userId: true,
    },
  },
  userWork: {
    select: {
      id: true,
      userId: true,
    },
  },
} satisfies Prisma.UserWorkContributorInclude;

const USER_WORK_RELATION_INCLUDE = {
  sourceWork: {
    select: {
      id: true,
      userId: true,
    },
  },
  targetWork: {
    select: {
      id: true,
      userId: true,
    },
  },
} satisfies Prisma.UserWorkRelationInclude;

type SyncCreateTitleView = Prisma.CatalogTitleGetPayload<{
  include: typeof SYNC_CREATE_TITLE_INCLUDE;
}>;
type UserSeriesSyncView = UserSeries;
type UserContributorSyncView = UserContributor;
type UserWorkSeriesLinkSyncView = Prisma.UserWorkSeriesLinkGetPayload<{
  include: typeof USER_WORK_SERIES_LINK_INCLUDE;
}>;
type UserWorkContributorSyncView = Prisma.UserWorkContributorGetPayload<{
  include: typeof USER_WORK_CONTRIBUTOR_INCLUDE;
}>;
type UserWorkRelationSyncView = Prisma.UserWorkRelationGetPayload<{
  include: typeof USER_WORK_RELATION_INCLUDE;
}>;
type GraphPayloadKey =
  | 'contributor'
  | 'series'
  | 'workContributor'
  | 'workRelation'
  | 'workSeriesLink';
type StructuredLogFields = {
  count?: number;
  durationMs?: number;
  entityType?: string;
  errorCode?: string | undefined;
  provider?: string;
  requestId?: string | undefined;
  userId?: string;
};

@Injectable()
export class SyncPushService {
  private readonly logger = new Logger(SyncPushService.name);
  private readonly idempotencyService: SyncIdempotencyService;
  private readonly payloadValidationService: SyncPayloadValidationService;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogService) private readonly catalogService: CatalogService,
    @Inject(UserRecordsService)
    private readonly userRecordsService: UserRecordsService,
    @Inject(UserReleaseRecordsService)
    private readonly releaseRecordsService: UserReleaseRecordsService,
    @Inject(UserTimelineEntriesService)
    private readonly timelineEntriesService: UserTimelineEntriesService,
    @Inject(MetricsService)
    @Optional()
    private readonly metricsService?: MetricsService,
    @Inject(SyncIdempotencyService)
    @Optional()
    idempotencyService?: SyncIdempotencyService,
    @Inject(SyncPayloadValidationService)
    @Optional()
    payloadValidationService?: SyncPayloadValidationService,
  ) {
    this.idempotencyService =
      idempotencyService ?? new SyncIdempotencyService(this.prisma);
    this.payloadValidationService =
      payloadValidationService ?? new SyncPayloadValidationService();
  }

  async push(
    userId: string,
    pushSyncDto: PushSyncDto,
    requestId?: string,
  ): Promise<PushSyncResponseDto> {
    this.assertSupportedSchemaVersion(pushSyncDto);

    const { changes } = pushSyncDto;
    const sortedChanges = this.sortChangesByCreatedAt(changes);
    const results: PushSyncResultDto[] = [];
    const startedAt = Date.now();

    this.logEvent('sync.push.started', {
      count: changes.length,
      requestId,
      userId,
    });

    try {
      for (const change of sortedChanges) {
        results.push(await this.applyIdempotentChange(userId, change));
      }

      const response = {
        processedAt: new Date().toISOString(),
        results,
        schemaVersion: SYNC_SCHEMA_VERSION,
      };

      this.logPushSummary(userId, changes.length, response);
      this.metricsService?.recordSync('push', 'success');
      this.logEvent('sync.push.completed', {
        count: response.results.length,
        durationMs: Date.now() - startedAt,
        requestId,
        userId,
      });

      return response;
    } catch (error) {
      this.metricsService?.recordSync('push', 'failure');
      this.logEvent('sync.push.failed', {
        count: changes.length,
        durationMs: Date.now() - startedAt,
        errorCode: this.describeError(error),
        requestId,
        userId,
      });
      this.logger.warn(
        `Sync push failed userId=${userId} requested=${changes.length} reason=${this.describeError(error)}`,
      );
      throw error;
    }
  }

  private async applyIdempotentChange(
    userId: string,
    change: PushSyncChangeDto,
  ): Promise<PushSyncResultDto> {
    return this.idempotencyService.applyIdempotentChange(
      userId,
      change,
      (tx) => this.applyChange(userId, change, tx),
      (result) => {
        this.metricsService?.recordSyncResult(
          change.entityType,
          result.status,
          result.code ?? 'unknown',
        );

        if (result.status === 'conflict') {
          this.logEvent('sync.conflict.detected', {
            entityType: change.entityType,
            errorCode: result.code,
            userId,
          });
        }
      },
    );
  }

  private logEvent(event: string, fields: StructuredLogFields) {
    this.logger.log(
      JSON.stringify({
        count: fields.count ?? null,
        durationMs: fields.durationMs ?? null,
        entityType: fields.entityType ?? null,
        errorCode: fields.errorCode ?? null,
        event,
        provider: fields.provider ?? null,
        requestId: fields.requestId ?? null,
        userId: fields.userId ?? null,
      }),
    );
  }

  private async applyChange(
    userId: string,
    change: PushSyncChangeDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const payloadValidation =
      this.payloadValidationService.validateChangePayload(change);

    if (!payloadValidation.ok) {
      return payloadValidation.result;
    }

    if (change.entityType === 'series') {
      return this.applySeriesChange(
        userId,
        change,
        payloadValidation.payload as SyncSeriesPayloadDto,
        client,
      );
    }

    if (change.entityType === 'contributor') {
      return this.applyContributorChange(
        userId,
        change,
        payloadValidation.payload as SyncContributorPayloadDto,
        client,
      );
    }

    if (change.entityType === 'work_series_link') {
      return this.applyWorkSeriesLinkChange(
        userId,
        change,
        payloadValidation.payload as SyncWorkSeriesLinkPayloadDto,
        client,
      );
    }

    if (change.entityType === 'work_contributor') {
      return this.applyWorkContributorChange(
        userId,
        change,
        payloadValidation.payload as SyncWorkContributorPayloadDto,
        client,
      );
    }

    if (change.entityType === 'work_relation') {
      return this.applyWorkRelationChange(
        userId,
        change,
        payloadValidation.payload as SyncWorkRelationPayloadDto,
        client,
      );
    }

    if (change.entityType === 'tier_board') {
      return this.applyTierBoardChange(
        userId,
        change,
        payloadValidation.payload as SyncTierBoardPayloadDto,
        client,
      );
    }

    if (change.entityType === 'tier_lane') {
      return this.applyTierLaneChange(
        userId,
        change,
        payloadValidation.payload as SyncTierLanePayloadDto,
        client,
      );
    }

    if (change.entityType === 'tier_board_card') {
      return this.applyTierBoardCardChange(
        userId,
        change,
        payloadValidation.payload as SyncTierBoardCardPayloadDto,
        client,
      );
    }

    if (change.entityType === 'tier_board_asset') {
      return this.applyTierBoardAssetChange(
        userId,
        change,
        payloadValidation.payload as SyncTierBoardAssetPayloadDto,
        client,
      );
    }

    if (change.entityType === 'timeline_entry') {
      return this.applyTimelineEntryChange(
        userId,
        change,
        payloadValidation.payload as SyncTimelineEntryPayloadDto,
        client,
      );
    }

    if (change.entityType === 'release_record') {
      return this.applyReleaseRecordChange(
        userId,
        change,
        payloadValidation.payload as SyncReleaseRecordPayloadDto,
        client,
      );
    }

    const payload = payloadValidation.payload as SyncWorkPayloadDto;
    const progressValidationError = this.validateWorkProgressPayload(payload);

    if (progressValidationError) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'failed',
        code: SYNC_CODES.failedValidation,
        message: progressValidationError,
        work: null,
      };
    }

    const existing = await this.userRecordsService.findById(change.entityId);

    if (!existing) {
      return this.applyMissingRemoteChange(userId, change, payload, client);
    }

    if (existing.userId !== userId) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'conflict',
        code: SYNC_CODES.conflictOwnershipMismatch,
        message: 'Server mismatch: the record cannot be modified remotely.',
        work: null,
      };
    }

    if (this.areEquivalent(existing, payload)) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'applied',
        code: SYNC_CODES.alreadyApplied,
        message: ALREADY_APPLIED_MESSAGE,
        work: toFlatWorkResponse(existing),
      };
    }

    if (existing.serverVersion > payload.serverVersion) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'conflict',
        code: SYNC_CODES.conflictRemoteNewer,
        message: 'Server mismatch: the work record has a newer remote version.',
        work: toFlatWorkResponse(existing),
      };
    }

    // Keep catalog compatibility metadata and the user record update in the
    // same sync mutation transaction.
    await this.catalogService.update(
      existing.catalogWorkId,
      this.buildCatalogUpdateData(payload),
      client,
    );

    const updated = await this.userRecordsService.update(
      change.entityId,
      this.buildUserRecordUpdateData(payload),
      client,
    );

    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'work',
      status: 'applied',
      code:
        payload.deletedAt === null
          ? SYNC_CODES.appliedChange
          : SYNC_CODES.appliedTombstone,
      message:
        payload.deletedAt === null
          ? APPLIED_CHANGE_MESSAGE
          : APPLIED_TOMBSTONE_MESSAGE,
      work: toFlatWorkResponse(updated),
    };
  }

  private assertSupportedSchemaVersion({
    schemaVersion,
  }: {
    schemaVersion?: unknown;
  }) {
    if (schemaVersion === undefined) {
      return;
    }

    if (schemaVersion !== SYNC_SCHEMA_VERSION) {
      throw new BadRequestException(
        `Unsupported sync schema version "${String(schemaVersion)}". Supported version is ${SYNC_SCHEMA_VERSION}.`,
      );
    }
  }

  private async applyMissingRemoteChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncWorkPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const isDelete =
      change.operation === 'delete' || payload.deletedAt !== null;
    const canCreate =
      change.operation === 'create' && payload.serverVersion === 0;

    if (isDelete) {
      if (payload.serverVersion > 0) {
        return {
          queueId: change.queueId,
          entityId: change.entityId,
          entityType: 'work',
          status: 'conflict',
          code: SYNC_CODES.conflictRemoteMissing,
          message:
            'Server mismatch: the record was already missing remotely when a previously synced delete was pushed.',
          work: null,
        };
      }

      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'applied',
        code: SYNC_CODES.missingRemoteDeleteNoop,
        message: MISSING_REMOTE_DELETE_NOOP_MESSAGE,
        work: null,
      };
    }

    if (!canCreate) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'conflict',
        code: SYNC_CODES.conflictRemoteMissing,
        message: 'Server mismatch: the record does not exist remotely anymore.',
        work: null,
      };
    }

    const existingTitle = payload.catalogTitleId
      ? await this.findCatalogTitleForSyncCreate(payload.catalogTitleId)
      : null;
    const importDraftCatalogTitle = payload.importDraft
      ? this.resolveImportDraftCatalogTitle(payload)
      : null;

    if (payload.catalogTitleId && !existingTitle) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'failed',
        code: SYNC_CODES.failedMissingCatalogTitle,
        message: `Catalog title with id "${payload.catalogTitleId}" was not found.`,
        work: null,
      };
    }

    if (payload.importDraft && !importDraftCatalogTitle) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'failed',
        code: SYNC_CODES.failedImportDraftUnresolved,
        message:
          'Catalog title could not be resolved from importDraft.catalogTitle or payload.title.',
        work: null,
      };
    }

    let created: WorkAggregate;

    if (existingTitle) {
      await client.catalogWork.create({
        data: this.buildCompatibilityCatalogWorkCreateData(
          payload,
          existingTitle,
        ),
      });

      created = await this.userRecordsService.create(
        this.buildUserRecordCreateData(userId, payload, existingTitle.id),
        client,
      );
    } else if (payload.importDraft) {
      const title = await this.catalogService.createTitleFromImportCandidate(
        this.buildImportTitleCreateData(payload, importDraftCatalogTitle!),
        client,
      );

      await client.catalogWork.create({
        data: this.buildCompatibilityCatalogWorkCreateData(payload),
      });

      created = await this.userRecordsService.create(
        this.buildUserRecordCreateData(userId, payload, title.id),
        client,
      );
    } else {
      await this.catalogService.create(
        this.buildCatalogCreateData(payload),
        client,
      );

      created = await this.userRecordsService.create(
        this.buildUserRecordCreateData(userId, payload),
        client,
      );
    }

    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'work',
      status: 'applied',
      code: SYNC_CODES.created,
      message: CREATED_MESSAGE,
      work: toFlatWorkResponse(created),
    };
  }

  private async applyReleaseRecordChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncReleaseRecordPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const existing = await this.releaseRecordsService.findById(change.entityId);

    if (!existing) {
      return this.applyMissingRemoteReleaseRecordChange(
        userId,
        change,
        payload,
        client,
      );
    }

    if (existing.userWorkRecord.userId !== userId) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'release_record',
        status: 'conflict',
        code: SYNC_CODES.conflictOwnershipMismatch,
        message:
          'Server mismatch: the release record cannot be modified remotely.',
        releaseRecord: null,
      };
    }

    if (
      existing.userWorkRecordId !== payload.userWorkRecordId ||
      existing.catalogReleaseId !== payload.catalogReleaseId
    ) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'release_record',
        status: 'conflict',
        code: SYNC_CODES.conflictParentChanged,
        message: 'Server mismatch: release record parent or release changed.',
        releaseRecord: toUserReleaseRecordResponse(existing),
      };
    }

    const validationError = await this.validateReleaseRecordTarget(
      userId,
      payload,
      client,
    );

    if (validationError) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'release_record',
        status: 'failed',
        code: SYNC_CODES.failedValidation,
        message: validationError,
        releaseRecord: toUserReleaseRecordResponse(existing),
      };
    }

    if (this.areReleaseRecordsEquivalent(existing, payload)) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'release_record',
        status: 'applied',
        code: SYNC_CODES.alreadyApplied,
        message: ALREADY_APPLIED_MESSAGE,
        releaseRecord: toUserReleaseRecordResponse(existing),
      };
    }

    const updated = await this.releaseRecordsService.update(
      change.entityId,
      this.buildReleaseRecordUpdateData(payload),
      client,
    );

    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'release_record',
      status: 'applied',
      code:
        payload.deletedAt === null
          ? SYNC_CODES.appliedChange
          : SYNC_CODES.appliedTombstone,
      message:
        payload.deletedAt === null
          ? APPLIED_CHANGE_MESSAGE
          : APPLIED_TOMBSTONE_MESSAGE,
      releaseRecord: toUserReleaseRecordResponse(updated),
    };
  }

  private async applyMissingRemoteReleaseRecordChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncReleaseRecordPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const isDelete =
      change.operation === 'delete' || payload.deletedAt !== null;
    const canCreate =
      change.operation === 'create' && payload.serverVersion === 0;

    if (isDelete) {
      if (payload.serverVersion > 0) {
        return {
          queueId: change.queueId,
          entityId: change.entityId,
          entityType: 'release_record',
          status: 'conflict',
          code: SYNC_CODES.conflictRemoteMissing,
          message:
            'Server mismatch: the release record was already missing remotely.',
          releaseRecord: null,
        };
      }

      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'release_record',
        status: 'applied',
        code: SYNC_CODES.missingRemoteDeleteNoop,
        message: MISSING_REMOTE_DELETE_NOOP_MESSAGE,
        releaseRecord: null,
      };
    }

    if (!canCreate) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'release_record',
        status: 'conflict',
        code: SYNC_CODES.conflictRemoteMissing,
        message: 'Server mismatch: the release record does not exist remotely.',
        releaseRecord: null,
      };
    }

    const validationError = await this.validateReleaseRecordTarget(
      userId,
      payload,
      client,
    );

    if (validationError) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'release_record',
        status: 'failed',
        code: SYNC_CODES.failedValidation,
        message: validationError,
        releaseRecord: null,
      };
    }

    const created = await client.userReleaseRecord.create({
      data: this.buildReleaseRecordCreateData(payload),
      include: USER_RELEASE_RECORD_INCLUDE,
    });
    const hydrated =
      created.createdAt instanceof Date
        ? created
        : await this.releaseRecordsService.findById(created.id);

    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'release_record',
      status: 'applied',
      code: SYNC_CODES.created,
      message: CREATED_MESSAGE,
      releaseRecord: hydrated ? toUserReleaseRecordResponse(hydrated) : null,
    };
  }

  private async applyTimelineEntryChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncTimelineEntryPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const existing = await this.timelineEntriesService.findById(
      change.entityId,
    );

    if (!existing) {
      return this.applyMissingRemoteTimelineEntryChange(
        userId,
        change,
        payload,
        client,
      );
    }

    if (existing.userId !== userId) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'timeline_entry',
        status: 'conflict',
        code: SYNC_CODES.conflictOwnershipMismatch,
        message:
          'Server mismatch: the timeline entry cannot be modified remotely.',
        timelineEntry: null,
      };
    }

    if (existing.userWorkRecordId !== payload.workId) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'timeline_entry',
        status: 'conflict',
        code: SYNC_CODES.conflictParentChanged,
        message: 'Server mismatch: timeline entry parent changed.',
        timelineEntry: toUserTimelineEntryResponse(existing),
      };
    }

    const validationError = await this.validateTimelineEntryTarget(
      userId,
      payload,
      client,
    );

    if (validationError) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'timeline_entry',
        status: 'failed',
        code: SYNC_CODES.failedValidation,
        message: validationError,
        timelineEntry: toUserTimelineEntryResponse(existing),
      };
    }

    if (this.areTimelineEntriesEquivalent(existing, payload)) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'timeline_entry',
        status: 'applied',
        code: SYNC_CODES.alreadyApplied,
        message: ALREADY_APPLIED_MESSAGE,
        timelineEntry: toUserTimelineEntryResponse(existing),
      };
    }

    const updated = await this.timelineEntriesService.update(
      change.entityId,
      this.buildTimelineEntryUpdateData(payload),
      client,
    );

    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'timeline_entry',
      status: 'applied',
      code:
        payload.deletedAt === null
          ? SYNC_CODES.appliedChange
          : SYNC_CODES.appliedTombstone,
      message:
        payload.deletedAt === null
          ? APPLIED_CHANGE_MESSAGE
          : APPLIED_TOMBSTONE_MESSAGE,
      timelineEntry: toUserTimelineEntryResponse(updated),
    };
  }

  private async applyMissingRemoteTimelineEntryChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncTimelineEntryPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const isDelete =
      change.operation === 'delete' || payload.deletedAt !== null;
    const canCreate =
      change.operation === 'create' && payload.serverVersion === 0;

    if (isDelete) {
      if (payload.serverVersion > 0) {
        return {
          queueId: change.queueId,
          entityId: change.entityId,
          entityType: 'timeline_entry',
          status: 'conflict',
          code: SYNC_CODES.conflictRemoteMissing,
          message:
            'Server mismatch: the timeline entry was already missing remotely.',
          timelineEntry: null,
        };
      }

      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'timeline_entry',
        status: 'applied',
        code: SYNC_CODES.missingRemoteDeleteNoop,
        message: MISSING_REMOTE_DELETE_NOOP_MESSAGE,
        timelineEntry: null,
      };
    }

    if (!canCreate) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'timeline_entry',
        status: 'conflict',
        code: SYNC_CODES.conflictRemoteMissing,
        message: 'Server mismatch: the timeline entry does not exist remotely.',
        timelineEntry: null,
      };
    }

    const validationError = await this.validateTimelineEntryTarget(
      userId,
      payload,
      client,
    );

    if (validationError) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'timeline_entry',
        status: 'failed',
        code: SYNC_CODES.failedValidation,
        message: validationError,
        timelineEntry: null,
      };
    }

    const created = await this.timelineEntriesService.create(
      this.buildTimelineEntryCreateData(userId, payload),
      client,
    );

    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'timeline_entry',
      status: 'applied',
      code: SYNC_CODES.created,
      message: CREATED_MESSAGE,
      timelineEntry: toUserTimelineEntryResponse(created),
    };
  }

  private async applySeriesChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncSeriesPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const existing = await client.userSeries.findUnique({
      where: { id: change.entityId },
    });

    if (!existing) {
      return this.applyMissingRemoteSeriesChange(
        userId,
        change,
        payload,
        client,
      );
    }

    if (existing.userId !== userId) {
      return this.buildGraphOwnershipConflict(change, 'series');
    }

    const validationError = await this.validateSeriesParent(
      userId,
      payload,
      client,
    );
    if (validationError) {
      return this.buildGraphValidationFailure(
        change,
        'series',
        validationError,
        {
          series: this.toPushSyncSeriesPayload(existing),
        },
      );
    }

    if (
      existing.serverVersion > payload.serverVersion &&
      !this.areSeriesEquivalent(existing, payload)
    ) {
      return this.buildGraphRemoteNewerConflict(change, 'series', {
        series: this.toPushSyncSeriesPayload(existing),
      });
    }

    if (this.areSeriesEquivalent(existing, payload)) {
      return this.buildGraphAppliedResult(change, 'series', {
        code: SYNC_CODES.alreadyApplied,
        message: ALREADY_APPLIED_MESSAGE,
        series: this.toPushSyncSeriesPayload(existing),
      });
    }

    const updated = await client.userSeries.update({
      where: { id: change.entityId },
      data: this.buildSeriesUpdateData(payload),
    });

    return this.buildGraphAppliedResult(change, 'series', {
      code:
        payload.deletedAt === null
          ? SYNC_CODES.appliedChange
          : SYNC_CODES.appliedTombstone,
      message:
        payload.deletedAt === null
          ? APPLIED_CHANGE_MESSAGE
          : APPLIED_TOMBSTONE_MESSAGE,
      series: this.toPushSyncSeriesPayload(updated),
    });
  }

  private async applyMissingRemoteSeriesChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncSeriesPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const missingResult = this.getMissingRemoteGraphResult(change, payload);
    if (missingResult) return missingResult;

    const validationError = await this.validateSeriesParent(
      userId,
      payload,
      client,
    );
    if (validationError) {
      return this.buildGraphValidationFailure(
        change,
        'series',
        validationError,
        {
          series: null,
        },
      );
    }

    const created = await client.userSeries.create({
      data: this.buildSeriesCreateData(userId, payload),
    });

    return this.buildGraphAppliedResult(change, 'series', {
      code: SYNC_CODES.created,
      message: CREATED_MESSAGE,
      series: this.toPushSyncSeriesPayload(created),
    });
  }

  private async applyContributorChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncContributorPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const existing = await client.userContributor.findUnique({
      where: { id: change.entityId },
    });

    if (!existing) {
      return this.applyMissingRemoteContributorChange(
        userId,
        change,
        payload,
        client,
      );
    }

    if (existing.userId !== userId) {
      return this.buildGraphOwnershipConflict(change, 'contributor');
    }

    if (
      existing.serverVersion > payload.serverVersion &&
      !this.areContributorsEquivalent(existing, payload)
    ) {
      return this.buildGraphRemoteNewerConflict(change, 'contributor', {
        contributor: this.toPushSyncContributorPayload(existing),
      });
    }

    if (this.areContributorsEquivalent(existing, payload)) {
      return this.buildGraphAppliedResult(change, 'contributor', {
        code: SYNC_CODES.alreadyApplied,
        contributor: this.toPushSyncContributorPayload(existing),
        message: ALREADY_APPLIED_MESSAGE,
      });
    }

    const updated = await client.userContributor.update({
      where: { id: change.entityId },
      data: this.buildContributorUpdateData(payload),
    });

    return this.buildGraphAppliedResult(change, 'contributor', {
      code:
        payload.deletedAt === null
          ? SYNC_CODES.appliedChange
          : SYNC_CODES.appliedTombstone,
      contributor: this.toPushSyncContributorPayload(updated),
      message:
        payload.deletedAt === null
          ? APPLIED_CHANGE_MESSAGE
          : APPLIED_TOMBSTONE_MESSAGE,
    });
  }

  private async applyMissingRemoteContributorChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncContributorPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const missingResult = this.getMissingRemoteGraphResult(change, payload);
    if (missingResult) return missingResult;

    const created = await client.userContributor.create({
      data: this.buildContributorCreateData(userId, payload),
    });

    return this.buildGraphAppliedResult(change, 'contributor', {
      code: SYNC_CODES.created,
      contributor: this.toPushSyncContributorPayload(created),
      message: CREATED_MESSAGE,
    });
  }

  private async applyWorkSeriesLinkChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncWorkSeriesLinkPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const existing = await client.userWorkSeriesLink.findUnique({
      where: { id: change.entityId },
      include: USER_WORK_SERIES_LINK_INCLUDE,
    });

    if (!existing) {
      return this.applyMissingRemoteWorkSeriesLinkChange(
        userId,
        change,
        payload,
        client,
      );
    }

    if (
      existing.userWork.userId !== userId ||
      existing.userSeries.userId !== userId
    ) {
      return this.buildGraphOwnershipConflict(change, 'workSeriesLink');
    }

    if (
      existing.userWorkId !== payload.workId ||
      existing.userSeriesId !== payload.seriesId
    ) {
      return this.buildGraphParentChangedConflict(change, 'workSeriesLink', {
        workSeriesLink: this.toPushSyncWorkSeriesLinkPayload(existing),
      });
    }

    const validationError = await this.validateWorkSeriesLinkTarget(
      userId,
      payload,
      client,
    );
    if (validationError) {
      return this.buildGraphValidationFailure(
        change,
        'workSeriesLink',
        validationError,
        { workSeriesLink: this.toPushSyncWorkSeriesLinkPayload(existing) },
      );
    }

    if (
      existing.serverVersion > payload.serverVersion &&
      !this.areWorkSeriesLinksEquivalent(existing, payload)
    ) {
      return this.buildGraphRemoteNewerConflict(change, 'workSeriesLink', {
        workSeriesLink: this.toPushSyncWorkSeriesLinkPayload(existing),
      });
    }

    if (this.areWorkSeriesLinksEquivalent(existing, payload)) {
      return this.buildGraphAppliedResult(change, 'workSeriesLink', {
        code: SYNC_CODES.alreadyApplied,
        message: ALREADY_APPLIED_MESSAGE,
        workSeriesLink: this.toPushSyncWorkSeriesLinkPayload(existing),
      });
    }

    const updated = await client.userWorkSeriesLink.update({
      where: { id: change.entityId },
      data: this.buildWorkSeriesLinkUpdateData(payload),
      include: USER_WORK_SERIES_LINK_INCLUDE,
    });

    return this.buildGraphAppliedResult(change, 'workSeriesLink', {
      code:
        payload.deletedAt === null
          ? SYNC_CODES.appliedChange
          : SYNC_CODES.appliedTombstone,
      message:
        payload.deletedAt === null
          ? APPLIED_CHANGE_MESSAGE
          : APPLIED_TOMBSTONE_MESSAGE,
      workSeriesLink: this.toPushSyncWorkSeriesLinkPayload(updated),
    });
  }

  private async applyMissingRemoteWorkSeriesLinkChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncWorkSeriesLinkPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const missingResult = this.getMissingRemoteGraphResult(change, payload);
    if (missingResult) return missingResult;

    const validationError = await this.validateWorkSeriesLinkTarget(
      userId,
      payload,
      client,
    );
    if (validationError) {
      return this.buildGraphValidationFailure(
        change,
        'workSeriesLink',
        validationError,
        { workSeriesLink: null },
      );
    }

    const created = await client.userWorkSeriesLink.create({
      data: this.buildWorkSeriesLinkCreateData(payload),
      include: USER_WORK_SERIES_LINK_INCLUDE,
    });

    return this.buildGraphAppliedResult(change, 'workSeriesLink', {
      code: SYNC_CODES.created,
      message: CREATED_MESSAGE,
      workSeriesLink: this.toPushSyncWorkSeriesLinkPayload(created),
    });
  }

  private async applyWorkContributorChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncWorkContributorPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const existing = await client.userWorkContributor.findUnique({
      where: { id: change.entityId },
      include: USER_WORK_CONTRIBUTOR_INCLUDE,
    });

    if (!existing) {
      return this.applyMissingRemoteWorkContributorChange(
        userId,
        change,
        payload,
        client,
      );
    }

    if (
      existing.userWork.userId !== userId ||
      existing.userContributor.userId !== userId
    ) {
      return this.buildGraphOwnershipConflict(change, 'workContributor');
    }

    if (
      existing.userWorkId !== payload.workId ||
      existing.userContributorId !== payload.contributorId
    ) {
      return this.buildGraphParentChangedConflict(change, 'workContributor', {
        workContributor: this.toPushSyncWorkContributorPayload(existing),
      });
    }

    const validationError = await this.validateWorkContributorTarget(
      userId,
      payload,
      client,
    );
    if (validationError) {
      return this.buildGraphValidationFailure(
        change,
        'workContributor',
        validationError,
        { workContributor: this.toPushSyncWorkContributorPayload(existing) },
      );
    }

    if (
      existing.serverVersion > payload.serverVersion &&
      !this.areWorkContributorsEquivalent(existing, payload)
    ) {
      return this.buildGraphRemoteNewerConflict(change, 'workContributor', {
        workContributor: this.toPushSyncWorkContributorPayload(existing),
      });
    }

    if (this.areWorkContributorsEquivalent(existing, payload)) {
      return this.buildGraphAppliedResult(change, 'workContributor', {
        code: SYNC_CODES.alreadyApplied,
        message: ALREADY_APPLIED_MESSAGE,
        workContributor: this.toPushSyncWorkContributorPayload(existing),
      });
    }

    const updated = await client.userWorkContributor.update({
      where: { id: change.entityId },
      data: this.buildWorkContributorUpdateData(payload),
      include: USER_WORK_CONTRIBUTOR_INCLUDE,
    });

    return this.buildGraphAppliedResult(change, 'workContributor', {
      code:
        payload.deletedAt === null
          ? SYNC_CODES.appliedChange
          : SYNC_CODES.appliedTombstone,
      message:
        payload.deletedAt === null
          ? APPLIED_CHANGE_MESSAGE
          : APPLIED_TOMBSTONE_MESSAGE,
      workContributor: this.toPushSyncWorkContributorPayload(updated),
    });
  }

  private async applyMissingRemoteWorkContributorChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncWorkContributorPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const missingResult = this.getMissingRemoteGraphResult(change, payload);
    if (missingResult) return missingResult;

    const validationError = await this.validateWorkContributorTarget(
      userId,
      payload,
      client,
    );
    if (validationError) {
      return this.buildGraphValidationFailure(
        change,
        'workContributor',
        validationError,
        { workContributor: null },
      );
    }

    const created = await client.userWorkContributor.create({
      data: this.buildWorkContributorCreateData(payload),
      include: USER_WORK_CONTRIBUTOR_INCLUDE,
    });

    return this.buildGraphAppliedResult(change, 'workContributor', {
      code: SYNC_CODES.created,
      message: CREATED_MESSAGE,
      workContributor: this.toPushSyncWorkContributorPayload(created),
    });
  }

  private async applyWorkRelationChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncWorkRelationPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const existing = await client.userWorkRelation.findUnique({
      where: { id: change.entityId },
      include: USER_WORK_RELATION_INCLUDE,
    });

    if (!existing) {
      return this.applyMissingRemoteWorkRelationChange(
        userId,
        change,
        payload,
        client,
      );
    }

    if (
      existing.userId !== userId ||
      existing.sourceWork.userId !== userId ||
      existing.targetWork.userId !== userId
    ) {
      return this.buildGraphOwnershipConflict(change, 'workRelation');
    }

    if (
      existing.sourceWorkId !== payload.sourceWorkId ||
      existing.targetWorkId !== payload.targetWorkId
    ) {
      return this.buildGraphParentChangedConflict(change, 'workRelation', {
        workRelation: this.toPushSyncWorkRelationPayload(existing),
      });
    }

    const validationError = await this.validateWorkRelationTarget(
      userId,
      payload,
      client,
    );
    if (validationError) {
      return this.buildGraphValidationFailure(
        change,
        'workRelation',
        validationError,
        { workRelation: this.toPushSyncWorkRelationPayload(existing) },
      );
    }

    if (
      existing.serverVersion > payload.serverVersion &&
      !this.areWorkRelationsEquivalent(existing, payload)
    ) {
      return this.buildGraphRemoteNewerConflict(change, 'workRelation', {
        workRelation: this.toPushSyncWorkRelationPayload(existing),
      });
    }

    if (this.areWorkRelationsEquivalent(existing, payload)) {
      return this.buildGraphAppliedResult(change, 'workRelation', {
        code: SYNC_CODES.alreadyApplied,
        message: ALREADY_APPLIED_MESSAGE,
        workRelation: this.toPushSyncWorkRelationPayload(existing),
      });
    }

    const updated = await client.userWorkRelation.update({
      where: { id: change.entityId },
      data: this.buildWorkRelationUpdateData(payload),
      include: USER_WORK_RELATION_INCLUDE,
    });

    return this.buildGraphAppliedResult(change, 'workRelation', {
      code:
        payload.deletedAt === null
          ? SYNC_CODES.appliedChange
          : SYNC_CODES.appliedTombstone,
      message:
        payload.deletedAt === null
          ? APPLIED_CHANGE_MESSAGE
          : APPLIED_TOMBSTONE_MESSAGE,
      workRelation: this.toPushSyncWorkRelationPayload(updated),
    });
  }

  private async applyMissingRemoteWorkRelationChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncWorkRelationPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const missingResult = this.getMissingRemoteGraphResult(change, payload);
    if (missingResult) return missingResult;

    const validationError = await this.validateWorkRelationTarget(
      userId,
      payload,
      client,
    );
    if (validationError) {
      return this.buildGraphValidationFailure(
        change,
        'workRelation',
        validationError,
        { workRelation: null },
      );
    }

    const created = await client.userWorkRelation.create({
      data: this.buildWorkRelationCreateData(userId, payload),
      include: USER_WORK_RELATION_INCLUDE,
    });

    return this.buildGraphAppliedResult(change, 'workRelation', {
      code: SYNC_CODES.created,
      message: CREATED_MESSAGE,
      workRelation: this.toPushSyncWorkRelationPayload(created),
    });
  }

  private validateWorkProgressPayload(payload: SyncWorkPayloadDto) {
    if (payload.progressUnit !== null && payload.progressUnit !== undefined) {
      const type = payload.type as WorkType;

      if (!canUseProgressUnit(type, payload.progressUnit)) {
        return `Progress unit "${payload.progressUnit}" is not supported for medium type "${payload.type}".`;
      }
    }

    if (
      payload.progressCurrent !== null &&
      payload.progressCurrent !== undefined &&
      payload.progressTotal !== null &&
      payload.progressTotal !== undefined &&
      payload.progressCurrent > payload.progressTotal
    ) {
      return 'progressCurrent cannot exceed progressTotal.';
    }

    return null;
  }

  private async validateReleaseRecordTarget(
    userId: string,
    payload: SyncReleaseRecordPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const parent = await this.userRecordsService.findById(
      payload.userWorkRecordId,
    );

    if (!parent || parent.userId !== userId) {
      return 'Release record parent is missing or belongs to a different user.';
    }

    const mediumType =
      parent.catalogTitle?.mediumType ?? parent.catalogWork.type;

    if (!canCreateReleaseRecord(mediumType)) {
      return `Release-level records are not supported for medium type "${mediumType}".`;
    }

    if (!parent.catalogTitleId) {
      return 'Release-level records require a catalog title bridge.';
    }

    const release = await client.catalogRelease.findFirst({
      where: {
        id: payload.catalogReleaseId,
        catalogTitleId: parent.catalogTitleId,
      },
    });

    if (!release) {
      return 'Catalog release does not belong to the parent catalog title.';
    }

    return null;
  }

  private async validateTimelineEntryTarget(
    userId: string,
    payload: SyncTimelineEntryPayloadDto,
    _client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const parent = await this.userRecordsService.findById(payload.workId);

    if (!parent || parent.userId !== userId) {
      return 'Timeline entry parent is missing or belongs to a different user.';
    }

    return null;
  }

  private async validateSeriesParent(
    userId: string,
    payload: SyncSeriesPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    if (!payload.parentId) {
      return null;
    }

    if (payload.parentId === payload.id) {
      return 'Series parent cannot point to itself.';
    }

    const parent = await client.userSeries.findFirst({
      where: {
        id: payload.parentId,
        userId,
      },
    });

    return parent
      ? null
      : 'Series parent is missing or belongs to a different user.';
  }

  private async validateWorkSeriesLinkTarget(
    userId: string,
    payload: SyncWorkSeriesLinkPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const [work, series] = await Promise.all([
      this.userRecordsService.findById(payload.workId),
      client.userSeries.findFirst({
        where: {
          id: payload.seriesId,
          userId,
        },
      }),
    ]);

    if (!work || work.userId !== userId) {
      return 'Series link parent work is missing or belongs to a different user.';
    }

    if (!series) {
      return 'Series link target series is missing or belongs to a different user.';
    }

    return null;
  }

  private async validateWorkContributorTarget(
    userId: string,
    payload: SyncWorkContributorPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const [work, contributor] = await Promise.all([
      this.userRecordsService.findById(payload.workId),
      client.userContributor.findFirst({
        where: {
          id: payload.contributorId,
          userId,
        },
      }),
    ]);

    if (!work || work.userId !== userId) {
      return 'Contributor link parent work is missing or belongs to a different user.';
    }

    if (!contributor) {
      return 'Contributor link target is missing or belongs to a different user.';
    }

    return null;
  }

  private async validateWorkRelationTarget(
    userId: string,
    payload: SyncWorkRelationPayloadDto,
    _client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    if (payload.sourceWorkId === payload.targetWorkId) {
      return 'Work relation cannot point to the same work.';
    }

    const [sourceWork, targetWork] = await Promise.all([
      this.userRecordsService.findById(payload.sourceWorkId),
      this.userRecordsService.findById(payload.targetWorkId),
    ]);

    if (!sourceWork || sourceWork.userId !== userId) {
      return 'Relation source work is missing or belongs to a different user.';
    }

    if (!targetWork || targetWork.userId !== userId) {
      return 'Relation target work is missing or belongs to a different user.';
    }

    return null;
  }

  private getMissingRemoteGraphResult(
    change: PushSyncChangeDto,
    payload: { deletedAt: string | null; serverVersion: number },
  ): PushSyncResultDto | null {
    const isDelete =
      change.operation === 'delete' || payload.deletedAt !== null;
    const canCreate =
      change.operation === 'create' && payload.serverVersion === 0;

    if (isDelete) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: change.entityType,
        status: payload.serverVersion > 0 ? 'conflict' : 'applied',
        code:
          payload.serverVersion > 0
            ? SYNC_CODES.conflictRemoteMissing
            : SYNC_CODES.missingRemoteDeleteNoop,
        message:
          payload.serverVersion > 0
            ? 'Server mismatch: the graph record was already missing remotely.'
            : MISSING_REMOTE_DELETE_NOOP_MESSAGE,
      };
    }

    if (!canCreate) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: change.entityType,
        status: 'conflict',
        code: SYNC_CODES.conflictRemoteMissing,
        message: 'Server mismatch: the graph record does not exist remotely.',
      };
    }

    return null;
  }

  private buildGraphOwnershipConflict(
    change: PushSyncChangeDto,
    key: GraphPayloadKey,
  ): PushSyncResultDto {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: 'conflict',
      code: SYNC_CODES.conflictOwnershipMismatch,
      message: 'Server mismatch: the graph record belongs to a different user.',
      [key]: null,
    };
  }

  private buildGraphParentChangedConflict(
    change: PushSyncChangeDto,
    key: GraphPayloadKey,
    payload: Partial<PushSyncResultDto>,
  ): PushSyncResultDto {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: 'conflict',
      code: SYNC_CODES.conflictParentChanged,
      message: 'Server mismatch: graph record parent changed.',
      ...payload,
      [key]: payload[key] ?? null,
    };
  }

  private buildGraphRemoteNewerConflict(
    change: PushSyncChangeDto,
    key: GraphPayloadKey,
    payload: Partial<PushSyncResultDto>,
  ): PushSyncResultDto {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: 'conflict',
      code: SYNC_CODES.conflictRemoteNewer,
      message: 'Server mismatch: the graph record has a newer remote version.',
      ...payload,
      [key]: payload[key] ?? null,
    };
  }

  private buildGraphValidationFailure(
    change: PushSyncChangeDto,
    key: GraphPayloadKey,
    message: string,
    payload: Partial<PushSyncResultDto>,
  ): PushSyncResultDto {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: 'failed',
      code: SYNC_CODES.failedValidation,
      message,
      ...payload,
      [key]: payload[key] ?? null,
    };
  }

  private buildGraphAppliedResult(
    change: PushSyncChangeDto,
    key: GraphPayloadKey,
    payload: Partial<PushSyncResultDto> &
      Pick<PushSyncResultDto, 'code' | 'message'>,
  ): PushSyncResultDto {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: 'applied',
      ...payload,
      [key]: payload[key] ?? null,
    };
  }

  private buildReleaseRecordCreateData(
    payload: SyncReleaseRecordPayloadDto,
  ): Prisma.UserReleaseRecordUncheckedCreateInput {
    return {
      id: payload.id,
      userWorkRecordId: payload.userWorkRecordId,
      catalogReleaseId: payload.catalogReleaseId,
      status: payload.status as WorkStatus,
      rating: payload.rating ?? null,
      shortReview: normalizeString(payload.shortReview),
      review: normalizeString(payload.review),
      favorite: payload.favorite,
      createdAt: this.parseIsoDate(payload.createdAt, 'payload.createdAt'),
      updatedAt: this.parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: 1,
    };
  }

  private buildReleaseRecordUpdateData(
    payload: SyncReleaseRecordPayloadDto,
  ): Prisma.UserReleaseRecordUpdateInput {
    return {
      status: payload.status as WorkStatus,
      rating: payload.rating ?? null,
      shortReview: normalizeString(payload.shortReview),
      review: normalizeString(payload.review),
      favorite: payload.favorite,
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: {
        increment: 1,
      },
    };
  }

  private buildTimelineEntryCreateData(
    userId: string,
    payload: SyncTimelineEntryPayloadDto,
  ): Prisma.UserTimelineEntryUncheckedCreateInput {
    return {
      id: payload.id,
      userId,
      userWorkRecordId: payload.workId,
      type: payload.type as TimelineEntryType,
      occurredAt: this.parseIsoDate(payload.occurredAt, 'payload.occurredAt'),
      note: normalizeString(payload.note),
      createdAt: this.parseIsoDate(payload.createdAt, 'payload.createdAt'),
      updatedAt: this.parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: 1,
    };
  }

  private buildTimelineEntryUpdateData(
    payload: SyncTimelineEntryPayloadDto,
  ): Prisma.UserTimelineEntryUpdateInput {
    return {
      type: payload.type as TimelineEntryType,
      occurredAt: this.parseIsoDate(payload.occurredAt, 'payload.occurredAt'),
      note: normalizeString(payload.note),
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: {
        increment: 1,
      },
    };
  }

  private buildSeriesCreateData(
    userId: string,
    payload: SyncSeriesPayloadDto,
  ): Prisma.UserSeriesUncheckedCreateInput {
    return {
      id: payload.id,
      userId,
      title: payload.title.trim(),
      normalizedTitle: normalizeString(payload.normalizedTitle),
      aliases: payload.aliases.map(normalizeString).filter(Boolean),
      kind: payload.kind as SeriesKind,
      parentId: payload.parentId ?? null,
      description: normalizeString(payload.description),
      thumbnailUrl: normalizeString(payload.thumbnailUrl),
      createdAt: this.parseIsoDate(payload.createdAt, 'payload.createdAt'),
      updatedAt: this.parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: 1,
    };
  }

  private buildSeriesUpdateData(
    payload: SyncSeriesPayloadDto,
  ): Prisma.UserSeriesUncheckedUpdateInput {
    return {
      title: payload.title.trim(),
      normalizedTitle: normalizeString(payload.normalizedTitle),
      aliases: payload.aliases.map(normalizeString).filter(Boolean),
      kind: payload.kind as SeriesKind,
      parentId: payload.parentId ?? null,
      description: normalizeString(payload.description),
      thumbnailUrl: normalizeString(payload.thumbnailUrl),
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: { increment: 1 },
    };
  }

  private buildContributorCreateData(
    userId: string,
    payload: SyncContributorPayloadDto,
  ): Prisma.UserContributorUncheckedCreateInput {
    return {
      id: payload.id,
      userId,
      name: payload.name.trim(),
      normalizedName: normalizeString(payload.normalizedName),
      aliases: payload.aliases.map(normalizeString).filter(Boolean),
      entityType: payload.entityType as ContributorEntityType,
      createdAt: this.parseIsoDate(payload.createdAt, 'payload.createdAt'),
      updatedAt: this.parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: 1,
    };
  }

  private buildContributorUpdateData(
    payload: SyncContributorPayloadDto,
  ): Prisma.UserContributorUncheckedUpdateInput {
    return {
      name: payload.name.trim(),
      normalizedName: normalizeString(payload.normalizedName),
      aliases: payload.aliases.map(normalizeString).filter(Boolean),
      entityType: payload.entityType as ContributorEntityType,
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: { increment: 1 },
    };
  }

  private buildWorkSeriesLinkCreateData(
    payload: SyncWorkSeriesLinkPayloadDto,
  ): Prisma.UserWorkSeriesLinkUncheckedCreateInput {
    return {
      id: payload.id,
      userWorkId: payload.workId,
      userSeriesId: payload.seriesId,
      role: payload.role as WorkSeriesRole,
      orderIndex: payload.orderIndex ?? null,
      orderLabel: normalizeString(payload.orderLabel),
      createdAt: this.parseIsoDate(payload.createdAt, 'payload.createdAt'),
      updatedAt: this.parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: 1,
    };
  }

  private buildWorkSeriesLinkUpdateData(
    payload: SyncWorkSeriesLinkPayloadDto,
  ): Prisma.UserWorkSeriesLinkUncheckedUpdateInput {
    return {
      role: payload.role as WorkSeriesRole,
      orderIndex: payload.orderIndex ?? null,
      orderLabel: normalizeString(payload.orderLabel),
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: { increment: 1 },
    };
  }

  private buildWorkContributorCreateData(
    payload: SyncWorkContributorPayloadDto,
  ): Prisma.UserWorkContributorUncheckedCreateInput {
    return {
      id: payload.id,
      userWorkId: payload.workId,
      userContributorId: payload.contributorId,
      role: payload.role as WorkContributorRole,
      displayOrder: payload.displayOrder,
      createdAt: this.parseIsoDate(payload.createdAt, 'payload.createdAt'),
      updatedAt: this.parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: 1,
    };
  }

  private buildWorkContributorUpdateData(
    payload: SyncWorkContributorPayloadDto,
  ): Prisma.UserWorkContributorUncheckedUpdateInput {
    return {
      role: payload.role as WorkContributorRole,
      displayOrder: payload.displayOrder,
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: { increment: 1 },
    };
  }

  private buildWorkRelationCreateData(
    userId: string,
    payload: SyncWorkRelationPayloadDto,
  ): Prisma.UserWorkRelationUncheckedCreateInput {
    return {
      id: payload.id,
      userId,
      sourceWorkId: payload.sourceWorkId,
      targetWorkId: payload.targetWorkId,
      relationType: payload.relationType as WorkRelationType,
      note: normalizeString(payload.note),
      createdAt: this.parseIsoDate(payload.createdAt, 'payload.createdAt'),
      updatedAt: this.parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: 1,
    };
  }

  private buildWorkRelationUpdateData(
    payload: SyncWorkRelationPayloadDto,
  ): Prisma.UserWorkRelationUncheckedUpdateInput {
    return {
      relationType: payload.relationType as WorkRelationType,
      note: normalizeString(payload.note),
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: { increment: 1 },
    };
  }

  private buildCatalogCreateData(
    payload: SyncWorkPayloadDto,
  ): Prisma.CatalogWorkUncheckedCreateInput {
    return {
      id: payload.id,
      type: payload.type as WorkType,
      title: payload.title.trim(),
      author: normalizeString(payload.author),
      genres: normalizeGenres(payload.genres),
      description: normalizeString(payload.description),
      thumbnailUrl: normalizeString(payload.thumbnailUrl),
      createdAt: this.parseIsoDate(payload.createdAt, 'payload.createdAt'),
      updatedAt: this.parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
    };
  }

  private async applyTierBoardChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncTierBoardPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const existing = await client.userTierBoard.findUnique({
      where: { id: change.entityId },
    });

    if (payload.deletedAt !== null && !existing) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: change.entityType,
        status: 'applied',
        code: SYNC_CODES.missingRemoteDeleteNoop,
        message: MISSING_REMOTE_DELETE_NOOP_MESSAGE,
        tierBoard: null,
      };
    }

    if (existing && existing.userId !== userId) {
      return this.buildTierBoardOwnershipConflict(change);
    }

    if (existing && existing.serverVersion > payload.serverVersion) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: change.entityType,
        status: 'conflict',
        code: SYNC_CODES.conflictRemoteNewer,
        message: 'Remote tier board is newer than the queued change.',
        tierBoard: this.toPushSyncTierBoardPayload(existing),
      };
    }

    const record = existing
      ? await client.userTierBoard.update({
          where: { id: change.entityId },
          data: {
            title: normalizeString(payload.title) || payload.id,
            description: normalizeString(payload.description),
            slug: normalizeString(payload.slug) || payload.id,
            boardType: payload.boardType,
            visibility: payload.visibility,
            coverImageUrl: normalizeString(payload.coverImageUrl),
            deletedAt: this.parseOptionalIsoDate(
              payload.deletedAt,
              'payload.deletedAt',
            ),
            syncStatus: SERVER_SYNC_STATUS,
            serverVersion: { increment: 1 },
          },
        })
      : await client.userTierBoard.create({
          data: {
            id: payload.id,
            userId,
            slug: normalizeString(payload.slug) || payload.id,
            title: normalizeString(payload.title) || payload.id,
            description: normalizeString(payload.description),
            boardType: payload.boardType,
            visibility: payload.visibility,
            coverImageUrl: normalizeString(payload.coverImageUrl),
            createdAt: this.parseIsoDate(
              payload.createdAt,
              'payload.createdAt',
            ),
            updatedAt: this.parseIsoDate(
              payload.updatedAt,
              'payload.updatedAt',
            ),
            deletedAt: this.parseOptionalIsoDate(
              payload.deletedAt,
              'payload.deletedAt',
            ),
            syncStatus: SERVER_SYNC_STATUS,
            serverVersion: 1,
          },
        });

    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: 'applied',
      code: existing ? SYNC_CODES.appliedChange : SYNC_CODES.created,
      message: existing ? APPLIED_CHANGE_MESSAGE : CREATED_MESSAGE,
      tierBoard: this.toPushSyncTierBoardPayload(record),
    };
  }

  private async applyTierLaneChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncTierLanePayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const board = await client.userTierBoard.findUnique({
      where: { id: payload.boardId },
    });

    if (!board || board.userId !== userId || board.deletedAt !== null) {
      return this.buildTierBoardParentConflict(change, 'tierLane');
    }

    const existing = await client.userTierLane.findUnique({
      where: { id: change.entityId },
      include: { board: true },
    });

    if (payload.deletedAt !== null && !existing) {
      return this.buildTierBoardDeleteNoop(change, 'tierLane');
    }

    if (existing && existing.board.userId !== userId) {
      return this.buildTierBoardOwnershipConflict(change);
    }

    const record = existing
      ? await client.userTierLane.update({
          where: { id: change.entityId },
          data: {
            title: normalizeString(payload.title) || payload.id,
            description: normalizeString(payload.description),
            colorToken: normalizeString(payload.colorToken) || '#64748b',
            orderIndex: payload.orderIndex,
            deletedAt: this.parseOptionalIsoDate(
              payload.deletedAt,
              'payload.deletedAt',
            ),
            syncStatus: SERVER_SYNC_STATUS,
            serverVersion: { increment: 1 },
          },
        })
      : await client.userTierLane.create({
          data: {
            id: payload.id,
            boardId: payload.boardId,
            title: normalizeString(payload.title) || payload.id,
            description: normalizeString(payload.description),
            colorToken: normalizeString(payload.colorToken) || '#64748b',
            orderIndex: payload.orderIndex,
            createdAt: this.parseIsoDate(
              payload.createdAt,
              'payload.createdAt',
            ),
            updatedAt: this.parseIsoDate(
              payload.updatedAt,
              'payload.updatedAt',
            ),
            deletedAt: this.parseOptionalIsoDate(
              payload.deletedAt,
              'payload.deletedAt',
            ),
            syncStatus: SERVER_SYNC_STATUS,
            serverVersion: 1,
          },
        });

    return this.buildTierBoardAppliedResult(change, 'tierLane', {
      tierLane: this.toPushSyncTierLanePayload(record),
      code: existing ? SYNC_CODES.appliedChange : SYNC_CODES.created,
      message: existing ? APPLIED_CHANGE_MESSAGE : CREATED_MESSAGE,
    });
  }

  private async applyTierBoardCardChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncTierBoardCardPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const validationError = await this.validateTierBoardCardParents(
      userId,
      payload,
      client,
    );
    if (validationError) {
      return this.buildTierBoardParentConflict(
        change,
        'tierBoardCard',
        validationError,
      );
    }

    const existing = await client.userTierBoardCard.findUnique({
      where: { id: change.entityId },
      include: { board: true },
    });

    if (payload.deletedAt !== null && !existing) {
      return this.buildTierBoardDeleteNoop(change, 'tierBoardCard');
    }

    if (existing && existing.board.userId !== userId) {
      return this.buildTierBoardOwnershipConflict(change);
    }

    const data = {
      cardSourceType: payload.cardSourceType,
      title: normalizeString(payload.title) || payload.id,
      subtitle: normalizeString(payload.subtitle),
      imageUrl: normalizeString(payload.imageUrl),
      note: normalizeString(payload.note),
      laneId: payload.laneId,
      userWorkId: payload.workId,
      orderIndex: payload.orderIndex,
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
    };
    const record = existing
      ? await client.userTierBoardCard.update({
          where: { id: change.entityId },
          data: { ...data, serverVersion: { increment: 1 } },
        })
      : await client.userTierBoardCard.create({
          data: {
            ...data,
            id: payload.id,
            boardId: payload.boardId,
            createdAt: this.parseIsoDate(
              payload.createdAt,
              'payload.createdAt',
            ),
            updatedAt: this.parseIsoDate(
              payload.updatedAt,
              'payload.updatedAt',
            ),
            serverVersion: 1,
          },
        });

    return this.buildTierBoardAppliedResult(change, 'tierBoardCard', {
      tierBoardCard: this.toPushSyncTierBoardCardPayload(record),
      code: existing ? SYNC_CODES.appliedChange : SYNC_CODES.created,
      message: existing ? APPLIED_CHANGE_MESSAGE : CREATED_MESSAGE,
    });
  }

  private async applyTierBoardAssetChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncTierBoardAssetPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const validationError = await this.validateTierBoardAssetParents(
      userId,
      payload,
      client,
    );
    if (validationError) {
      return this.buildTierBoardParentConflict(
        change,
        'tierBoardAsset',
        validationError,
      );
    }

    const existing = await client.userTierBoardAsset.findUnique({
      where: { id: change.entityId },
      include: { board: true },
    });

    if (payload.deletedAt !== null && !existing) {
      return this.buildTierBoardDeleteNoop(change, 'tierBoardAsset');
    }

    if (existing && existing.board.userId !== userId) {
      return this.buildTierBoardOwnershipConflict(change);
    }

    const data = {
      kind: payload.kind,
      storageType: payload.storageType,
      objectUrl: normalizeString(payload.objectUrl),
      originalName: normalizeString(payload.originalName),
      mimeType: normalizeString(payload.mimeType),
      sizeBytes: payload.sizeBytes,
      cardId: payload.cardId,
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
    };
    const record = existing
      ? await client.userTierBoardAsset.update({
          where: { id: change.entityId },
          data,
        })
      : await client.userTierBoardAsset.create({
          data: {
            ...data,
            id: payload.id,
            boardId: payload.boardId,
            createdAt: this.parseIsoDate(
              payload.createdAt,
              'payload.createdAt',
            ),
            updatedAt: this.parseIsoDate(
              payload.updatedAt,
              'payload.updatedAt',
            ),
          },
        });

    return this.buildTierBoardAppliedResult(change, 'tierBoardAsset', {
      tierBoardAsset: this.toPushSyncTierBoardAssetPayload(record),
      code: existing ? SYNC_CODES.appliedChange : SYNC_CODES.created,
      message: existing ? APPLIED_CHANGE_MESSAGE : CREATED_MESSAGE,
    });
  }

  private buildTierBoardOwnershipConflict(
    change: PushSyncChangeDto,
  ): PushSyncResultDto {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: 'conflict',
      code: SYNC_CODES.conflictOwnershipMismatch,
      message:
        'Server mismatch: the tier board entity belongs to another user.',
    };
  }

  private buildTierBoardParentConflict(
    change: PushSyncChangeDto,
    key: 'tierBoardAsset' | 'tierBoardCard' | 'tierLane',
    message = 'Parent tier board entity is missing or belongs to another user.',
  ): PushSyncResultDto {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: 'conflict',
      code: SYNC_CODES.conflictParentChanged,
      message,
      [key]: null,
    } as PushSyncResultDto;
  }

  private buildTierBoardDeleteNoop(
    change: PushSyncChangeDto,
    key: 'tierBoardAsset' | 'tierBoardCard' | 'tierLane',
  ): PushSyncResultDto {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: 'applied',
      code: SYNC_CODES.missingRemoteDeleteNoop,
      message: MISSING_REMOTE_DELETE_NOOP_MESSAGE,
      [key]: null,
    } as PushSyncResultDto;
  }

  private buildTierBoardAppliedResult(
    change: PushSyncChangeDto,
    _key: 'tierBoardAsset' | 'tierBoardCard' | 'tierLane',
    data: Partial<PushSyncResultDto>,
  ): PushSyncResultDto {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: 'applied',
      message: APPLIED_CHANGE_MESSAGE,
      ...data,
    } as PushSyncResultDto;
  }

  private async validateTierBoardCardParents(
    userId: string,
    payload: SyncTierBoardCardPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const board = await client.userTierBoard.findUnique({
      where: { id: payload.boardId },
    });

    if (!board || board.userId !== userId || board.deletedAt !== null) {
      return 'Parent tier board is missing or belongs to another user.';
    }

    if (payload.laneId) {
      const lane = await client.userTierLane.findUnique({
        where: { id: payload.laneId },
        include: { board: true },
      });

      if (
        !lane ||
        lane.boardId !== payload.boardId ||
        lane.board.userId !== userId ||
        lane.deletedAt !== null
      ) {
        return 'Parent tier board lane is missing or belongs to another user.';
      }
    }

    return null;
  }

  private async validateTierBoardAssetParents(
    userId: string,
    payload: SyncTierBoardAssetPayloadDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const board = await client.userTierBoard.findUnique({
      where: { id: payload.boardId },
    });

    if (!board || board.userId !== userId || board.deletedAt !== null) {
      return 'Parent tier board is missing or belongs to another user.';
    }

    if (payload.cardId) {
      const card = await client.userTierBoardCard.findUnique({
        where: { id: payload.cardId },
        include: { board: true },
      });

      if (
        !card ||
        card.boardId !== payload.boardId ||
        card.board.userId !== userId ||
        card.deletedAt !== null
      ) {
        return 'Parent tier board card is missing or belongs to another user.';
      }
    }

    return null;
  }

  private buildUserRecordCreateData(
    userId: string,
    payload: SyncWorkPayloadDto,
    catalogTitleId = payload.catalogTitleId ?? payload.id,
  ): Prisma.UserWorkRecordUncheckedCreateInput {
    return {
      id: payload.id,
      userId,
      // Split-only compatibility: keep catalogWorkId mapped 1:1 to payload.id.
      catalogWorkId: payload.id,
      catalogTitleId,
      status: payload.status as WorkStatus,
      rating: payload.rating ?? null,
      shortReview: normalizeString(payload.shortReview),
      review: normalizeString(payload.review),
      personalTags: this.normalizeWorkPayloadTaxonomy(payload).personalTags,
      favorite: payload.favorite,
      progressCurrent: payload.progressCurrent ?? null,
      progressTotal: payload.progressTotal ?? null,
      progressUnit: payload.progressUnit ?? null,
      lastConsumedLabel: payload.lastConsumedLabel?.trim() ?? null,
      ...(payload.startedAt !== undefined
        ? {
            startedAt: this.parseOptionalIsoDate(
              payload.startedAt,
              'payload.startedAt',
            ),
          }
        : {}),
      ...(payload.completedAt !== undefined
        ? {
            completedAt: this.parseOptionalIsoDate(
              payload.completedAt,
              'payload.completedAt',
            ),
          }
        : {}),
      ...(payload.droppedAt !== undefined
        ? {
            droppedAt: this.parseOptionalIsoDate(
              payload.droppedAt,
              'payload.droppedAt',
            ),
          }
        : {}),
      ...(payload.lastConsumedAt !== undefined
        ? {
            lastConsumedAt: this.parseOptionalIsoDate(
              payload.lastConsumedAt,
              'payload.lastConsumedAt',
            ),
          }
        : {}),
      createdAt: this.parseIsoDate(payload.createdAt, 'payload.createdAt'),
      updatedAt: this.parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: 1,
    };
  }

  private buildImportTitleCreateData(
    payload: SyncWorkPayloadDto,
    catalogTitle: string,
  ): CreateCatalogTitleInput {
    const importDraft = payload.importDraft!;

    return {
      canonicalTitle: catalogTitle,
      ...(importDraft.contributors && importDraft.contributors.length > 0
        ? {
            contributorNames: importDraft.contributors.map((contributor) =>
              contributor.name.trim(),
            ),
          }
        : {}),
      displayTitle: catalogTitle,
      ...(importDraft.externalRefs && importDraft.externalRefs.length > 0
        ? {
            externalRefs: importDraft.externalRefs.map((ref) =>
              this.buildCatalogExternalRefInput(ref),
            ),
          }
        : {}),
      franchiseName: importDraft.franchiseName?.trim() ?? null,
      mediumType: importDraft.mediumType as WorkType,
      ...(importDraft.releaseCandidates &&
      importDraft.releaseCandidates.length > 0
        ? {
            releaseCandidates: importDraft.releaseCandidates.map((release) =>
              this.buildCatalogReleaseCandidateInput(release),
            ),
          }
        : {}),
      releaseYear: importDraft.releaseYear ?? null,
      subType: importDraft.subType?.trim() ?? null,
      summary: normalizeString(payload.description),
      thumbnailUrl: normalizeString(payload.thumbnailUrl),
    };
  }

  private buildCompatibilityCatalogWorkCreateData(
    payload: SyncWorkPayloadDto,
    title?: SyncCreateTitleView,
  ): Prisma.CatalogWorkUncheckedCreateInput {
    const fallbackAuthor =
      title?.contributors
        .map((entry) => entry.contributor.displayName)
        .filter(Boolean)
        .slice(0, 3)
        .join(', ') ??
      payload.importDraft?.contributors
        ?.map((contributor) => contributor.name.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(', ') ??
      '';

    return {
      id: payload.id,
      type: (payload.type ?? title?.mediumType ?? WorkType.other) as WorkType,
      title:
        payload.title.trim() ||
        title?.displayTitle ||
        payload.importDraft?.catalogTitle?.trim() ||
        payload.id,
      author: normalizeString(payload.author) || fallbackAuthor,
      genres: normalizeGenres(payload.genres),
      description:
        normalizeString(payload.description) || normalizeString(title?.summary),
      thumbnailUrl:
        normalizeString(payload.thumbnailUrl) ||
        normalizeString(title?.thumbnailUrl),
      createdAt: this.parseIsoDate(payload.createdAt, 'payload.createdAt'),
      updatedAt: this.parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
    };
  }

  private resolveImportDraftCatalogTitle(payload: SyncWorkPayloadDto) {
    const catalogTitle = payload.importDraft?.catalogTitle?.trim();

    if (catalogTitle) {
      return catalogTitle;
    }

    const fallbackTitle = payload.title.trim();

    return fallbackTitle || null;
  }

  private buildCatalogExternalRefInput(ref: {
    externalId: string;
    provider: string;
    rawType?: string | null;
    url?: string | null;
  }) {
    return {
      externalId: ref.externalId.trim(),
      provider: ref.provider.trim(),
      ...(ref.rawType?.trim() ? { rawType: ref.rawType.trim() } : {}),
      ...(ref.url?.trim() ? { url: ref.url.trim() } : {}),
    };
  }

  private buildCatalogReleaseCandidateInput(release: {
    displayLabel?: string | null;
    externalRefs?: Array<{
      externalId: string;
      provider: string;
      rawType?: string | null;
      url?: string | null;
    }> | null;
    isbn?: string | null;
    releaseDate?: string | Date | null;
    releaseType?: string | null;
    sequence?: number | null;
    thumbnailUrl?: string | null;
    title?: string | null;
  }) {
    return {
      ...(release.displayLabel?.trim()
        ? { displayLabel: release.displayLabel.trim() }
        : {}),
      ...(release.externalRefs && release.externalRefs.length > 0
        ? {
            externalRefs: release.externalRefs.map((ref) =>
              this.buildCatalogExternalRefInput(ref),
            ),
          }
        : {}),
      isbn: release.isbn?.trim() ?? null,
      releaseDate: release.releaseDate ?? null,
      ...(release.releaseType?.trim()
        ? { releaseType: release.releaseType.trim() }
        : {}),
      sequence: release.sequence ?? null,
      ...(release.thumbnailUrl?.trim()
        ? { thumbnailUrl: release.thumbnailUrl.trim() }
        : {}),
      ...(release.title?.trim() ? { title: release.title.trim() } : {}),
    };
  }

  private findCatalogTitleForSyncCreate(id: string) {
    return this.prisma.catalogTitle.findUnique({
      where: {
        id,
      },
      include: SYNC_CREATE_TITLE_INCLUDE,
    });
  }

  private buildCatalogUpdateData(
    payload: SyncWorkPayloadDto,
  ): Prisma.CatalogWorkUpdateInput {
    return {
      type: payload.type as WorkType,
      title: payload.title.trim(),
      author: normalizeString(payload.author),
      genres: normalizeGenres(payload.genres),
      description: normalizeString(payload.description),
      thumbnailUrl: normalizeString(payload.thumbnailUrl),
    };
  }

  private normalizeWorkPayloadTaxonomy(payload: SyncWorkPayloadDto) {
    return normalizeGenresAndPersonalTags(payload.genres, payload.personalTags);
  }

  private buildUserRecordUpdateData(
    payload: SyncWorkPayloadDto,
  ): Prisma.UserWorkRecordUpdateInput {
    return {
      status: payload.status as WorkStatus,
      rating: payload.rating ?? null,
      shortReview: normalizeString(payload.shortReview),
      review: normalizeString(payload.review),
      personalTags: this.normalizeWorkPayloadTaxonomy(payload).personalTags,
      favorite: payload.favorite,
      progressCurrent: payload.progressCurrent ?? null,
      progressTotal: payload.progressTotal ?? null,
      progressUnit: payload.progressUnit ?? null,
      lastConsumedLabel: payload.lastConsumedLabel?.trim() ?? null,
      startedAt: this.parseOptionalIsoDate(
        payload.startedAt ?? null,
        'payload.startedAt',
      ),
      completedAt: this.parseOptionalIsoDate(
        payload.completedAt ?? null,
        'payload.completedAt',
      ),
      droppedAt: this.parseOptionalIsoDate(
        payload.droppedAt ?? null,
        'payload.droppedAt',
      ),
      lastConsumedAt: this.parseOptionalIsoDate(
        payload.lastConsumedAt ?? null,
        'payload.lastConsumedAt',
      ),
      deletedAt: this.parseOptionalIsoDate(
        payload.deletedAt,
        'payload.deletedAt',
      ),
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: {
        increment: 1,
      },
    };
  }

  private areEquivalent(existing: WorkAggregate, payload: SyncWorkPayloadDto) {
    const taxonomy = this.normalizeWorkPayloadTaxonomy(payload);

    return (
      (payload.catalogTitleId === undefined ||
        (payload.catalogTitleId ?? null) ===
          (existing.catalogTitleId ?? null)) &&
      existing.catalogWork.type === payload.type &&
      existing.catalogWork.title === payload.title.trim() &&
      existing.catalogWork.author === normalizeString(payload.author) &&
      JSON.stringify(existing.catalogWork.genres) ===
        JSON.stringify(taxonomy.genres) &&
      existing.catalogWork.description ===
        normalizeString(payload.description) &&
      existing.catalogWork.thumbnailUrl ===
        normalizeString(payload.thumbnailUrl) &&
      existing.status === payload.status &&
      existing.rating === (payload.rating ?? null) &&
      existing.shortReview === normalizeString(payload.shortReview) &&
      existing.review === normalizeString(payload.review) &&
      JSON.stringify(existing.personalTags) ===
        JSON.stringify(taxonomy.personalTags) &&
      existing.favorite === payload.favorite &&
      (existing.progressCurrent ?? null) ===
        (payload.progressCurrent ?? null) &&
      (existing.progressTotal ?? null) === (payload.progressTotal ?? null) &&
      (existing.progressUnit ?? null) === (payload.progressUnit ?? null) &&
      (existing.lastConsumedLabel ?? null) ===
        (payload.lastConsumedLabel?.trim() ?? null) &&
      (payload.startedAt === undefined ||
        (existing.startedAt?.toISOString() ?? null) ===
          (payload.startedAt ?? null)) &&
      (payload.completedAt === undefined ||
        (existing.completedAt?.toISOString() ?? null) ===
          (payload.completedAt ?? null)) &&
      (payload.droppedAt === undefined ||
        (existing.droppedAt?.toISOString() ?? null) ===
          (payload.droppedAt ?? null)) &&
      (payload.lastConsumedAt === undefined ||
        (existing.lastConsumedAt?.toISOString() ?? null) ===
          (payload.lastConsumedAt ?? null)) &&
      existing.deletedAt?.toISOString() ===
        (payload.deletedAt === null ? undefined : payload.deletedAt)
    );
  }

  private areReleaseRecordsEquivalent(
    existing: UserReleaseRecordAggregate,
    payload: SyncReleaseRecordPayloadDto,
  ) {
    return (
      existing.userWorkRecordId === payload.userWorkRecordId &&
      existing.catalogReleaseId === payload.catalogReleaseId &&
      existing.status === payload.status &&
      existing.rating === (payload.rating ?? null) &&
      existing.shortReview === normalizeString(payload.shortReview) &&
      existing.review === normalizeString(payload.review) &&
      existing.favorite === payload.favorite &&
      existing.deletedAt?.toISOString() ===
        (payload.deletedAt === null ? undefined : payload.deletedAt)
    );
  }

  private areTimelineEntriesEquivalent(
    existing: UserTimelineEntryAggregate,
    payload: SyncTimelineEntryPayloadDto,
  ) {
    return (
      existing.userWorkRecordId === payload.workId &&
      existing.type === payload.type &&
      existing.occurredAt.toISOString() === payload.occurredAt &&
      existing.note === normalizeString(payload.note) &&
      existing.deletedAt?.toISOString() ===
        (payload.deletedAt === null ? undefined : payload.deletedAt)
    );
  }

  private areSeriesEquivalent(
    existing: UserSeriesSyncView,
    payload: SyncSeriesPayloadDto,
  ) {
    return (
      existing.title === payload.title.trim() &&
      existing.normalizedTitle === normalizeString(payload.normalizedTitle) &&
      JSON.stringify(existing.aliases) ===
        JSON.stringify(payload.aliases.map(normalizeString).filter(Boolean)) &&
      existing.kind === payload.kind &&
      (existing.parentId ?? null) === (payload.parentId ?? null) &&
      existing.description === normalizeString(payload.description) &&
      existing.thumbnailUrl === normalizeString(payload.thumbnailUrl) &&
      existing.deletedAt?.toISOString() ===
        (payload.deletedAt === null ? undefined : payload.deletedAt)
    );
  }

  private areContributorsEquivalent(
    existing: UserContributorSyncView,
    payload: SyncContributorPayloadDto,
  ) {
    return (
      existing.name === payload.name.trim() &&
      existing.normalizedName === normalizeString(payload.normalizedName) &&
      JSON.stringify(existing.aliases) ===
        JSON.stringify(payload.aliases.map(normalizeString).filter(Boolean)) &&
      existing.entityType === payload.entityType &&
      existing.deletedAt?.toISOString() ===
        (payload.deletedAt === null ? undefined : payload.deletedAt)
    );
  }

  private areWorkSeriesLinksEquivalent(
    existing: UserWorkSeriesLinkSyncView,
    payload: SyncWorkSeriesLinkPayloadDto,
  ) {
    return (
      existing.userWorkId === payload.workId &&
      existing.userSeriesId === payload.seriesId &&
      existing.role === payload.role &&
      (existing.orderIndex ?? null) === (payload.orderIndex ?? null) &&
      existing.orderLabel === normalizeString(payload.orderLabel) &&
      existing.deletedAt?.toISOString() ===
        (payload.deletedAt === null ? undefined : payload.deletedAt)
    );
  }

  private areWorkContributorsEquivalent(
    existing: UserWorkContributorSyncView,
    payload: SyncWorkContributorPayloadDto,
  ) {
    return (
      existing.userWorkId === payload.workId &&
      existing.userContributorId === payload.contributorId &&
      existing.role === payload.role &&
      existing.displayOrder === payload.displayOrder &&
      existing.deletedAt?.toISOString() ===
        (payload.deletedAt === null ? undefined : payload.deletedAt)
    );
  }

  private areWorkRelationsEquivalent(
    existing: UserWorkRelationSyncView,
    payload: SyncWorkRelationPayloadDto,
  ) {
    return (
      existing.sourceWorkId === payload.sourceWorkId &&
      existing.targetWorkId === payload.targetWorkId &&
      existing.relationType === payload.relationType &&
      existing.note === normalizeString(payload.note) &&
      existing.deletedAt?.toISOString() ===
        (payload.deletedAt === null ? undefined : payload.deletedAt)
    );
  }

  private toPushSyncSeriesPayload(
    series: UserSeriesSyncView,
  ): SyncSeriesPayloadDto {
    return {
      id: series.id,
      title: series.title,
      normalizedTitle: series.normalizedTitle,
      aliases: series.aliases,
      kind: series.kind,
      parentId: series.parentId ?? null,
      description: series.description,
      thumbnailUrl: series.thumbnailUrl,
      createdAt: series.createdAt.toISOString(),
      updatedAt: series.updatedAt.toISOString(),
      deletedAt: series.deletedAt?.toISOString() ?? null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: series.serverVersion,
    };
  }

  private toPushSyncContributorPayload(
    contributor: UserContributorSyncView,
  ): SyncContributorPayloadDto {
    return {
      id: contributor.id,
      name: contributor.name,
      normalizedName: contributor.normalizedName,
      aliases: contributor.aliases,
      entityType: contributor.entityType,
      createdAt: contributor.createdAt.toISOString(),
      updatedAt: contributor.updatedAt.toISOString(),
      deletedAt: contributor.deletedAt?.toISOString() ?? null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: contributor.serverVersion,
    };
  }

  private toPushSyncWorkSeriesLinkPayload(
    link: UserWorkSeriesLinkSyncView,
  ): SyncWorkSeriesLinkPayloadDto {
    return {
      id: link.id,
      workId: link.userWorkId,
      seriesId: link.userSeriesId,
      role: link.role,
      orderIndex: link.orderIndex ?? null,
      orderLabel: link.orderLabel,
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
      deletedAt: link.deletedAt?.toISOString() ?? null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: link.serverVersion,
    };
  }

  private toPushSyncWorkContributorPayload(
    link: UserWorkContributorSyncView,
  ): SyncWorkContributorPayloadDto {
    return {
      id: link.id,
      workId: link.userWorkId,
      contributorId: link.userContributorId,
      role: link.role,
      displayOrder: link.displayOrder,
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
      deletedAt: link.deletedAt?.toISOString() ?? null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: link.serverVersion,
    };
  }

  private toPushSyncWorkRelationPayload(
    relation: UserWorkRelationSyncView,
  ): SyncWorkRelationPayloadDto {
    return {
      id: relation.id,
      sourceWorkId: relation.sourceWorkId,
      targetWorkId: relation.targetWorkId,
      relationType: relation.relationType,
      note: relation.note,
      createdAt: relation.createdAt.toISOString(),
      updatedAt: relation.updatedAt.toISOString(),
      deletedAt: relation.deletedAt?.toISOString() ?? null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: relation.serverVersion,
    };
  }

  private toPushSyncTierBoardPayload(board: {
    id: string;
    slug: string;
    title: string;
    description: string;
    boardType: string;
    visibility: string;
    coverImageUrl: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    serverVersion: number;
  }): SyncTierBoardPayloadDto {
    return {
      id: board.id,
      title: board.title,
      description: board.description,
      slug: board.slug,
      boardType: board.boardType as SyncTierBoardPayloadDto['boardType'],
      visibility: board.visibility as SyncTierBoardPayloadDto['visibility'],
      coverImageUrl: board.coverImageUrl,
      createdAt: board.createdAt.toISOString(),
      updatedAt: board.updatedAt.toISOString(),
      deletedAt: board.deletedAt?.toISOString() ?? null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: board.serverVersion,
    };
  }

  private toPushSyncTierLanePayload(lane: {
    id: string;
    boardId: string;
    title: string;
    description: string;
    colorToken: string;
    orderIndex: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    serverVersion: number;
  }): SyncTierLanePayloadDto {
    return {
      id: lane.id,
      boardId: lane.boardId,
      title: lane.title,
      description: lane.description,
      colorToken: lane.colorToken,
      orderIndex: lane.orderIndex,
      createdAt: lane.createdAt.toISOString(),
      updatedAt: lane.updatedAt.toISOString(),
      deletedAt: lane.deletedAt?.toISOString() ?? null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: lane.serverVersion,
    };
  }

  private toPushSyncTierBoardCardPayload(card: {
    id: string;
    boardId: string;
    laneId: string | null;
    cardSourceType: string;
    title: string;
    subtitle: string;
    imageUrl: string;
    note: string;
    userWorkId: string | null;
    orderIndex: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    serverVersion: number;
  }): SyncTierBoardCardPayloadDto {
    return {
      id: card.id,
      boardId: card.boardId,
      laneId: card.laneId,
      cardSourceType:
        card.cardSourceType as SyncTierBoardCardPayloadDto['cardSourceType'],
      title: card.title,
      subtitle: card.subtitle,
      imageUrl: card.imageUrl,
      note: card.note,
      workId: card.userWorkId,
      orderIndex: card.orderIndex,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
      deletedAt: card.deletedAt?.toISOString() ?? null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: card.serverVersion,
    };
  }

  private toPushSyncTierBoardAssetPayload(asset: {
    id: string;
    boardId: string;
    cardId: string | null;
    kind: string;
    storageType: string;
    objectUrl: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): SyncTierBoardAssetPayloadDto {
    return {
      id: asset.id,
      boardId: asset.boardId,
      cardId: asset.cardId,
      kind: asset.kind as SyncTierBoardAssetPayloadDto['kind'],
      storageType:
        asset.storageType as SyncTierBoardAssetPayloadDto['storageType'],
      objectUrl: asset.objectUrl,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
      deletedAt: asset.deletedAt?.toISOString() ?? null,
    };
  }

  private parseIsoDate(value: string, fieldName: string) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        `${fieldName} must be a valid ISO 8601 date string.`,
      );
    }

    return parsed;
  }

  private parseOptionalIsoDate(value: string | null, fieldName: string) {
    if (value === null) {
      return null;
    }

    return this.parseIsoDate(value, fieldName);
  }

  private sortChangesByCreatedAt(changes: PushSyncChangeDto[]) {
    return changes
      .map((change, index) => ({
        change,
        index,
        timestamp: Date.parse(change.createdAt),
      }))
      .sort((left, right) => {
        const timestampDelta = left.timestamp - right.timestamp;

        if (timestampDelta !== 0) {
          return timestampDelta;
        }

        return left.index - right.index;
      })
      .map(({ change }) => change);
  }

  private logPushSummary(
    userId: string,
    requestedCount: number,
    response: PushSyncResponseDto,
  ) {
    const appliedCount = response.results.filter(
      (result) => result.status === 'applied',
    ).length;
    const conflictCount = response.results.filter(
      (result) => result.status === 'conflict',
    ).length;
    const failedCount = response.results.filter(
      (result) => result.status === 'failed',
    ).length;

    this.logger.log(
      `Sync push summary userId=${userId} requested=${requestedCount} applied=${appliedCount} conflict=${conflictCount} failed=${failedCount}`,
    );
  }

  private describeError(error: unknown) {
    if (error instanceof Error) {
      return error.name;
    }

    return 'UnknownError';
  }
}
