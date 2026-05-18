import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  WorkSyncStatus,
  type Prisma,
  type TimelineEntryType,
  type WorkStatus,
  type WorkTier,
  WorkType,
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
import type { SyncReleaseRecordPayloadDto } from './dto/sync-release-record-payload.dto';
import type { SyncTimelineEntryPayloadDto } from './dto/sync-timeline-entry-payload.dto';
import type { SyncWorkPayloadDto } from './dto/sync-work-payload.dto';

const SERVER_SYNC_STATUS = WorkSyncStatus.synced;
const SYNC_SCHEMA_VERSION = 2 as const;
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

type SyncCreateTitleView = Prisma.CatalogTitleGetPayload<{
  include: typeof SYNC_CREATE_TITLE_INCLUDE;
}>;

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
      const pulledAt = new Date().toISOString();
      const changes = [
        ...works.map<PullSyncChangeDto>((work) => ({
          entityType: 'work',
          entityId: work.id,
          operation: work.deletedAt === null ? 'upsert' : 'delete',
          work: toFlatWorkResponse(work),
        })),
        ...releaseRecords.map<PullSyncChangeDto>((releaseRecord) => ({
          entityType: 'release_record',
          entityId: releaseRecord.id,
          operation: releaseRecord.deletedAt === null ? 'upsert' : 'delete',
          releaseRecord: toUserReleaseRecordResponse(releaseRecord),
        })),
        ...timelineEntries.map<PullSyncChangeDto>((timelineEntry) => ({
          entityType: 'timeline_entry',
          entityId: timelineEntry.id,
          operation: timelineEntry.deletedAt === null ? 'upsert' : 'delete',
          timelineEntry: toUserTimelineEntryResponse(timelineEntry),
        })),
      ].sort((left, right) => {
        const leftUpdatedAt = this.getPullChangeUpdatedAt(left);
        const rightUpdatedAt = this.getPullChangeUpdatedAt(right);

        return (
          new Date(leftUpdatedAt).getTime() - new Date(rightUpdatedAt).getTime()
        );
      });
      const changedRecords = [
        ...works,
        ...releaseRecords,
        ...timelineEntries,
      ].sort(
        (left, right) => left.updatedAt.getTime() - right.updatedAt.getTime(),
      );
      const response: PullSyncResponseDto = {
        schemaVersion: SYNC_SCHEMA_VERSION,
        pulledAt,
        nextSince: this.buildNextSince(since ?? null, pulledAt, changedRecords),
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

  private getPullChangeUpdatedAt(change: PullSyncChangeDto) {
    if (change.entityType === 'work') {
      return change.work!.updatedAt;
    }

    if (change.entityType === 'release_record') {
      return change.releaseRecord!.updatedAt;
    }

    return change.timelineEntry!.updatedAt;
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
