import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  WorkSyncStatus,
  type Prisma,
  type WorkStatus,
  type WorkTier,
  type WorkType,
} from '@prisma/client';

import { CatalogService } from '../catalog/catalog.service';
import { UserRecordsService, type WorkAggregate } from '../user-records/user-records.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  normalizeGenres,
  normalizeString,
  toFlatWorkResponse,
} from '../works/work-aggregate';
import type { PullSyncDto } from './dto/pull-sync.dto';
import type { PullSyncResponseDto } from './dto/pull-sync-response.dto';
import type { PushSyncChangeDto, PushSyncDto } from './dto/push-sync.dto';
import type {
  PushSyncResponseDto,
  PushSyncResultDto,
} from './dto/push-sync-response.dto';
import type { SyncWorkPayloadDto } from './dto/sync-work-payload.dto';

const SERVER_SYNC_STATUS = WorkSyncStatus.synced;

@Injectable()
export class SyncService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogService) private readonly catalogService: CatalogService,
    @Inject(UserRecordsService)
    private readonly userRecordsService: UserRecordsService,
  ) {}

  async push(userId: string, { changes }: PushSyncDto): Promise<PushSyncResponseDto> {
    const results: PushSyncResultDto[] = [];

    for (const change of [...changes].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    )) {
      results.push(await this.applyChange(userId, change));
    }

    return {
      processedAt: new Date().toISOString(),
      results,
    };
  }

  async pull(userId: string, { since }: PullSyncDto): Promise<PullSyncResponseDto> {
    const works = await this.userRecordsService.findByUserSince(
      userId,
      since === undefined || since === null ? null : this.parseIsoDate(since, 'since'),
    );

    const pulledAt = new Date().toISOString();
    const nextSince =
      works.length === 0
        ? (since ?? pulledAt)
        : works[works.length - 1]!.updatedAt.toISOString();

    return {
      pulledAt,
      nextSince,
      changes: works.map((work) => ({
        entityType: 'work',
        entityId: work.id,
        operation: work.deletedAt === null ? 'upsert' : 'delete',
        work: toFlatWorkResponse(work),
      })),
    };
  }

  private async applyChange(
    userId: string,
    change: PushSyncChangeDto,
  ): Promise<PushSyncResultDto> {
    const existing = await this.userRecordsService.findById(change.entityId);

    if (!existing) {
      return this.applyMissingRemoteChange(userId, change);
    }

    if (existing.userId !== userId) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'conflict',
        message: 'Server mismatch: the record cannot be modified remotely.',
        work: null,
      };
    }

    if (this.areEquivalent(existing, change.payload)) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'applied',
        message: 'Remote record already matches the queued change.',
        work: toFlatWorkResponse(existing),
      };
    }

    if (!this.shouldApplyLocalChange(existing, change.payload)) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'conflict',
        message: this.buildConflictMessage(existing, change.payload),
        work: toFlatWorkResponse(existing),
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // split-only 단계에서는 catalog 메타데이터도 해당 user record와 함께 동기화합니다.
      await this.catalogService.update(
        existing.catalogWorkId,
        this.buildCatalogUpdateData(change.payload),
        tx,
      );

      return this.userRecordsService.update(
        change.entityId,
        this.buildUserRecordUpdateData(change.payload),
        tx,
      );
    });

    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'work',
      status: 'applied',
      message:
        change.payload.deletedAt === null
          ? 'Queued change applied on the server.'
          : 'Queued tombstone applied on the server.',
      work: toFlatWorkResponse(updated),
    };
  }

  private async applyMissingRemoteChange(
    userId: string,
    change: PushSyncChangeDto,
  ): Promise<PushSyncResultDto> {
    const isDelete =
      change.operation === 'delete' || change.payload.deletedAt !== null;
    const canCreate =
      change.operation === 'create' && change.payload.serverVersion === 0;

    if (isDelete) {
      if (change.payload.serverVersion > 0) {
        return {
          queueId: change.queueId,
          entityId: change.entityId,
          entityType: 'work',
          status: 'conflict',
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
        message:
          'Remote delete was a no-op because the server record is missing.',
        work: null,
      };
    }

    if (!canCreate) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'conflict',
        message: 'Server mismatch: the record does not exist remotely anymore.',
        work: null,
      };
    }

    const created = await this.prisma.$transaction(async (tx) => {
      await this.catalogService.create(this.buildCatalogCreateData(change.payload), tx);

      return this.userRecordsService.create(
        this.buildUserRecordCreateData(userId, change.payload),
        tx,
      );
    });

    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'work',
      status: 'applied',
      message: 'Queued record created on the server.',
      work: toFlatWorkResponse(created),
    };
  }

  private shouldApplyLocalChange(existing: WorkAggregate, payload: SyncWorkPayloadDto) {
    if (payload.serverVersion === existing.serverVersion) {
      return true;
    }

    return new Date(payload.updatedAt).getTime() > existing.updatedAt.getTime();
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
  ): Prisma.UserWorkRecordUncheckedCreateInput {
    return {
      id: payload.id,
      userId,
      // split-only 중간 단계: payload.id를 catalogWorkId로 사용해 1:1 매핑을 고정합니다.
      catalogWorkId: payload.id,
      status: payload.status as WorkStatus,
      rating: payload.rating ?? null,
      shortReview: normalizeString(payload.shortReview),
      review: normalizeString(payload.review),
      tier: (payload.tier ?? null) as WorkTier | null,
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
      tier: (payload.tier ?? null) as WorkTier | null,
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

  private areEquivalent(existing: WorkAggregate, payload: SyncWorkPayloadDto) {
    return (
      existing.catalogWork.type === payload.type &&
      existing.catalogWork.title === payload.title.trim() &&
      existing.catalogWork.author === normalizeString(payload.author) &&
      JSON.stringify(existing.catalogWork.genres) ===
        JSON.stringify(normalizeGenres(payload.genres)) &&
      existing.catalogWork.description === normalizeString(payload.description) &&
      existing.catalogWork.thumbnailUrl === normalizeString(payload.thumbnailUrl) &&
      existing.status === payload.status &&
      existing.rating === (payload.rating ?? null) &&
      existing.shortReview === normalizeString(payload.shortReview) &&
      existing.review === normalizeString(payload.review) &&
      existing.tier === (payload.tier ?? null) &&
      existing.favorite === payload.favorite &&
      existing.deletedAt?.toISOString() ===
        (payload.deletedAt === null ? undefined : payload.deletedAt)
    );
  }

  private buildConflictMessage(existing: WorkAggregate, payload: SyncWorkPayloadDto) {
    const remoteDeletedAt = existing.deletedAt?.toISOString() ?? 'active';
    const localDeletedAt = payload.deletedAt ?? 'active';

    return `Conflict: server version ${existing.serverVersion} updated at ${existing.updatedAt.toISOString()} (deletedAt: ${remoteDeletedAt}) won over local version ${payload.serverVersion} updated at ${payload.updatedAt} (deletedAt: ${localDeletedAt}).`;
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
}
