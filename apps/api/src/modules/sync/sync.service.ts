import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
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
  WorkTier,
} from '@prisma/client';

import { CatalogService } from '../catalog/catalog.service';
import type { CreateCatalogTitleInput } from '../catalog/catalog-ingestion.service';
import {
  canCreateReleaseRecord,
  canUseProgressUnit,
} from '../recording/recording-policy';
import {
  toUserReleaseRecordResponse,
  UserReleaseRecordsService,
  type UserReleaseRecordAggregate,
} from '../user-records/user-release-records.service';
import {
  UserRecordsService,
  type WorkAggregate,
} from '../user-records/user-records.service';
import {
  toUserTimelineEntryResponse,
  UserTimelineEntriesService,
  type UserTimelineEntryAggregate,
} from '../user-records/user-timeline-entries.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  normalizeGenres,
  normalizePersonalTags,
  normalizeString,
  toFlatWorkResponse,
} from '../works/work-aggregate';
import type { PullSyncDto } from './dto/pull-sync.dto';
import type {
  PullSyncChangeDto,
  PullSyncResponseDto,
} from './dto/pull-sync-response.dto';
import type { PushSyncChangeDto, PushSyncDto } from './dto/push-sync.dto';
import type {
  PushSyncResponseDto,
  PushSyncResultDto,
} from './dto/push-sync-response.dto';
import type { SyncContributorPayloadDto } from './dto/sync-contributor-payload.dto';
import type { SyncReleaseRecordPayloadDto } from './dto/sync-release-record-payload.dto';
import type { SyncSeriesPayloadDto } from './dto/sync-series-payload.dto';
import type { SyncTimelineEntryPayloadDto } from './dto/sync-timeline-entry-payload.dto';
import type { SyncWorkContributorPayloadDto } from './dto/sync-work-contributor-payload.dto';
import type { SyncWorkPayloadDto } from './dto/sync-work-payload.dto';
import type { SyncWorkRelationPayloadDto } from './dto/sync-work-relation-payload.dto';
import type { SyncWorkSeriesLinkPayloadDto } from './dto/sync-work-series-link-payload.dto';
import {
  SYNC_ENTITY_TYPES,
  SYNC_SCHEMA_VERSION,
  type SyncEntityType,
} from './sync.constants';

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

interface PullCursor {
  entityId: string;
  entityType: SyncEntityType;
  updatedAt: string;
}

interface OrderedPullChange {
  change: PullSyncChangeDto;
  cursor: PullCursor;
  updatedAtMs: number;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogService) private readonly catalogService: CatalogService,
    @Inject(UserRecordsService)
    private readonly userRecordsService: UserRecordsService,
    @Inject(UserReleaseRecordsService)
    private readonly releaseRecordsService: UserReleaseRecordsService,
    @Inject(UserTimelineEntriesService)
    private readonly timelineEntriesService: UserTimelineEntriesService,
  ) {}

  async push(
    userId: string,
    pushSyncDto: PushSyncDto,
  ): Promise<PushSyncResponseDto> {
    this.assertSupportedSchemaVersion(pushSyncDto);

    const { changes } = pushSyncDto;
    const sortedChanges = this.sortChangesByCreatedAt(changes);
    const results: PushSyncResultDto[] = [];

    try {
      for (const change of sortedChanges) {
        results.push(await this.applyChange(userId, change));
      }

      const response = {
        processedAt: new Date().toISOString(),
        results,
        schemaVersion: SYNC_SCHEMA_VERSION,
      };

      this.logPushSummary(userId, changes.length, response);

      return response;
    } catch (error) {
      this.logger.warn(
        `Sync push failed userId=${userId} requested=${changes.length} reason=${this.describeError(error)}`,
      );
      throw error;
    }
  }

  async pull(
    userId: string,
    pullSyncDto: PullSyncDto,
  ): Promise<PullSyncResponseDto> {
    this.assertSupportedSchemaVersion(pullSyncDto);

    const { since } = pullSyncDto;
    try {
      const parsedSince =
        since === undefined || since === null
          ? null
          : this.parseIsoDate(since, 'since');
      const parsedCursor = this.parsePullCursor(pullSyncDto.cursor ?? null);
      const works = await this.userRecordsService.findByUserSince(
        userId,
        parsedSince,
      );
      const releaseRecords = await this.releaseRecordsService.findByUserSince(
        userId,
        parsedSince,
      );
      const timelineEntries = await this.timelineEntriesService.findByUserSince(
        userId,
        parsedSince,
      );
      const graphRecords = await this.findGraphRecordsByUserSince(
        userId,
        parsedSince,
      );
      const pulledAt = new Date().toISOString();
      const orderedChanges = this.buildOrderedPullChanges({
        ...graphRecords,
        releaseRecords,
        timelineEntries,
        works,
      }).filter((entry) => this.isAfterPullCursor(entry.cursor, parsedCursor));
      const pageLimit = pullSyncDto.limit ?? null;
      const pagedChanges =
        pageLimit === null ? orderedChanges : orderedChanges.slice(0, pageLimit);
      const hasMore =
        pageLimit !== null && orderedChanges.length > pagedChanges.length;
      const lastPagedChange = pagedChanges.at(-1) ?? null;
      const changes = pagedChanges.map((entry) => entry.change);
      const changedRecords = [
        ...works,
        ...releaseRecords,
        ...timelineEntries,
        ...graphRecords.series,
        ...graphRecords.contributors,
        ...graphRecords.workSeriesLinks,
        ...graphRecords.workContributors,
        ...graphRecords.workRelations,
      ].sort(
        (left, right) => left.updatedAt.getTime() - right.updatedAt.getTime(),
      );
      const response: PullSyncResponseDto = {
        schemaVersion: SYNC_SCHEMA_VERSION,
        pulledAt,
        nextSince: hasMore
          ? (since ?? pulledAt)
          : this.buildNextSince(since ?? null, pulledAt, changedRecords),
        nextCursor:
          hasMore && lastPagedChange
            ? this.encodePullCursor(lastPagedChange.cursor)
            : null,
        hasMore,
        changes,
      };

      this.logPullSummary(userId, since ?? null, response);

      return response;
    } catch (error) {
      this.logger.warn(
        `Sync pull failed userId=${userId} since=${since ?? 'null'} reason=${this.describeError(error)}`,
      );
      throw error;
    }
  }

  private async applyChange(
    userId: string,
    change: PushSyncChangeDto,
  ): Promise<PushSyncResultDto> {
    if (change.entityType === 'series') {
      return this.applySeriesChange(
        userId,
        change,
        change.payload as SyncSeriesPayloadDto,
      );
    }

    if (change.entityType === 'contributor') {
      return this.applyContributorChange(
        userId,
        change,
        change.payload as SyncContributorPayloadDto,
      );
    }

    if (change.entityType === 'work_series_link') {
      return this.applyWorkSeriesLinkChange(
        userId,
        change,
        change.payload as SyncWorkSeriesLinkPayloadDto,
      );
    }

    if (change.entityType === 'work_contributor') {
      return this.applyWorkContributorChange(
        userId,
        change,
        change.payload as SyncWorkContributorPayloadDto,
      );
    }

    if (change.entityType === 'work_relation') {
      return this.applyWorkRelationChange(
        userId,
        change,
        change.payload as SyncWorkRelationPayloadDto,
      );
    }

    if (change.entityType === 'timeline_entry') {
      return this.applyTimelineEntryChange(
        userId,
        change,
        change.payload as SyncTimelineEntryPayloadDto,
      );
    }

    if (change.entityType === 'release_record') {
      return this.applyReleaseRecordChange(
        userId,
        change,
        change.payload as SyncReleaseRecordPayloadDto,
      );
    }

    const payload = change.payload as SyncWorkPayloadDto;
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
      return this.applyMissingRemoteChange(userId, change, payload);
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

    const updated = await this.prisma.$transaction(async (tx) => {
      // split-only 단계에서는 catalog 메타데이터도 해당 user record와 함께 동기화합니다.
      await this.catalogService.update(
        existing.catalogWorkId,
        this.buildCatalogUpdateData(payload),
        tx,
      );

      return this.userRecordsService.update(
        change.entityId,
        this.buildUserRecordUpdateData(payload),
        tx,
      );
    });

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

    const created = await this.prisma.$transaction(async (tx) => {
      if (existingTitle) {
        await tx.catalogWork.create({
          data: this.buildCompatibilityCatalogWorkCreateData(
            payload,
            existingTitle,
          ),
        });

        return this.userRecordsService.create(
          this.buildUserRecordCreateData(userId, payload, existingTitle.id),
          tx,
        );
      }

      if (payload.importDraft) {
        const title = await this.catalogService.createTitleFromImportCandidate(
          this.buildImportTitleCreateData(payload, importDraftCatalogTitle!),
          tx,
        );

        await tx.catalogWork.create({
          data: this.buildCompatibilityCatalogWorkCreateData(payload),
        });

        return this.userRecordsService.create(
          this.buildUserRecordCreateData(userId, payload, title.id),
          tx,
        );
      }

      await this.catalogService.create(
        this.buildCatalogCreateData(payload),
        tx,
      );

      return this.userRecordsService.create(
        this.buildUserRecordCreateData(userId, payload),
        tx,
      );
    });

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
  ): Promise<PushSyncResultDto> {
    const existing = await this.releaseRecordsService.findById(change.entityId);

    if (!existing) {
      return this.applyMissingRemoteReleaseRecordChange(
        userId,
        change,
        payload,
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

    const created = await this.prisma.userReleaseRecord.create({
      data: this.buildReleaseRecordCreateData(payload),
    });
    const hydrated = await this.releaseRecordsService.findById(created.id);

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
  ): Promise<PushSyncResultDto> {
    const existing = await this.timelineEntriesService.findById(
      change.entityId,
    );

    if (!existing) {
      return this.applyMissingRemoteTimelineEntryChange(
        userId,
        change,
        payload,
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
  ): Promise<PushSyncResultDto> {
    const existing = await this.prisma.userSeries.findUnique({
      where: { id: change.entityId },
    });

    if (!existing) {
      return this.applyMissingRemoteSeriesChange(userId, change, payload);
    }

    if (existing.userId !== userId) {
      return this.buildGraphOwnershipConflict(change, 'series');
    }

    const validationError = await this.validateSeriesParent(userId, payload);
    if (validationError) {
      return this.buildGraphValidationFailure(change, 'series', validationError, {
        series: this.toSyncSeriesPayload(existing),
      });
    }

    if (
      existing.serverVersion > payload.serverVersion &&
      !this.areSeriesEquivalent(existing, payload)
    ) {
      return this.buildGraphRemoteNewerConflict(change, 'series', {
        series: this.toSyncSeriesPayload(existing),
      });
    }

    if (this.areSeriesEquivalent(existing, payload)) {
      return this.buildGraphAppliedResult(change, 'series', {
        code: SYNC_CODES.alreadyApplied,
        message: ALREADY_APPLIED_MESSAGE,
        series: this.toSyncSeriesPayload(existing),
      });
    }

    const updated = await this.prisma.userSeries.update({
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
      series: this.toSyncSeriesPayload(updated),
    });
  }

  private async applyMissingRemoteSeriesChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncSeriesPayloadDto,
  ): Promise<PushSyncResultDto> {
    const missingResult = this.getMissingRemoteGraphResult(change, payload);
    if (missingResult) return missingResult;

    const validationError = await this.validateSeriesParent(userId, payload);
    if (validationError) {
      return this.buildGraphValidationFailure(change, 'series', validationError, {
        series: null,
      });
    }

    const created = await this.prisma.userSeries.create({
      data: this.buildSeriesCreateData(userId, payload),
    });

    return this.buildGraphAppliedResult(change, 'series', {
      code: SYNC_CODES.created,
      message: CREATED_MESSAGE,
      series: this.toSyncSeriesPayload(created),
    });
  }

  private async applyContributorChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncContributorPayloadDto,
  ): Promise<PushSyncResultDto> {
    const existing = await this.prisma.userContributor.findUnique({
      where: { id: change.entityId },
    });

    if (!existing) {
      return this.applyMissingRemoteContributorChange(userId, change, payload);
    }

    if (existing.userId !== userId) {
      return this.buildGraphOwnershipConflict(change, 'contributor');
    }

    if (
      existing.serverVersion > payload.serverVersion &&
      !this.areContributorsEquivalent(existing, payload)
    ) {
      return this.buildGraphRemoteNewerConflict(change, 'contributor', {
        contributor: this.toSyncContributorPayload(existing),
      });
    }

    if (this.areContributorsEquivalent(existing, payload)) {
      return this.buildGraphAppliedResult(change, 'contributor', {
        code: SYNC_CODES.alreadyApplied,
        contributor: this.toSyncContributorPayload(existing),
        message: ALREADY_APPLIED_MESSAGE,
      });
    }

    const updated = await this.prisma.userContributor.update({
      where: { id: change.entityId },
      data: this.buildContributorUpdateData(payload),
    });

    return this.buildGraphAppliedResult(change, 'contributor', {
      code:
        payload.deletedAt === null
          ? SYNC_CODES.appliedChange
          : SYNC_CODES.appliedTombstone,
      contributor: this.toSyncContributorPayload(updated),
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
  ): Promise<PushSyncResultDto> {
    const missingResult = this.getMissingRemoteGraphResult(change, payload);
    if (missingResult) return missingResult;

    const created = await this.prisma.userContributor.create({
      data: this.buildContributorCreateData(userId, payload),
    });

    return this.buildGraphAppliedResult(change, 'contributor', {
      code: SYNC_CODES.created,
      contributor: this.toSyncContributorPayload(created),
      message: CREATED_MESSAGE,
    });
  }

  private async applyWorkSeriesLinkChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncWorkSeriesLinkPayloadDto,
  ): Promise<PushSyncResultDto> {
    const existing = await this.prisma.userWorkSeriesLink.findUnique({
      where: { id: change.entityId },
      include: USER_WORK_SERIES_LINK_INCLUDE,
    });

    if (!existing) {
      return this.applyMissingRemoteWorkSeriesLinkChange(userId, change, payload);
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
        workSeriesLink: this.toSyncWorkSeriesLinkPayload(existing),
      });
    }

    const validationError = await this.validateWorkSeriesLinkTarget(
      userId,
      payload,
    );
    if (validationError) {
      return this.buildGraphValidationFailure(
        change,
        'workSeriesLink',
        validationError,
        { workSeriesLink: this.toSyncWorkSeriesLinkPayload(existing) },
      );
    }

    if (
      existing.serverVersion > payload.serverVersion &&
      !this.areWorkSeriesLinksEquivalent(existing, payload)
    ) {
      return this.buildGraphRemoteNewerConflict(change, 'workSeriesLink', {
        workSeriesLink: this.toSyncWorkSeriesLinkPayload(existing),
      });
    }

    if (this.areWorkSeriesLinksEquivalent(existing, payload)) {
      return this.buildGraphAppliedResult(change, 'workSeriesLink', {
        code: SYNC_CODES.alreadyApplied,
        message: ALREADY_APPLIED_MESSAGE,
        workSeriesLink: this.toSyncWorkSeriesLinkPayload(existing),
      });
    }

    const updated = await this.prisma.userWorkSeriesLink.update({
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
      workSeriesLink: this.toSyncWorkSeriesLinkPayload(updated),
    });
  }

  private async applyMissingRemoteWorkSeriesLinkChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncWorkSeriesLinkPayloadDto,
  ): Promise<PushSyncResultDto> {
    const missingResult = this.getMissingRemoteGraphResult(change, payload);
    if (missingResult) return missingResult;

    const validationError = await this.validateWorkSeriesLinkTarget(
      userId,
      payload,
    );
    if (validationError) {
      return this.buildGraphValidationFailure(
        change,
        'workSeriesLink',
        validationError,
        { workSeriesLink: null },
      );
    }

    const created = await this.prisma.userWorkSeriesLink.create({
      data: this.buildWorkSeriesLinkCreateData(payload),
      include: USER_WORK_SERIES_LINK_INCLUDE,
    });

    return this.buildGraphAppliedResult(change, 'workSeriesLink', {
      code: SYNC_CODES.created,
      message: CREATED_MESSAGE,
      workSeriesLink: this.toSyncWorkSeriesLinkPayload(created),
    });
  }

  private async applyWorkContributorChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncWorkContributorPayloadDto,
  ): Promise<PushSyncResultDto> {
    const existing = await this.prisma.userWorkContributor.findUnique({
      where: { id: change.entityId },
      include: USER_WORK_CONTRIBUTOR_INCLUDE,
    });

    if (!existing) {
      return this.applyMissingRemoteWorkContributorChange(userId, change, payload);
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
        workContributor: this.toSyncWorkContributorPayload(existing),
      });
    }

    const validationError = await this.validateWorkContributorTarget(
      userId,
      payload,
    );
    if (validationError) {
      return this.buildGraphValidationFailure(
        change,
        'workContributor',
        validationError,
        { workContributor: this.toSyncWorkContributorPayload(existing) },
      );
    }

    if (
      existing.serverVersion > payload.serverVersion &&
      !this.areWorkContributorsEquivalent(existing, payload)
    ) {
      return this.buildGraphRemoteNewerConflict(change, 'workContributor', {
        workContributor: this.toSyncWorkContributorPayload(existing),
      });
    }

    if (this.areWorkContributorsEquivalent(existing, payload)) {
      return this.buildGraphAppliedResult(change, 'workContributor', {
        code: SYNC_CODES.alreadyApplied,
        message: ALREADY_APPLIED_MESSAGE,
        workContributor: this.toSyncWorkContributorPayload(existing),
      });
    }

    const updated = await this.prisma.userWorkContributor.update({
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
      workContributor: this.toSyncWorkContributorPayload(updated),
    });
  }

  private async applyMissingRemoteWorkContributorChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncWorkContributorPayloadDto,
  ): Promise<PushSyncResultDto> {
    const missingResult = this.getMissingRemoteGraphResult(change, payload);
    if (missingResult) return missingResult;

    const validationError = await this.validateWorkContributorTarget(
      userId,
      payload,
    );
    if (validationError) {
      return this.buildGraphValidationFailure(
        change,
        'workContributor',
        validationError,
        { workContributor: null },
      );
    }

    const created = await this.prisma.userWorkContributor.create({
      data: this.buildWorkContributorCreateData(payload),
      include: USER_WORK_CONTRIBUTOR_INCLUDE,
    });

    return this.buildGraphAppliedResult(change, 'workContributor', {
      code: SYNC_CODES.created,
      message: CREATED_MESSAGE,
      workContributor: this.toSyncWorkContributorPayload(created),
    });
  }

  private async applyWorkRelationChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncWorkRelationPayloadDto,
  ): Promise<PushSyncResultDto> {
    const existing = await this.prisma.userWorkRelation.findUnique({
      where: { id: change.entityId },
      include: USER_WORK_RELATION_INCLUDE,
    });

    if (!existing) {
      return this.applyMissingRemoteWorkRelationChange(userId, change, payload);
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
        workRelation: this.toSyncWorkRelationPayload(existing),
      });
    }

    const validationError = await this.validateWorkRelationTarget(
      userId,
      payload,
    );
    if (validationError) {
      return this.buildGraphValidationFailure(
        change,
        'workRelation',
        validationError,
        { workRelation: this.toSyncWorkRelationPayload(existing) },
      );
    }

    if (
      existing.serverVersion > payload.serverVersion &&
      !this.areWorkRelationsEquivalent(existing, payload)
    ) {
      return this.buildGraphRemoteNewerConflict(change, 'workRelation', {
        workRelation: this.toSyncWorkRelationPayload(existing),
      });
    }

    if (this.areWorkRelationsEquivalent(existing, payload)) {
      return this.buildGraphAppliedResult(change, 'workRelation', {
        code: SYNC_CODES.alreadyApplied,
        message: ALREADY_APPLIED_MESSAGE,
        workRelation: this.toSyncWorkRelationPayload(existing),
      });
    }

    const updated = await this.prisma.userWorkRelation.update({
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
      workRelation: this.toSyncWorkRelationPayload(updated),
    });
  }

  private async applyMissingRemoteWorkRelationChange(
    userId: string,
    change: PushSyncChangeDto,
    payload: SyncWorkRelationPayloadDto,
  ): Promise<PushSyncResultDto> {
    const missingResult = this.getMissingRemoteGraphResult(change, payload);
    if (missingResult) return missingResult;

    const validationError = await this.validateWorkRelationTarget(
      userId,
      payload,
    );
    if (validationError) {
      return this.buildGraphValidationFailure(
        change,
        'workRelation',
        validationError,
        { workRelation: null },
      );
    }

    const created = await this.prisma.userWorkRelation.create({
      data: this.buildWorkRelationCreateData(userId, payload),
      include: USER_WORK_RELATION_INCLUDE,
    });

    return this.buildGraphAppliedResult(change, 'workRelation', {
      code: SYNC_CODES.created,
      message: CREATED_MESSAGE,
      workRelation: this.toSyncWorkRelationPayload(created),
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

    const release = await this.prisma.catalogRelease.findFirst({
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
  ) {
    if (!payload.parentId) {
      return null;
    }

    if (payload.parentId === payload.id) {
      return 'Series parent cannot point to itself.';
    }

    const parent = await this.prisma.userSeries.findFirst({
      where: {
        id: payload.parentId,
        userId,
      },
    });

    return parent ? null : 'Series parent is missing or belongs to a different user.';
  }

  private async validateWorkSeriesLinkTarget(
    userId: string,
    payload: SyncWorkSeriesLinkPayloadDto,
  ) {
    const [work, series] = await Promise.all([
      this.userRecordsService.findById(payload.workId),
      this.prisma.userSeries.findFirst({
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
  ) {
    const [work, contributor] = await Promise.all([
      this.userRecordsService.findById(payload.workId),
      this.prisma.userContributor.findFirst({
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
    const isDelete = change.operation === 'delete' || payload.deletedAt !== null;
    const canCreate = change.operation === 'create' && payload.serverVersion === 0;

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

  private buildUserRecordCreateData(
    userId: string,
    payload: SyncWorkPayloadDto,
    catalogTitleId = payload.catalogTitleId ?? payload.id,
  ): Prisma.UserWorkRecordUncheckedCreateInput {
    return {
      id: payload.id,
      userId,
      // split-only 중간 단계: payload.id를 catalogWorkId로 사용해 1:1 매핑을 고정합니다.
      catalogWorkId: payload.id,
      catalogTitleId,
      status: payload.status as WorkStatus,
      rating: payload.rating ?? null,
      shortReview: normalizeString(payload.shortReview),
      review: normalizeString(payload.review),
      personalTags: normalizePersonalTags(payload.personalTags),
      tier: (payload.tier ?? null) as WorkTier | null,
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

  private buildUserRecordUpdateData(
    payload: SyncWorkPayloadDto,
  ): Prisma.UserWorkRecordUpdateInput {
    return {
      status: payload.status as WorkStatus,
      rating: payload.rating ?? null,
      shortReview: normalizeString(payload.shortReview),
      review: normalizeString(payload.review),
      personalTags: normalizePersonalTags(payload.personalTags),
      tier: (payload.tier ?? null) as WorkTier | null,
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
    return (
      (payload.catalogTitleId === undefined ||
        (payload.catalogTitleId ?? null) ===
          (existing.catalogTitleId ?? null)) &&
      existing.catalogWork.type === payload.type &&
      existing.catalogWork.title === payload.title.trim() &&
      existing.catalogWork.author === normalizeString(payload.author) &&
      JSON.stringify(existing.catalogWork.genres) ===
        JSON.stringify(normalizeGenres(payload.genres)) &&
      existing.catalogWork.description ===
        normalizeString(payload.description) &&
      existing.catalogWork.thumbnailUrl ===
        normalizeString(payload.thumbnailUrl) &&
      existing.status === payload.status &&
      existing.rating === (payload.rating ?? null) &&
      existing.shortReview === normalizeString(payload.shortReview) &&
      existing.review === normalizeString(payload.review) &&
      JSON.stringify(existing.personalTags) ===
        JSON.stringify(normalizePersonalTags(payload.personalTags)) &&
      existing.tier === (payload.tier ?? null) &&
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

  private toSyncSeriesPayload(series: UserSeriesSyncView): SyncSeriesPayloadDto {
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

  private toSyncContributorPayload(
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

  private toSyncWorkSeriesLinkPayload(
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

  private toSyncWorkContributorPayload(
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

  private toSyncWorkRelationPayload(
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

  private async findGraphRecordsByUserSince(userId: string, since: Date | null) {
    const updatedAtFilter = since
      ? {
          updatedAt: {
            gt: since,
          },
        }
      : {};
    const [
      series,
      contributors,
      workSeriesLinks,
      workContributors,
      workRelations,
    ] = await Promise.all([
      this.prisma.userSeries.findMany({
        where: {
          userId,
          ...updatedAtFilter,
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.userContributor.findMany({
        where: {
          userId,
          ...updatedAtFilter,
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.userWorkSeriesLink.findMany({
        where: {
          userWork: {
            userId,
          },
          ...updatedAtFilter,
        },
        include: USER_WORK_SERIES_LINK_INCLUDE,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.userWorkContributor.findMany({
        where: {
          userWork: {
            userId,
          },
          ...updatedAtFilter,
        },
        include: USER_WORK_CONTRIBUTOR_INCLUDE,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.userWorkRelation.findMany({
        where: {
          userId,
          ...updatedAtFilter,
        },
        include: USER_WORK_RELATION_INCLUDE,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return {
      contributors,
      series,
      workContributors,
      workRelations,
      workSeriesLinks,
    };
  }

  private buildOrderedPullChanges({
    contributors,
    releaseRecords,
    series,
    timelineEntries,
    workContributors,
    workRelations,
    workSeriesLinks,
    works,
  }: {
    contributors: UserContributorSyncView[];
    releaseRecords: UserReleaseRecordAggregate[];
    series: UserSeriesSyncView[];
    timelineEntries: UserTimelineEntryAggregate[];
    workContributors: UserWorkContributorSyncView[];
    workRelations: UserWorkRelationSyncView[];
    workSeriesLinks: UserWorkSeriesLinkSyncView[];
    works: WorkAggregate[];
  }) {
    return [
      ...works.map<OrderedPullChange>((work) => {
        const updatedAt = work.updatedAt.toISOString();

        return {
          change: {
            entityType: 'work',
            entityId: work.id,
            operation: work.deletedAt === null ? 'upsert' : 'delete',
            work: toFlatWorkResponse(work),
          },
          cursor: {
            entityId: work.id,
            entityType: 'work',
            updatedAt,
          },
          updatedAtMs: work.updatedAt.getTime(),
        };
      }),
      ...releaseRecords.map<OrderedPullChange>((releaseRecord) => {
        const updatedAt = releaseRecord.updatedAt.toISOString();

        return {
          change: {
            entityType: 'release_record',
            entityId: releaseRecord.id,
            operation: releaseRecord.deletedAt === null ? 'upsert' : 'delete',
            releaseRecord: toUserReleaseRecordResponse(releaseRecord),
          },
          cursor: {
            entityId: releaseRecord.id,
            entityType: 'release_record',
            updatedAt,
          },
          updatedAtMs: releaseRecord.updatedAt.getTime(),
        };
      }),
      ...timelineEntries.map<OrderedPullChange>((timelineEntry) => {
        const updatedAt = timelineEntry.updatedAt.toISOString();

        return {
          change: {
            entityType: 'timeline_entry',
            entityId: timelineEntry.id,
            operation: timelineEntry.deletedAt === null ? 'upsert' : 'delete',
            timelineEntry: toUserTimelineEntryResponse(timelineEntry),
          },
          cursor: {
            entityId: timelineEntry.id,
            entityType: 'timeline_entry',
            updatedAt,
          },
          updatedAtMs: timelineEntry.updatedAt.getTime(),
        };
      }),
      ...series.map<OrderedPullChange>((entry) => {
        const updatedAt = entry.updatedAt.toISOString();

        return {
          change: {
            entityType: 'series',
            entityId: entry.id,
            operation: entry.deletedAt === null ? 'upsert' : 'delete',
            series: this.toSyncSeriesPayload(entry),
          },
          cursor: {
            entityId: entry.id,
            entityType: 'series',
            updatedAt,
          },
          updatedAtMs: entry.updatedAt.getTime(),
        };
      }),
      ...contributors.map<OrderedPullChange>((entry) => {
        const updatedAt = entry.updatedAt.toISOString();

        return {
          change: {
            entityType: 'contributor',
            entityId: entry.id,
            operation: entry.deletedAt === null ? 'upsert' : 'delete',
            contributor: this.toSyncContributorPayload(entry),
          },
          cursor: {
            entityId: entry.id,
            entityType: 'contributor',
            updatedAt,
          },
          updatedAtMs: entry.updatedAt.getTime(),
        };
      }),
      ...workSeriesLinks.map<OrderedPullChange>((entry) => {
        const updatedAt = entry.updatedAt.toISOString();

        return {
          change: {
            entityType: 'work_series_link',
            entityId: entry.id,
            operation: entry.deletedAt === null ? 'upsert' : 'delete',
            workSeriesLink: this.toSyncWorkSeriesLinkPayload(entry),
          },
          cursor: {
            entityId: entry.id,
            entityType: 'work_series_link',
            updatedAt,
          },
          updatedAtMs: entry.updatedAt.getTime(),
        };
      }),
      ...workContributors.map<OrderedPullChange>((entry) => {
        const updatedAt = entry.updatedAt.toISOString();

        return {
          change: {
            entityType: 'work_contributor',
            entityId: entry.id,
            operation: entry.deletedAt === null ? 'upsert' : 'delete',
            workContributor: this.toSyncWorkContributorPayload(entry),
          },
          cursor: {
            entityId: entry.id,
            entityType: 'work_contributor',
            updatedAt,
          },
          updatedAtMs: entry.updatedAt.getTime(),
        };
      }),
      ...workRelations.map<OrderedPullChange>((entry) => {
        const updatedAt = entry.updatedAt.toISOString();

        return {
          change: {
            entityType: 'work_relation',
            entityId: entry.id,
            operation: entry.deletedAt === null ? 'upsert' : 'delete',
            workRelation: this.toSyncWorkRelationPayload(entry),
          },
          cursor: {
            entityId: entry.id,
            entityType: 'work_relation',
            updatedAt,
          },
          updatedAtMs: entry.updatedAt.getTime(),
        };
      }),
    ].sort((left, right) => {
      const updatedAtDelta = left.updatedAtMs - right.updatedAtMs;

      if (updatedAtDelta !== 0) {
        return updatedAtDelta;
      }

      const entityTypeDelta = left.cursor.entityType.localeCompare(
        right.cursor.entityType,
      );

      if (entityTypeDelta !== 0) {
        return entityTypeDelta;
      }

      return left.cursor.entityId.localeCompare(right.cursor.entityId);
    });
  }

  private encodePullCursor(cursor: PullCursor) {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private parsePullCursor(value: string | null): PullCursor | null {
    if (!value) {
      return null;
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      ) as Partial<PullCursor>;

      if (
        typeof decoded.updatedAt !== 'string' ||
        typeof decoded.entityType !== 'string' ||
        typeof decoded.entityId !== 'string' ||
          !(SYNC_ENTITY_TYPES as readonly string[]).includes(decoded.entityType) ||
        Number.isNaN(Date.parse(decoded.updatedAt))
      ) {
        throw new Error('Invalid cursor shape.');
      }

      return {
        entityId: decoded.entityId,
        entityType: decoded.entityType as SyncEntityType,
        updatedAt: decoded.updatedAt,
      };
    } catch {
      throw new BadRequestException('cursor must be a valid sync pull cursor.');
    }
  }

  private isAfterPullCursor(cursor: PullCursor, previous: PullCursor | null) {
    if (!previous) {
      return true;
    }

    const updatedAtDelta =
      Date.parse(cursor.updatedAt) - Date.parse(previous.updatedAt);

    if (updatedAtDelta !== 0) {
      return updatedAtDelta > 0;
    }

    const entityTypeDelta = cursor.entityType.localeCompare(
      previous.entityType,
    );

    if (entityTypeDelta !== 0) {
      return entityTypeDelta > 0;
    }

    return cursor.entityId.localeCompare(previous.entityId) > 0;
  }

  private getPullChangeUpdatedAt(change: PullSyncChangeDto) {
    if (change.entityType === 'work') {
      return change.work!.updatedAt;
    }

    if (change.entityType === 'release_record') {
      return change.releaseRecord!.updatedAt;
    }

    if (change.entityType === 'timeline_entry') {
      return change.timelineEntry!.updatedAt;
    }

    if (change.entityType === 'series') {
      return change.series!.updatedAt;
    }

    if (change.entityType === 'contributor') {
      return change.contributor!.updatedAt;
    }

    if (change.entityType === 'work_series_link') {
      return change.workSeriesLink!.updatedAt;
    }

    if (change.entityType === 'work_contributor') {
      return change.workContributor!.updatedAt;
    }

    return change.workRelation!.updatedAt;
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

  private buildNextSince(
    since: string | null,
    pulledAt: string,
    records: Array<{ updatedAt: Date }>,
  ) {
    if (records.length === 0) {
      return since ?? pulledAt;
    }

    return records[records.length - 1]!.updatedAt.toISOString();
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

  private logPullSummary(
    userId: string,
    since: string | null,
    response: PullSyncResponseDto,
  ) {
    const upsertCount = response.changes.filter(
      (change) => change.operation === 'upsert',
    ).length;
    const deleteCount = response.changes.filter(
      (change) => change.operation === 'delete',
    ).length;

    this.logger.log(
      `Sync pull summary userId=${userId} since=${since ?? 'null'} changes=${response.changes.length} upsert=${upsertCount} delete=${deleteCount} nextSince=${response.nextSince}`,
    );
  }

  private describeError(error: unknown) {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }

    return 'UnknownError';
  }
}
